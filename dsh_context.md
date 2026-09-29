# DeepSeek Harness (DSH) Modular Tools Integration Architecture

## Overview
This document outlines the architecture and integration strategy for utilizing **DeepSeek Harness (DSH)** tool plugins within the custom **Autonomous Agentic Platform**.

Rather than cloning or maintaining the entire 1.5 GB `deepseek-harness` monorepo (which contains web servers, GUI components, and build artifacts), the platform selectively imports **only the required DSH tool packages**.

---

## Core Principles

1. **Selective Tool Extraction**: Import only essential tool packages directly via NPM (saving ~1.5 GB disk space and reducing bundle size to a few megabytes).
2. **Human-in-the-Loop Control**: The platform handles high-level agent planning, reasoning, and human approval UI. Tools execute only after explicit human authorization.
3. **Decoupled Tool Execution**: DSH tools handle production-grade filesystem manipulation, terminal execution, and searching cleanly without custom tool maintenance.

---

## Selected DSH Tool Packages

| Package | Purpose | Functionality |
|---|---|---|
| **`@deepseek-ai/dsh-tool-bash`** | Terminal Execution | Runs shell commands safely with timeouts, PTY output, and background task controls. |
| **`@deepseek-ai/dsh-tool-str-replace-editor`** | Code Editing | Performs exact string replacements, file views, and multi-chunk diff edits. |
| **`@deepseek-ai/dsh-tool-fs-search`** | Code Search | Fast `ripgrep` pattern matching across repository files. |
| **`@deepseek-ai/dsh-tool-fs`** | Filesystem Ops | List directories, read file snippets, and inspect project file structures. |
| **`@deepseek-ai/dsh-tool-web`** | Web Intelligence | Web searches and webpage text/markdown content extraction. |

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────┐
│              Autonomous Agentic Platform                │
│ (Agent Reasoning, LLM Planner, Human-Approval UI/Loop)  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            │ 1. Agent proposes tool call
                            │ 2. Platform prompts human for approval
                            │ 3. Human clicks [APPROVE]
                            │ 4. Invokes DSH tool execution
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   DSH Tool Engine                       │
│  (@deepseek-ai/dsh-tool-bash, str-replace-editor, etc) │
└─────────────────────────────────────────────────────────┘
```

---

## Sample Project Implementation Structure

### 1. `package.json`
```json
{
  "name": "agentic-platform",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@deepseek-ai/dsh-tool-bash": "^0.1.0",
    "@deepseek-ai/dsh-tool-fs": "^0.1.0",
    "@deepseek-ai/dsh-tool-fs-search": "^0.1.0",
    "@deepseek-ai/dsh-tool-str-replace-editor": "^0.1.0",
    "@deepseek-ai/dsh-tool-web": "^0.1.0"
  }
}
```

### 2. Tool Registry (`src/tools/registry.ts`)
```typescript
import { bashTool } from '@deepseek-ai/dsh-tool-bash';
import { strReplaceEditorTool } from '@deepseek-ai/dsh-tool-str-replace-editor';
import { fsSearchTool } from '@deepseek-ai/dsh-tool-fs-search';
import { fsTool } from '@deepseek-ai/dsh-tool-fs';
import { webTool } from '@deepseek-ai/dsh-tool-web';

export const dshTools = [
  bashTool,
  strReplaceEditorTool,
  fsSearchTool,
  fsTool,
  webTool,
];

/**
 * Returns OpenAI / LLM-compatible tool schemas for agent prompt construction.
 */
export function getDshToolSchemas() {
  return dshTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    },
  }));
}
```

### 3. Execution with Human Approval (`src/tools/executor.ts`)
```typescript
import { dshTools } from './registry';

export async function executeToolWithApproval(
  toolName: string,
  args: Record<string, unknown>,
  context: { cwd: string }
) {
  const tool = dshTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" is not registered in DSH tool registry.`);
  }

  // Execute the approved tool action
  const output = await tool.execute(args, context);
  return output;
}
```

---

## Benefits Summary

- **Storage Optimization**: Reduced disk footprint from **~1.5 GB** down to **< 10 MB**.
- **Security & Safety**: Complete platform ownership over human approval before execution.
- **Fast Build Times**: No monorepo compilation; quick npm installs for CI/CD pipelines.
- **Maintainability**: Zero custom tool maintenance—leverage well-tested DSH tool definitions.
