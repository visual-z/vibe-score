# 🎮 Vibe Score

> Are you a Vibe Coder? 测试你对自己代码的记忆程度，看看你的 AI 编程依赖指数有多高。

<p align="center">
  <img src="https://img.shields.io/npm/v/vibe-score?style=flat-square" alt="npm version" />
  <img src="https://img.shields.io/npm/l/vibe-score?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/runtime-bun-f472b6?style=flat-square" alt="bun" />
</p>

## 什么是 Vibe Coding?

"Vibe Coding" 是一种编程状态：你写代码时进入心流，写完之后完全不记得自己写了什么。可能是因为：

- 🤖 大量使用 AI 辅助编程（Copilot、Cursor、ChatGPT...）
- 🌙 深夜编程，第二天完全忘记
- ☕ 咖啡因驱动的高效产出
- 🧘 真正的心流状态

**Vibe Score** 通过扫描你的 Git 历史，让你判断代码片段是否是自己写的，来评估你的 "Vibe Coding" 程度。

## 快速开始

> ⚠️ **注意**：本工具需要 [Bun](https://bun.sh) 运行时。如果你还没有安装 Bun，请先安装：
> ```bash
> # macOS / Linux
> curl -fsSL https://bun.sh/install | bash
> 
> # Windows (PowerShell)
> powershell -c "irm bun.sh/install.ps1 | iex"
> ```

### 使用 bunx（推荐）

```bash
# 在任意 Git 仓库目录下运行
cd your-project
bunx vibe-score
```

### 使用 npx

```bash
# 需要系统已安装 Bun
cd your-project
npx vibe-score
```

### 全局安装

```bash
# 使用 bun 安装
bun install -g vibe-score
vibe-score

# 或使用 npm 安装
npm install -g vibe-score
vibe-score
```

## 测试内容

### 🧠 代码记忆测试
展示来自你提交历史的代码片段（混合你的代码和他人的代码），让你判断：

- 💡 **我记得写过这段代码** - 明确记得，高信心认领
- 🤔 **看着眼熟，可能是我写的** - 感觉熟悉但不完全确定
- ❓ **不太确定是谁写的** - 无法判断来源
- 🚫 **这肯定不是我写的** - 确定是别人写的

### 💬 注释判断测试
展示代码注释，测试你是否记得自己写的注释。

### ⚡ 高产日分析
扫描你的提交记录，找出那些"非人类产出"的高产日（日均 500+ 行代码）。

## 评分系统

基于心理学的 **Remember-Know 范式** 设计，通过多维度分析你的代码记忆：

### Vibe Score 计算

```
Vibe Score = 遗忘率 × 50% + 模糊率 × 30% + 虚假记忆率 × 20%
```

- **遗忘率**：把自己的代码误认为别人的，或不确定
- **模糊率**：对自己的代码只有模糊印象
- **虚假记忆率**：把别人的代码误认为自己的（这是真正的 Vibe Coder 特征！）

### 称号系统

| 分数 | 称号 | 描述 |
|------|------|------|
| 0-10% | 🔨 代码手工艺人 | 对代码了如指掌，每一行都刻在 DNA 里 |
| 11-25% | 👴 传统程序员 | 记住每个变量名，respect！ |
| 26-40% | 🔋 混合动力开发者 | 人类智慧与 AI 辅助的平衡 |
| 41-55% | 😎 Vibe Coder | 写代码就像做梦，醒来只记得个大概 |
| 56-70% | 🎸 AI 协作大师 | 你负责需求，AI 负责实现 |
| 71-85% | 🎯 Prompt 工程师 | 代码只是提示词的副产品 |
| 86-99% | 🤖 人形 Copilot | 人机合一的境界 |
| 100% | 🎭 AI 傀儡 | 代码只是从你手指流过而已 |

## 特性

- 📊 **多语言支持** - JavaScript/TypeScript、Python、Go、Rust、Java、C/C++、Ruby、PHP 等 30+ 种语言
- 🎯 **智能去重** - 自动过滤相似代码片段，避免重复题目
- 🔀 **混合出题** - 混合自己和他人的代码，增加挑战性和准确性
- 🎨 **现代 TUI** - 基于 Ink (React for CLI) 的美观交互界面
- ⚡ **快速扫描** - 随机采样 2000 个提交，大型仓库也能快速完成
- 🧠 **心理学设计** - 基于 Remember-Know 范式，更准确评估记忆状态

## 系统要求

- **Bun** - 运行时环境（[安装指南](https://bun.sh)）
- **Git** - 需要在 Git 仓库中运行

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/anthropic-ai/vibe-score.git
cd vibe-score

# 安装依赖
bun install

# 运行
bun run start

# 在其他仓库测试
cd /path/to/your/project
bun run /path/to/vibe-score/index.tsx
```

## 工作原理

1. **扫描 Git 历史** - 获取最近 2000 个提交
2. **随机采样** - 从中随机选取 300 个进行深度分析
3. **提取代码片段** - 解析 diff，提取有意义的连续代码块
4. **智能过滤** - 排除 import/export、固定模式代码（如 React Hooks）
5. **去重处理** - 基于内容相似度去除重复片段
6. **混合出题** - 60% 你的代码 + 40% 他人代码，增加挑战
7. **心理学评估** - 基于 Remember-Know 范式计算 Vibe Score

## 支持的语言

JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, Scala, C, C++, C#, F#, Objective-C, Ruby, PHP, Swift, Dart, Lua, Shell, Perl, R, Elixir, Erlang, Haskell, Clojure, Zig, Nim, V, OCaml, SQL, Groovy 等。

## 灵感来源

受到 [Vibe Coding](https://en.wikipedia.org/wiki/Vibe_coding) 概念的启发 - 一种依赖 AI 大语言模型生成代码，而程序员本人可能不完全理解或记得代码内容的编程方式。

## License

MIT
