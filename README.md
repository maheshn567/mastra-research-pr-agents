# Mastra Research & PR Agents

A TypeScript project built on the [Mastra](https://mastra.ai) agent framework. It contains two independent AI systems that share one LLM configuration:

1. **Deep Research Agent**: a multi-agent pipeline that searches the live web, evaluates its own findings, and produces a structured research report.
2. **Automated GitHub PR Reviewer**: a workflow that fetches a pull request, audits it for security, quality and performance issues, and posts a review to GitHub only after a human approves it. It can be triggered manually or automatically by a GitHub webhook.

## Features

### Deep Research Agent

- Three-stage workflow: research, analysis, and conclusion, each handled by a dedicated agent.
- Live web search through the Parallel AI remote MCP server.
- A self-evaluation loop: the analytics agent judges whether the research is sufficient and requests a targeted follow-up search when it is not (capped at two iterations).
- Supporting tools for country data and exact arithmetic, with schema-validated inputs.
- Produces a report with an executive summary, analysis, and actionable takeaways.

### Automated PR Reviewer

- Fetches PR metadata, changed files, and patch diffs from the GitHub REST API.
- Deterministic checks through a Cordis-based harness: hardcoded secret detection (GitHub, Groq and NVIDIA key patterns) and static analysis of TypeScript code.
- Two LLM audits: code quality and type safety, and performance and complexity.
- A reviewer agent that merges all findings into a single Markdown report.
- Human-in-the-loop approval: the report is shown in the terminal, and the reviewer can approve it, read the full text, or reject it with feedback to regenerate it. Nothing is posted without approval.
- Webhook mode: a listener receives GitHub `pull_request` events, verifies the HMAC signature, queues the review, and starts the same approval flow.

## Architecture

### Research pipeline

```
User query
   |
   v
Research agent ----> web search (MCP), country info, calculator
   |
   v
Analytics agent ---> sufficient? -- no --> targeted follow-up search (max 2 loops)
   |
   v
Conclusion agent --> final Markdown report
```

### PR review pipeline

```
GitHub webhook event (or CLI invocation)
   |
   v
fetch-pr-step       GitHub REST API: metadata, files, diffs
   |
   v
audit-pr-step       Secret scanner + AST analyzer + quality agent + performance agent
   |
   v
review-synthesis    Reviewer agent writes the report
   |
   v
Human approval      yes / view / no (with feedback and regeneration)
   |
   v
Post review         GitHub API, as a COMMENT review
```

## Project Structure

```
src/
  index.ts                     Entry point for the research workflow
  prIndex.ts                   CLI entry point for the PR reviewer
  prReviewFlow.ts              Shared review and approval loop
  webhookServer.ts             GitHub webhook listener
  mastra/
    index.ts                   Mastra instance (agents, tools, workflows)
    llm.ts                     Shared LLM provider configuration
    agents/
      research/                Research, analytics, conclusion, and master agents
      pr/                      Quality, performance, and reviewer agents
    workflows/
      research/                Research workflow and its steps
      pr/                      PR review workflow
    tools/                     GitHub fetch/post tools, harness tool, utility tools
  mcp/
    webSearchTool.ts           Parallel AI MCP web search client
```

## Tech Stack

- TypeScript on Node.js, run with `tsx`
- Mastra core (agents, tools, workflows)
- Vercel AI SDK with an OpenAI-compatible provider, so any compatible API can be used
- Cordis for the plugin-style analysis services
- Zod for input and output validation
- GitHub REST API and webhooks

## Getting Started

### Prerequisites

- Node.js 20 or later
- An API key for an OpenAI-compatible LLM provider (for example Groq or NVIDIA NIM)
- For the PR reviewer: a GitHub token and, for webhook mode, [ngrok](https://ngrok.com) or another tunnel

### Installation

```bash
git clone https://github.com/maheshn567/mastra-research-pr-agents.git
cd mastra-research-pr-agents
npm install
cp .env.example .env
```

### Configuration

Edit `.env`:

| Variable | Description |
| --- | --- |
| `API_KEY` | API key for the LLM provider |
| `API_BASE_URL` | OpenAI-compatible base URL (default: `https://api.groq.com/openai/v1`) |
| `MODEL_NAME` | Model identifier (default: `openai/gpt-oss-120b`) |
| `GITHUB_TOKEN` | GitHub token used to read PRs and post reviews |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify webhook signatures |
| `PORT` | Webhook server port (default: `8080`) |

Only `API_KEY` is required if you use a Groq key. To use a different OpenAI-compatible provider, also set `API_BASE_URL` and `MODEL_NAME`. The model must support tool calling.

The GitHub token needs access to the target repository with **Pull requests: Read and write** and **Contents: Read**.

## Usage

### Run the research agent

```bash
npm run research
```

The query is defined in `src/index.ts`.

### Review a pull request from the command line

```bash
npm run pr -- https://github.com/<owner>/<repo>/pull/<number>
```

The report is printed in the terminal. Answer `yes` to post it, `view` to read the full comment first, or `no` to give feedback and regenerate it. You can also set `PR_URL` in the environment instead of passing the argument.

### Run the webhook listener

1. Start the server:

   ```bash
   npm run webhook
   ```

2. Expose it with a tunnel:

   ```bash
   ngrok http 8080
   ```

3. In the GitHub repository, open Settings, Webhooks, and add a webhook:
   - Payload URL: `https://<your-tunnel-domain>/api/github/webhook`
   - Content type: `application/json`
   - Secret: the value of `GITHUB_WEBHOOK_SECRET`
   - Events: Pull requests

When a pull request is opened, updated, or reopened (drafts are ignored), the server runs the review and prompts for approval in its terminal. Health check: `GET /health`.

## Design Notes

- **Provider independence.** All agents read one shared configuration in `src/mastra/llm.ts`. Switching providers is a matter of changing three environment variables.
- **Human approval before side effects.** The only action that changes external state, posting to GitHub, is gated behind explicit approval. Reviews are always posted as `COMMENT`, never as approve or request changes.
- **Deterministic checks alongside LLMs.** Secret detection and static checks run as ordinary code, so critical findings do not depend on model output.
- **Webhook safety.** Signatures are verified with HMAC SHA-256 using a constant-time comparison. Reviews are queued one at a time because they share a terminal for approval prompts, and duplicate events for the same PR are skipped.
- **Token budget awareness.** Prompts and diffs are truncated and calls are spaced to stay within provider rate limits.

## Limitations

- Mastra runs with in-memory storage, so run history is lost on restart.
- Diffs are truncated before analysis, so very large pull requests are only partially reviewed.
- The webhook approval prompt requires an attended terminal.
- Token usage is not tracked by the application.
