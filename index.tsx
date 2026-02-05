#!/usr/bin/env bun

import React, { useState, useEffect } from "react";
import { render, Box, Text, Newline, useApp, useInput } from "ink";
import { Select, Spinner, MultiSelect, ProgressBar } from "@inkjs/ui";

// ============================================================================
// Types
// ============================================================================

interface Author {
  name: string;
  email: string;
  commits: number;
}

interface CodeSnippet {
  filename: string;
  code: string[];
  author: string;
  email: string;
  commitHash: string;
  isMyCode: boolean;
  hash: string; // 用于去重
}

interface CommentSnippet {
  filename: string;
  comment: string[];
  context: string[];
  author: string;
  email: string;
  isMyCode: boolean;
  hash: string; // 用于去重
}

interface DailyCodeStats {
  date: string;
  linesAdded: number;
  commits: number;
  avgLinesPerCommit: number;
}

// 基于心理学 Remember-Know 范式的回答类型
// remember: 明确记得写过（高信心）
// familiar: 看起来熟悉，可能是自己的（中信心）
// uncertain: 不确定来源（低信心）
// foreign: 确定不是自己写的（高信心否定）
type AnswerType = "remember" | "familiar" | "uncertain" | "foreign";

interface QuizResult {
  memory: {
    total: number;
    myCodeTotal: number;
    // 按回答类型统计
    answers: { type: AnswerType; isMyCode: boolean }[];
  };
  comment: {
    total: number;
    myCodeTotal: number;
    answers: { type: AnswerType; isMyCode: boolean }[];
  };
  velocity: DailyCodeStats[];
}

type GamePhase =
  | "loading"
  | "select-author"
  | "scanning"
  | "ready"
  | "memory"
  | "comment"
  | "result";

// ============================================================================
// Constants
// ============================================================================

// 支持的代码文件扩展名 - 覆盖主流语言
const CODE_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  // Python
  ".py", ".pyw", ".pyx", ".pxd", ".pxi",
  // Go
  ".go",
  // Rust
  ".rs",
  // Java/Kotlin/Scala
  ".java", ".kt", ".kts", ".scala", ".sc",
  // C/C++/Objective-C
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".m", ".mm",
  // C#/F#
  ".cs", ".fs", ".fsx",
  // Ruby
  ".rb", ".rake", ".gemspec",
  // PHP
  ".php", ".phtml",
  // Swift
  ".swift",
  // Dart
  ".dart",
  // Lua
  ".lua",
  // Shell
  ".sh", ".bash", ".zsh", ".fish",
  // Perl
  ".pl", ".pm",
  // R
  ".r", ".R",
  // Elixir/Erlang
  ".ex", ".exs", ".erl", ".hrl",
  // Haskell
  ".hs", ".lhs",
  // Clojure
  ".clj", ".cljs", ".cljc", ".edn",
  // Zig
  ".zig",
  // Nim
  ".nim",
  // V
  ".v",
  // OCaml
  ".ml", ".mli",
  // SQL (存储过程)
  ".sql",
  // Groovy
  ".groovy", ".gradle",
]);

// 忽略的文件模式
const IGNORED_PATTERNS = [
  /\.min\./,           // 压缩文件
  /\.bundle\./,        // 打包文件
  /\.generated\./,     // 生成文件
  /node_modules/,
  /vendor\//,
  /dist\//,
  /build\//,
  /target\//,
  /\.d\.ts$/,          // TypeScript 声明文件
  /__pycache__/,
  /\.pyc$/,
];

const MAX_COMMITS = 2000;     // 增加到 2000
const SAMPLE_COMMITS = 300;   // 随机采样 300 个提交进行分析
const MEMORY_QUESTIONS = 10;
const COMMENT_QUESTIONS = 10;
const MIN_SNIPPET_LINES = 4;
const MAX_SNIPPET_LINES = 12;

// 各语言的固定模式 - 需要过滤
const FIXED_PATTERNS = [
  // JavaScript/TypeScript
  /^import\s+/,
  /^export\s+(default\s+)?(\{|class|function|const|let|var|interface|type|enum)/,
  /^const\s+\w+\s*=\s*use[A-Z]\w*\(/,     // React hooks
  /^const\s*\[\s*\w+\s*,\s*set[A-Z]/,     // useState
  /^const\s+\{\s*\w+\s*\}\s*=\s*use\w+/,  // hook 解构
  /^module\.exports/,
  /^require\(/,
  // Python
  /^from\s+\S+\s+import/,
  /^import\s+\S+/,
  /^def\s+__\w+__/,                        // 魔术方法
  /^class\s+\w+\s*(\(|:)/,
  // Go
  /^package\s+/,
  /^import\s*\(/,
  /^func\s+\(\w+\s+\*?\w+\)\s+\w+/,       // 方法定义开头
  // Rust
  /^use\s+/,
  /^mod\s+/,
  /^pub\s+(fn|struct|enum|trait|impl|mod|use|const|static)/,
  // Java/Kotlin
  /^package\s+/,
  /^import\s+/,
  /^public\s+(class|interface|enum)/,
  /^private\s+(class|interface|enum)/,
  // Ruby
  /^require\s+/,
  /^require_relative\s+/,
  /^module\s+/,
  // C/C++
  /^#include\s+/,
  /^#define\s+/,
  /^#pragma\s+/,
  /^using\s+namespace/,
  // 通用
  /^[\{\}\[\]\(\);,]+$/,                   // 纯括号
  /^\s*$/,                                  // 空行
];

// 各语言的注释模式
const COMMENT_PATTERNS = [
  /^\/\//,           // C-style single line
  /^\/\*/,           // C-style multi line start
  /^\*/,             // C-style multi line middle
  /^#(?!\!)/,        // Python/Ruby/Shell (排除 shebang)
  /^--/,             // SQL/Haskell
  /^"""/,            // Python docstring
  /^'''/,            // Python docstring
  /^;/,              // Lisp/Clojure
  /^\{-/,            // Haskell multi line
];

// ============================================================================
// Utility Functions
// ============================================================================

// 简单的内容哈希，用于去重
function hashContent(content: string[]): string {
  return content.join("\n").trim().replace(/\s+/g, " ").substring(0, 200);
}

// 检查两个代码片段是否相似
function isSimilarSnippet(a: string[], b: string[]): boolean {
  const hashA = hashContent(a);
  const hashB = hashContent(b);

  // 完全相同
  if (hashA === hashB) return true;

  // Levenshtein-like 简单相似度检查
  const minLen = Math.min(hashA.length, hashB.length);
  let same = 0;
  for (let i = 0; i < minLen; i++) {
    if (hashA[i] === hashB[i]) same++;
  }

  return same / minLen > 0.8; // 80% 以上相似
}

// ============================================================================
// Git Utilities
// ============================================================================

async function runGit(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(error || `Git command failed with exit code ${exitCode}`);
  }

  return output.trim();
}

async function isGitRepo(): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

async function getAuthors(): Promise<Author[]> {
  const output = await runGit([
    "log", `--max-count=${MAX_COMMITS}`, "--format=%aN|%aE"
  ]);

  const authorMap = new Map<string, Author>();
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [name, email] = line.split("|");
    const key = `${name}|${email}`;
    if (authorMap.has(key)) {
      authorMap.get(key)!.commits++;
    } else {
      authorMap.set(key, { name, email, commits: 1 });
    }
  }

  return Array.from(authorMap.values()).sort((a, b) => b.commits - a.commits);
}

async function getCommitHashes(): Promise<string[]> {
  const output = await runGit(["log", `--max-count=${MAX_COMMITS}`, "--format=%H"]);
  return output.split("\n").filter(Boolean);
}

async function getCommitInfo(hash: string): Promise<{
  author: string;
  email: string;
  timestamp: Date;
  message: string;
}> {
  const output = await runGit(["log", "-1", "--format=%aN|%aE|%at|%s", hash]);
  const parts = output.split("|");
  const author = parts[0] || "";
  const email = parts[1] || "";
  const timestamp = parts[2] || "0";
  const message = parts.slice(3).join("|"); // message 可能包含 |

  return {
    author,
    email,
    timestamp: new Date(parseInt(timestamp) * 1000),
    message: message || "",
  };
}

async function getCommitDiff(hash: string): Promise<string> {
  try {
    return await runGit(["show", hash, "--format=", "--unified=5", "--diff-filter=AM"]);
  } catch {
    return "";
  }
}

// ============================================================================
// Code Extraction
// ============================================================================

function isCodeFile(filename: string): boolean {
  // 检查忽略模式
  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(filename)) return false;
  }

  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function isFixedPattern(line: string): boolean {
  const trimmed = line.trim();
  return FIXED_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return COMMENT_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length < 8) return true;
  if (/^[\{\}\[\]\(\);,\s]+$/.test(trimmed)) return true;
  if (/^(else|end|endif|fi|done|esac|\}|\);?)$/.test(trimmed)) return true;
  return false;
}

function extractSnippetsFromDiff(
  diff: string,
  author: string,
  email: string,
  commitHash: string,
  selectedAuthors: Set<string>
): { codeSnippets: CodeSnippet[]; commentSnippets: CommentSnippet[] } {
  const codeSnippets: CodeSnippet[] = [];
  const commentSnippets: CommentSnippet[] = [];
  const files = diff.split(/(?=diff --git)/);
  const isMyCode = selectedAuthors.has(`${author}|${email}`);

  for (const fileDiff of files) {
    const fileMatch = /diff --git a\/.+ b\/(.+)/.exec(fileDiff);
    if (!fileMatch) continue;

    const filename = fileMatch[1];
    if (!isCodeFile(filename)) continue;

    const lines = fileDiff.split("\n");

    // 收集连续的代码块和注释块
    const codeBlocks: string[][] = [];
    const commentBlocksWithContext: { comment: string[]; context: string[] }[] = [];

    let currentCodeBlock: string[] = [];
    let currentCommentBlock: string[] = [];
    let contextBuffer: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      // 检测 hunk 开始
      if (line.startsWith("@@")) {
        inHunk = true;
        // 保存之前的块
        if (currentCodeBlock.length >= MIN_SNIPPET_LINES) {
          codeBlocks.push([...currentCodeBlock]);
        }
        currentCodeBlock = [];
        continue;
      }

      if (!inHunk) continue;

      if (line.startsWith("+") && !line.startsWith("+++")) {
        const codeLine = line.substring(1);
        const trimmed = codeLine.trim();

        // 跳过固定模式
        if (isFixedPattern(codeLine)) continue;

        // 检测注释
        if (isCommentLine(codeLine) && trimmed.length > 15) {
          currentCommentBlock.push(codeLine);
        } else {
          // 保存注释块
          if (currentCommentBlock.length > 0) {
            commentBlocksWithContext.push({
              comment: [...currentCommentBlock],
              context: [...contextBuffer.slice(-2)],
            });
            currentCommentBlock = [];
          }

          // 处理代码
          if (!isNoiseLine(codeLine)) {
            currentCodeBlock.push(codeLine);
            contextBuffer.push(codeLine);
            if (contextBuffer.length > 5) contextBuffer.shift();
          } else if (currentCodeBlock.length >= MIN_SNIPPET_LINES) {
            // 遇到噪音行，保存当前块
            codeBlocks.push([...currentCodeBlock]);
            currentCodeBlock = [];
          }
        }
      } else if (line.startsWith("-") || line.startsWith(" ")) {
        // 上下文行或删除行 - 可能中断代码块
        if (currentCodeBlock.length >= MIN_SNIPPET_LINES) {
          codeBlocks.push([...currentCodeBlock]);
          currentCodeBlock = [];
        }
      }
    }

    // 保存最后的块
    if (currentCodeBlock.length >= MIN_SNIPPET_LINES) {
      codeBlocks.push([...currentCodeBlock]);
    }
    if (currentCommentBlock.length > 0) {
      commentBlocksWithContext.push({
        comment: [...currentCommentBlock],
        context: [...contextBuffer.slice(-2)],
      });
    }

    // 从代码块创建代码片段
    for (const block of codeBlocks) {
      if (block.length >= MIN_SNIPPET_LINES) {
        // 选择一个连续的片段
        const maxLen = Math.min(MAX_SNIPPET_LINES, block.length);
        const len = Math.min(maxLen, Math.max(MIN_SNIPPET_LINES, Math.floor(block.length * 0.7)));
        const startIdx = Math.floor(Math.random() * Math.max(1, block.length - len + 1));
        const snippet = block.slice(startIdx, startIdx + len);

        if (snippet.length >= MIN_SNIPPET_LINES) {
          codeSnippets.push({
            filename,
            code: snippet,
            author,
            email,
            commitHash: commitHash.substring(0, 7),
            isMyCode,
            hash: hashContent(snippet),
          });
        }
      }
    }

    // 从注释块创建注释片段
    for (const block of commentBlocksWithContext) {
      if (block.comment.length >= 1 && block.comment.some(c => c.trim().length > 20)) {
        commentSnippets.push({
          filename,
          comment: block.comment,
          context: block.context,
          author,
          email,
          isMyCode,
          hash: hashContent(block.comment),
        });
      }
    }
  }

  return { codeSnippets, commentSnippets };
}

// 去重函数
function deduplicateSnippets<T extends { hash: string; code?: string[]; comment?: string[] }>(
  snippets: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const snippet of snippets) {
    if (!seen.has(snippet.hash)) {
      // 额外检查内容相似度
      const content = snippet.code || snippet.comment || [];
      let isDuplicate = false;

      for (const existing of result) {
        const existingContent = existing.code || existing.comment || [];
        if (isSimilarSnippet(content, existingContent)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(snippet.hash);
        result.push(snippet);
      }
    }
  }

  return result;
}

// ============================================================================
// Velocity Analysis
// ============================================================================

async function analyzeDailyVelocity(
  commitHashes: string[],
  selectedAuthors: Set<string>
): Promise<DailyCodeStats[]> {
  const dailyStats = new Map<string, { lines: number; commits: number }>();

  // 只分析采样的提交
  const sampled = commitHashes.slice(0, SAMPLE_COMMITS);

  for (const hash of sampled) {
    try {
      const info = await getCommitInfo(hash);
      const authorKey = `${info.author}|${info.email}`;

      if (!selectedAuthors.has(authorKey)) continue;

      const dateStr = info.timestamp.toISOString().split("T")[0];
      const diff = await getCommitDiff(hash);

      let linesAdded = 0;
      for (const line of diff.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          linesAdded++;
        }
      }

      if (!dailyStats.has(dateStr)) {
        dailyStats.set(dateStr, { lines: 0, commits: 0 });
      }
      const stat = dailyStats.get(dateStr)!;
      stat.lines += linesAdded;
      stat.commits++;
    } catch {
      // 忽略错误
    }
  }

  const results: DailyCodeStats[] = [];
  for (const [date, stat] of dailyStats) {
    results.push({
      date,
      linesAdded: stat.lines,
      commits: stat.commits,
      avgLinesPerCommit: Math.round(stat.lines / stat.commits),
    });
  }

  return results
    .filter(d => d.linesAdded > 500)
    .sort((a, b) => b.linesAdded - a.linesAdded)
    .slice(0, 10);
}

// ============================================================================
// UI Components
// ============================================================================

function Banner() {
  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      <Box
        borderStyle="double"
        borderColor="cyan"
        paddingX={3}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
      >
        <Text bold color="yellow">
          🎮 VIBE SCORE 🎮
        </Text>
        <Text color="magenta" bold>
          Are you a Vibe Coder?
        </Text>
        <Newline />
        <Text dimColor>
          🧠 Code · 💬 Comment · ⚡ Velocity
        </Text>
      </Box>
    </Box>
  );
}

function CodeBlock({ code, showLineNumbers = true }: { code: string[]; showLineNumbers?: boolean }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {code.map((line, idx) => (
        <Text key={idx}>
          {showLineNumbers && <Text dimColor>{String(idx + 1).padStart(3)} │ </Text>}
          <Text>{line}</Text>
        </Text>
      ))}
    </Box>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold>
        {emoji} {title}
      </Text>
      <Text dimColor>{subtitle}</Text>
    </Box>
  );
}

// ============================================================================
// Game Screens
// ============================================================================

function LoadingScreen({ message }: { message: string }) {
  return (
    <Box flexDirection="column" alignItems="center" marginY={2}>
      <Box>
        <Spinner label={message} />
      </Box>
    </Box>
  );
}

function AuthorSelectScreen({
  authors,
  onSelect,
}: {
  authors: Author[];
  onSelect: (selected: string[]) => void;
}) {
  const options = authors.map((a) => ({
    label: `${a.name} <${a.email}> (${a.commits} 次提交)`,
    value: `${a.name}|${a.email}`,
  }));

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold>👤 请选择代表你的 Git 身份（空格选择，回车确认）:</Text>
      <Text dimColor>   提示: 同一个人可能有多个 git config 配置</Text>
      <Newline />
      <MultiSelect options={options} onSubmit={onSelect} />
    </Box>
  );
}

function MemoryQuestionScreen({
  code,
  questionNum,
  totalQuestions,
  onAnswer,
}: {
  code: string[];
  questionNum: number;
  totalQuestions: number;
  onAnswer: (answer: AnswerType) => void;
}) {
  // 基于 Remember-Know 范式设计的选项
  // 通过区分记忆的"质量"而非简单的是/否来获得更准确的评估
  const options = [
    { label: "💡 我记得写过这段代码", value: "remember" as AnswerType },
    { label: "🤔 看着眼熟，可能是我写的", value: "familiar" as AnswerType },
    { label: "❓ 不太确定是谁写的", value: "uncertain" as AnswerType },
    { label: "🚫 这肯定不是我写的", value: "foreign" as AnswerType },
  ];

  return (
    <Box flexDirection="column">
      <SectionHeader
        emoji="🧠"
        title={`代码记忆 (${questionNum}/${totalQuestions})`}
        subtitle="这段代码是你写的吗？"
      />
      <CodeBlock code={code} />
      <Select key={`mem-select-${questionNum}`} options={options} onChange={onAnswer} />
    </Box>
  );
}

function CommentQuestionScreen({
  comment,
  context,
  questionNum,
  totalQuestions,
  onAnswer,
}: {
  comment: string[];
  context: string[];
  questionNum: number;
  totalQuestions: number;
  onAnswer: (answer: AnswerType) => void;
}) {
  const options = [
    { label: "💡 我记得写过这段注释", value: "remember" as AnswerType },
    { label: "🤔 看着眼熟，可能是我写的", value: "familiar" as AnswerType },
    { label: "❓ 不太确定是谁写的", value: "uncertain" as AnswerType },
    { label: "🚫 这肯定不是我写的", value: "foreign" as AnswerType },
  ];

  return (
    <Box flexDirection="column">
      <SectionHeader
        emoji="💬"
        title={`注释判断 (${questionNum}/${totalQuestions})`}
        subtitle="这段注释是你写的吗？"
      />
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1} marginY={1}>
        {comment.map((line, idx) => (
          <Text key={idx} color="yellow">{line}</Text>
        ))}
      </Box>
      {context.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>上下文代码:</Text>
          <Box flexDirection="column" paddingX={2}>
            {context.map((line, idx) => (
              <Text key={idx} dimColor>{line}</Text>
            ))}
          </Box>
        </Box>
      )}
      <Select key={`cmt-select-${questionNum}`} options={options} onChange={onAnswer} />
    </Box>
  );
}

// 计算 Vibe Score 的核心函数
// 基于 Remember-Know 范式的加权计算
function calculateVibeMetrics(answers: { type: AnswerType; isMyCode: boolean }[]) {
  const myCodeAnswers = answers.filter(a => a.isMyCode);
  const otherCodeAnswers = answers.filter(a => !a.isMyCode);

  // 对自己的代码的识别情况
  let myCodeRecognized = 0;      // 明确记得
  let myCodeFamiliar = 0;        // 感觉熟悉
  let myCodeUncertain = 0;       // 不确定
  let myCodeMisidentified = 0;   // 误认为别人的

  for (const a of myCodeAnswers) {
    switch (a.type) {
      case "remember": myCodeRecognized++; break;
      case "familiar": myCodeFamiliar++; break;
      case "uncertain": myCodeUncertain++; break;
      case "foreign": myCodeMisidentified++; break;
    }
  }

  // 对别人代码的识别情况
  let otherCodeCorrect = 0;      // 正确识别为别人的
  let otherCodeFalseMemory = 0;  // 错误认为是自己的（虚假记忆）

  for (const a of otherCodeAnswers) {
    switch (a.type) {
      case "remember":
      case "familiar":
        otherCodeFalseMemory++;
        break;
      case "uncertain":
      case "foreign":
        otherCodeCorrect++;
        break;
    }
  }

  // Vibe Score 计算：
  // - 记得自己代码 = 低 Vibe (传统程序员)
  // - 不确定/误认 = 高 Vibe (Vibe Coder)
  // - 虚假记忆（认为别人代码是自己的）= 额外加分（真正的 Vibe）
  const myTotal = myCodeAnswers.length || 1;
  const otherTotal = otherCodeAnswers.length || 1;

  // 基础 Vibe 分：不记得自己代码的比例
  const forgetRate = (myCodeUncertain + myCodeMisidentified) / myTotal;
  // 模糊记忆率：只是感觉熟悉
  const fuzzyRate = myCodeFamiliar / myTotal;
  // 虚假记忆率：认为别人的是自己的
  const falseMemoryRate = otherCodeFalseMemory / otherTotal;

  // 综合 Vibe Score
  // 权重：遗忘 50% + 模糊 30% + 虚假记忆 20%
  const vibeScore = Math.round(
    (forgetRate * 50 + fuzzyRate * 30 + falseMemoryRate * 20)
  );

  return {
    myCodeTotal: myCodeAnswers.length,
    otherCodeTotal: otherCodeAnswers.length,
    myCodeRecognized,
    myCodeFamiliar,
    myCodeUncertain,
    myCodeMisidentified,
    otherCodeCorrect,
    otherCodeFalseMemory,
    vibeScore: Math.min(100, vibeScore),
  };
}

function ResultScreen({ result }: { result: QuizResult }) {
  const memoryMetrics = calculateVibeMetrics(result.memory.answers);
  const commentMetrics = calculateVibeMetrics(result.comment.answers);

  const memoryVibeScore = memoryMetrics.vibeScore;
  const commentVibeScore = commentMetrics.vibeScore;

  const velocityBonus = Math.min(result.velocity.length * 3, 15);
  const totalScore = Math.min(100, Math.round(
    memoryVibeScore * 0.5 + commentVibeScore * 0.35 + velocityBonus
  ));

  const rating = getVibeRating(totalScore);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        borderStyle="double"
        borderColor="cyan"
        paddingX={3}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
      >
        <Text bold color="yellow">📊 VIBE SCORE 报告 📊</Text>
      </Box>

      <Newline />

      {/* 代码记忆分析 */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>🧠 代码记忆</Text>
        <Box flexDirection="column" paddingLeft={3}>
          <Text dimColor>你的代码 ({memoryMetrics.myCodeTotal} 段):</Text>
          <Text>  💡 明确记得: <Text color="green">{memoryMetrics.myCodeRecognized}</Text></Text>
          <Text>  🤔 感觉熟悉: <Text color="yellow">{memoryMetrics.myCodeFamiliar}</Text></Text>
          <Text>  ❓ 不太确定: <Text color="cyan">{memoryMetrics.myCodeUncertain}</Text></Text>
          <Text>  🚫 误认别人: <Text color="red">{memoryMetrics.myCodeMisidentified}</Text></Text>
          {memoryMetrics.otherCodeTotal > 0 && (
            <>
              <Newline />
              <Text dimColor>别人的代码 ({memoryMetrics.otherCodeTotal} 段):</Text>
              <Text>  ✓ 正确识别: <Text color="green">{memoryMetrics.otherCodeCorrect}</Text></Text>
              <Text>  ✗ 虚假记忆: <Text color="magenta">{memoryMetrics.otherCodeFalseMemory}</Text></Text>
            </>
          )}
        </Box>
        <Box marginTop={1}>
          <Text>   Vibe 指数: </Text>
          <ProgressBar value={memoryVibeScore} />
          <Text bold color="blue"> {memoryVibeScore}%</Text>
        </Box>
        <Text dimColor>   {getMemoryComment(memoryVibeScore)}</Text>
      </Box>

      {/* 注释判断分析 */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>💬 注释判断</Text>
        <Box flexDirection="column" paddingLeft={3}>
          <Text dimColor>你的注释 ({commentMetrics.myCodeTotal} 段):</Text>
          <Text>  💡 明确记得: <Text color="green">{commentMetrics.myCodeRecognized}</Text></Text>
          <Text>  🤔 感觉熟悉: <Text color="yellow">{commentMetrics.myCodeFamiliar}</Text></Text>
          <Text>  ❓ 不太确定: <Text color="cyan">{commentMetrics.myCodeUncertain}</Text></Text>
          <Text>  🚫 误认别人: <Text color="red">{commentMetrics.myCodeMisidentified}</Text></Text>
        </Box>
        <Box marginTop={1}>
          <Text>   Vibe 指数: </Text>
          <ProgressBar value={commentVibeScore} />
          <Text bold color="yellow"> {commentVibeScore}%</Text>
        </Box>
        <Text dimColor>   {getCommentComment(commentVibeScore)}</Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text bold>⚡ 高产日分析</Text>
        {result.velocity.length === 0 ? (
          <Text dimColor>   没有发现特别高产的日子 (日均 500+ 行)</Text>
        ) : (
          <Box flexDirection="column" paddingLeft={3}>
            <Text dimColor>发现 {result.velocity.length} 个高产日：</Text>
            {result.velocity.slice(0, 5).map((day, idx) => (
              <Text key={idx}>
                <Text color="yellow">{day.date}</Text>
                <Text dimColor> - </Text>
                <Text color="red">{day.linesAdded} 行</Text>
                <Text dimColor> ({day.commits} 次提交)</Text>
              </Text>
            ))}
            {result.velocity.length > 5 && (
              <Text dimColor>...还有 {result.velocity.length - 5} 天</Text>
            )}
          </Box>
        )}
      </Box>

      <Newline />

      <Box
        borderStyle="round"
        borderColor="magenta"
        paddingX={3}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
        marginY={1}
      >
        <Text bold>🎯 综合 VIBE SCORE</Text>
        <Newline />
        <Box>
          <ProgressBar value={totalScore} />
          <Text bold color="yellow"> {totalScore}%</Text>
        </Box>
        <Newline />
        <Text bold>
          {rating.emoji} {rating.title}
        </Text>
        <Newline />
        <Text italic dimColor>"{rating.description}"</Text>
      </Box>

      <Newline />

      <Box flexDirection="column" paddingX={2}>
        <Text dimColor>📈 分数构成:</Text>
        <Text dimColor>   代码记忆 (50%): {memoryVibeScore}% × 0.5 = {Math.round(memoryVibeScore * 0.5)}</Text>
        <Text dimColor>   注释判断 (35%): {commentVibeScore}% × 0.35 = {Math.round(commentVibeScore * 0.35)}</Text>
        <Text dimColor>   高产日彩蛋: +{velocityBonus} ({result.velocity.length} 天)</Text>
      </Box>

      <Newline />
      <Text dimColor>按任意键退出...</Text>
    </Box>
  );
}

function getMemoryComment(score: number): string {
  if (score < 20) return "→ 你对代码记忆深刻，真是个细节控";
  if (score < 50) return "→ 记得一些，忘了一些，正常水平";
  if (score < 80) return "→ 写完就忘，经典 Vibe Coder";
  return "→ 这代码...真的是你写的吗？";
}

function getCommentComment(score: number): string {
  if (score < 20) return "→ 连注释都记得，你真的很认真";
  if (score < 50) return "→ 注释嘛，能跑就行";
  if (score < 80) return "→ 注释大概是复制来的吧";
  return "→ 注释？那都是 AI 的事！";
}

function getVibeRating(score: number): { title: string; emoji: string; description: string } {
  if (score <= 10) {
    return {
      title: "代码手工艺人",
      emoji: "🔨",
      description: "你对代码了如指掌，每一行都刻在DNA里。你确定没有开挂？",
    };
  } else if (score <= 25) {
    return {
      title: "传统程序员",
      emoji: "👴",
      description: "你还在用古老的方式写代码，记住每个变量名。respect！",
    };
  } else if (score <= 40) {
    return {
      title: "混合动力开发者",
      emoji: "🔋",
      description: "你在人类智慧和AI辅助之间找到了平衡。相当务实。",
    };
  } else if (score <= 55) {
    return {
      title: "Vibe Coder",
      emoji: "😎",
      description: "经典的 Vibe Coder！写代码就像做梦，醒来只记得个大概。",
    };
  } else if (score <= 70) {
    return {
      title: "AI 协作大师",
      emoji: "🎸",
      description: "你和AI是老搭档了。你负责需求，它负责实现。完美分工！",
    };
  } else if (score <= 85) {
    return {
      title: "Prompt 工程师",
      emoji: "🎯",
      description: "代码？那只是提示词的副产品。你的核心技能是写好问题。",
    };
  } else if (score < 100) {
    return {
      title: "人形 Copilot",
      emoji: "🤖",
      description: "你已经达到了人机合一的境界。分不清哪些是你写的，哪些是AI写的。",
    };
  } else {
    return {
      title: "AI 傀儡",
      emoji: "🎭",
      description: "恭喜！你已经完全进化成AI的人类接口。代码只是从你手指流过而已。",
    };
  }
}

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  const { exit } = useApp();

  const [phase, setPhase] = useState<GamePhase>("loading");
  const [loadingMessage, setLoadingMessage] = useState("正在检查 Git 仓库...");
  const [error, setError] = useState<string | null>(null);

  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(new Set());

  const [allCodeSnippets, setAllCodeSnippets] = useState<CodeSnippet[]>([]);
  const [allCommentSnippets, setAllCommentSnippets] = useState<CommentSnippet[]>([]);
  const [velocityData, setVelocityData] = useState<DailyCodeStats[]>([]);

  const [memoryIndex, setMemoryIndex] = useState(0);
  const [commentIndex, setCommentIndex] = useState(0);
  const [memoryQuestions, setMemoryQuestions] = useState<CodeSnippet[]>([]);
  const [commentQuestions, setCommentQuestions] = useState<CommentSnippet[]>([]);

  const [result, setResult] = useState<QuizResult>({
    memory: { total: 0, myCodeTotal: 0, answers: [] },
    comment: { total: 0, myCodeTotal: 0, answers: [] },
    velocity: [],
  });

  useEffect(() => {
    async function init() {
      try {
        if (!(await isGitRepo())) {
          setError("当前目录不是一个 Git 仓库！请在 Git 仓库中运行此命令。");
          return;
        }

        setLoadingMessage("正在分析 Git 历史...");
        const authorList = await getAuthors();

        if (authorList.length === 0) {
          setError("找不到任何提交记录！");
          return;
        }

        setAuthors(authorList);
        setPhase("select-author");
      } catch (e) {
        setError(`初始化失败: ${e}`);
      }
    }
    init();
  }, []);

  async function scanCode(selected: Set<string>) {
    setPhase("scanning");
    setLoadingMessage("正在扫描代码提交...");

    try {
      const commitHashes = await getCommitHashes();
      let codeSnippets: CodeSnippet[] = [];
      let commentSnippets: CommentSnippet[] = [];

      // 随机采样提交，而不是只取前 N 个
      const shuffledHashes = [...commitHashes].sort(() => Math.random() - 0.5);
      const sampled = shuffledHashes.slice(0, SAMPLE_COMMITS);

      let processed = 0;
      for (const hash of sampled) {
        try {
          const { author, email } = await getCommitInfo(hash);
          const diff = await getCommitDiff(hash);

          if (diff) {
            const { codeSnippets: cs, commentSnippets: cms } = extractSnippetsFromDiff(
              diff, author, email, hash, selected
            );

            codeSnippets.push(...cs);
            commentSnippets.push(...cms);
          }

          processed++;
          if (processed % 30 === 0) {
            setLoadingMessage(`正在扫描代码提交... (${processed}/${sampled.length})`);
          }
        } catch {
          // 忽略单个提交错误
        }
      }

      // 去重
      setLoadingMessage("正在处理代码片段...");
      codeSnippets = deduplicateSnippets(codeSnippets);
      commentSnippets = deduplicateSnippets(commentSnippets);

      // Velocity 分析
      setLoadingMessage("正在分析提交速度...");
      const velocity = await analyzeDailyVelocity(commitHashes, selected);

      // 分离自己和别人的片段
      const myCode = codeSnippets.filter(s => s.isMyCode);
      const otherCode = codeSnippets.filter(s => !s.isMyCode);
      const myComments = commentSnippets.filter(s => s.isMyCode);
      const otherComments = commentSnippets.filter(s => !s.isMyCode);

      const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

      // 准备代码记忆题：混合自己和别人的代码
      const myCodeCount = Math.min(Math.ceil(MEMORY_QUESTIONS * 0.6), myCode.length);
      const otherCodeCount = Math.min(MEMORY_QUESTIONS - myCodeCount, otherCode.length);
      const finalMyCodeCount = Math.min(MEMORY_QUESTIONS - otherCodeCount, myCode.length);

      const memQs = shuffle([
        ...shuffle(myCode).slice(0, finalMyCodeCount),
        ...shuffle(otherCode).slice(0, otherCodeCount),
      ]);

      // 准备注释判断题
      const myCommentCount = Math.min(Math.ceil(COMMENT_QUESTIONS * 0.6), myComments.length);
      const otherCommentCount = Math.min(COMMENT_QUESTIONS - myCommentCount, otherComments.length);
      const finalMyCommentCount = Math.min(COMMENT_QUESTIONS - otherCommentCount, myComments.length);

      const commentQs = shuffle([
        ...shuffle(myComments).slice(0, finalMyCommentCount),
        ...shuffle(otherComments).slice(0, otherCommentCount),
      ]);

      setAllCodeSnippets(codeSnippets);
      setAllCommentSnippets(commentSnippets);
      setVelocityData(velocity);
      setMemoryQuestions(memQs);
      setCommentQuestions(commentQs);

      if (memQs.length < 3) {
        setError(`代码片段太少了！需要更多的提交历史才能进行测试。`);
        return;
      }

      setPhase("ready");
    } catch (e) {
      setError(`扫描失败: ${e}`);
    }
  }

  function handleAuthorSelect(selected: string[]) {
    if (selected.length === 0) {
      exit();
      return;
    }
    const selectedSet = new Set(selected);
    setSelectedAuthors(selectedSet);
    scanCode(selectedSet);
  }

  function startGame() {
    setMemoryIndex(0);
    setCommentIndex(0);

    const myCodeInMemory = memoryQuestions.filter(s => s.isMyCode).length;
    const myCodeInComment = commentQuestions.filter(s => s.isMyCode).length;

    setResult({
      memory: { total: memoryQuestions.length, myCodeTotal: myCodeInMemory, answers: [] },
      comment: { total: commentQuestions.length, myCodeTotal: myCodeInComment, answers: [] },
      velocity: velocityData,
    });
    setPhase("memory");
  }

  function handleMemoryAnswer(answer: AnswerType) {
    const currentSnippet = memoryQuestions[memoryIndex];
    if (!currentSnippet) return;

    setResult((prev) => ({
      ...prev,
      memory: {
        ...prev.memory,
        answers: [...prev.memory.answers, { type: answer, isMyCode: currentSnippet.isMyCode }],
      },
    }));

    const nextIndex = memoryIndex + 1;
    if (nextIndex < memoryQuestions.length) {
      setMemoryIndex(nextIndex);
    } else {
      if (commentQuestions.length > 0) {
        setCommentIndex(0);
        setPhase("comment");
      } else {
        setPhase("result");
      }
    }
  }

  function handleCommentAnswer(answer: AnswerType) {
    const currentSnippet = commentQuestions[commentIndex];
    if (!currentSnippet) return;

    setResult((prev) => ({
      ...prev,
      comment: {
        ...prev.comment,
        answers: [...prev.comment.answers, { type: answer, isMyCode: currentSnippet.isMyCode }],
      },
    }));

    const nextIndex = commentIndex + 1;
    if (nextIndex < commentQuestions.length) {
      setCommentIndex(nextIndex);
    } else {
      setPhase("result");
    }
  }

  useInput((input, key) => {
    if (phase === "result") {
      exit();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Banner />
        <Text color="red">❌ 错误: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Banner />

      {phase === "loading" && <LoadingScreen message={loadingMessage} />}

      {phase === "select-author" && (
        <AuthorSelectScreen authors={authors} onSelect={handleAuthorSelect} />
      )}

      {phase === "scanning" && <LoadingScreen message={loadingMessage} />}

      {phase === "ready" && (
        <Box flexDirection="column" marginY={1}>
          <Text color="green">✅ 扫描完成！</Text>
          <Text dimColor>   已准备好测试题目</Text>
          <Newline />
          <Text bold>🎮 准备开始测试！</Text>
          <Text dimColor>   共 {memoryQuestions.length + commentQuestions.length} 道题 ({memoryQuestions.length} 道代码题 + {commentQuestions.length} 道注释题)</Text>
          <Newline />
          <Select
            options={[{ label: "开始测试", value: "start" }]}
            onChange={startGame}
          />
        </Box>
      )}

      {phase === "memory" && memoryQuestions[memoryIndex] && (
        <MemoryQuestionScreen
          key={`memory-${memoryIndex}`}
          code={memoryQuestions[memoryIndex].code}
          questionNum={memoryIndex + 1}
          totalQuestions={memoryQuestions.length}
          onAnswer={handleMemoryAnswer}
        />
      )}

      {phase === "comment" && commentQuestions[commentIndex] && (
        <CommentQuestionScreen
          key={`comment-${commentIndex}`}
          comment={commentQuestions[commentIndex].comment}
          context={commentQuestions[commentIndex].context}
          questionNum={commentIndex + 1}
          totalQuestions={commentQuestions.length}
          onAnswer={handleCommentAnswer}
        />
      )}

      {phase === "result" && <ResultScreen result={result} />}
    </Box>
  );
}

// ============================================================================
// Entry Point
// ============================================================================

const isRawModeSupported = process.stdin.isTTY;

if (!isRawModeSupported) {
  console.log("\n❌ 错误: 请在交互式终端中运行此命令！");
  console.log("   提示: 直接在终端中运行 `bun run d:/vibe-score/index.tsx`\n");
  process.exit(1);
}

render(<App />);
