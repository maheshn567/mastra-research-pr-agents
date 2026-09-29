# PR Reviewer Agent System: Context & Architecture

This document tracks the technical context, architecture, tools, agents, and workflows for the **Automated GitHub PR Reviewer & Interactive Human Approval System**.

---

## 🎯 Overview

The **PR Reviewer System** is an AI-powered code auditing tool built with Mastra, DeepSeek Harness plugins, and GitHub's REST API. It fetches PR git diff patches and file modifications directly from GitHub, executes deterministic security/AST scans & DeepSeek harness plugin tools, runs parallel quality and performance audits, synthesizes an executive PR report, and **interactively prompts the human reviewer with options (`yes` / `no` / `view`) before posting to GitHub**.

---

## 🏗️ Interactive System Architecture

```
GitHub Repository / PR Input (owner, repo, pullNumber)
   │
   ▼
Step 1: fetchPRStep ──► githubPRTool (src/mastra/tools/githubPRTool.ts)
   │
   ▼
Step 2: auditPRStep ──► prSecurityScannerTool (Deterministic Secret Scanner)
                    ──► prASTAnalyzerTool (Static AST Code Quality Inspector)
                    ──► deepseekHarnessTool (DeepSeek Harness Cordis Plugin Framework)
                    ──► qualityAgent (Code Quality, Types, Error Handling)
                    ──► performanceAgent (Complexity, Memory Leaks, Async)
   │
   ▼
Step 3: reviewSynthesisStep ──► prReviewerAgent (Generates PR Review Report)
   │
   ▼
Interactive Human Approval Loop (src/prIndex.ts)
   ├── Type "yes"  ──► postPRReviewTool (Publishes Exact Review to GitHub)
   ├── Type "view" ──► Prints Full Line-by-Line Markdown Comment in Terminal
   └── Type "no"   ──► Prompts for Feedback ──► Re-generates with prReviewerAgent
```

---

## 🛠️ Tools (`src/mastra/tools/`)

1. **`githubPRTool.ts`**: Fetches PR metadata, commit SHAs, file lists, and patch diffs.
2. **`postPRReviewTool.ts`**: Submits GitHub reviews with auto-retry support for 503 errors.
3. **`prSecurityScannerTool.ts`**: Deterministic scanner for hardcoded API keys, JWT secrets, and AWS tokens.
4. **`prASTAnalyzerTool.ts`**: Static AST code analyzer for TypeScript types, console statements, and localhost fallbacks.
5. **`deepseekHarnessTool.ts`**: DeepSeek Harness (`@deepseek-ai/dsh`) plugin adapter built on `cordis` framework.
6. **`webPageCleanerTool.ts`**: HTML boilerplate cleaner converting search pages to token-efficient Markdown.

---

## 🤖 Agents (`src/mastra/agents/pr/`)

1. **`qualityAgent.ts`**: Audits code quality, type safety, and clean code principles.
2. **`performanceAgent.ts`**: Audits time/space complexity, memory leaks, and async bottlenecks.
3. **`prReviewerAgent.ts`**: Master PR Reviewer & feedback refinement agent.

---

## 🔑 Environment Configuration (`.env`)

- `GITHUB_TOKEN`: Fine-grained Personal Access Token with `Pull requests (Read & write)` permissions.
