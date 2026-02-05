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

```bash
# 使用 npx（需要 Node.js 18+）
npx vibe-score

# 或者使用 bunx（推荐，更快）
bunx vibe-score
```

在任意 Git 仓库目录下运行即可。

## 测试内容

### 🧠 代码记忆测试
展示来自你提交历史的代码片段，让你判断：
- 💡 **我记得写过** - 明确记得这段代码
- 🤔 **看着眼熟** - 感觉熟悉但不确定
- ❓ **不太确定** - 无法判断来源
- 🚫 **肯定不是我的** - 确定是别人写的

### 💬 注释判断测试
展示代码注释，测试你是否记得自己写的注释。

### ⚡ 高产日分析
扫描你的提交记录，找出那些"非人类产出"的高产日（日均 500+ 行代码）。

## 评分系统

基于心理学的 **Remember-Know 范式** 设计：

| 分数 | 称号 | 描述 |
|------|------|------|
| 0-10% | 🔨 代码手工艺人 | 对代码了如指掌 |
| 11-25% | 👴 传统程序员 | 记住每个变量名 |
| 26-40% | 🔋 混合动力开发者 | 人类与 AI 的平衡 |
| 41-55% | 😎 Vibe Coder | 写完就忘，经典状态 |
| 56-70% | 🎸 AI 协作大师 | 你负责需求，AI 负责实现 |
| 71-85% | 🎯 Prompt 工程师 | 代码只是提示词的副产品 |
| 86-99% | 🤖 人形 Copilot | 人机合一的境界 |
| 100% | 🎭 AI 傀儡 | 代码只是从你手指流过 |

## 特性

- 📊 **多语言支持** - JavaScript/TypeScript、Python、Go、Rust、Java、C/C++、Ruby、PHP 等 30+ 种语言
- 🎯 **智能去重** - 自动过滤相似代码片段，避免重复题目
- 🔀 **混合出题** - 混合自己和他人的代码，增加挑战性
- 🎨 **现代 TUI** - 基于 Ink (React for CLI) 的美观界面
- ⚡ **快速扫描** - 随机采样提交历史，大型仓库也能快速完成

## 系统要求

- **Git** - 需要在 Git 仓库中运行
- **Node.js 18+** 或 **Bun** - 运行环境

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/你的用户名/vibe-score.git
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
2. **随机采样** - 从中随机选取 300 个进行分析
3. **提取代码片段** - 解析 diff，提取有意义的代码块
4. **智能过滤** - 排除 import/export、固定模式代码
5. **去重处理** - 基于内容相似度去除重复片段
6. **生成题目** - 混合自己和他人的代码/注释
7. **心理学评估** - 基于 Remember-Know 范式计算 Vibe Score

## 灵感来源

受到 [Vibe Coding](https://en.wikipedia.org/wiki/Vibe_coding) 概念的启发 - 一种依赖 AI 大语言模型生成代码，而程序员本人可能不完全理解或记得代码内容的编程方式。

## License

MIT
