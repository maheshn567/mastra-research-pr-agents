import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { githubPRTool } from '../../tools/githubPRTool.ts';
import { deepseekHarnessTool } from '../../tools/deepseekHarnessTool.ts';
import { qualityAgent } from '../../agents/pr/qualityAgent.ts';
import { performanceAgent } from '../../agents/pr/performanceAgent.ts';
import { prReviewerAgent } from '../../agents/pr/prReviewerAgent.ts';

// 1. Step 1: Fetch PR metadata & patch diffs from GitHub
const fetchPRStep = createStep({
  id: 'fetch-pr-step',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    pullNumber: z.number(),
  }),
  outputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    pullNumber: z.number(),
    prTitle: z.string(),
    prDescription: z.string(),
    author: z.string(),
    diffSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { owner, repo, pullNumber } = inputData;
    console.log(`\n🐙 [PR Fetcher Step] Retrieving PR #${pullNumber} from ${owner}/${repo}...`);

    const prDetails = await githubPRTool.execute({ owner, repo, pullNumber });

    // Format diff summary string (capped to 1200 chars to stay safely under Groq 8k TPM limits)
    const diffSummary = prDetails.files
      .map(
        (f) =>
          `File: ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\nPatch Diff:\n${(f.patch || '').substring(0, 600)}`
      )
      .join('\n\n---\n\n')
      .substring(0, 1400);

    return {
      owner,
      repo,
      pullNumber,
      prTitle: prDetails.prTitle,
      prDescription: prDetails.prDescription,
      author: prDetails.author,
      diffSummary,
    };
  },
});

// 2. Step 2: Audit Security, AST Quality, & Performance via DeepSeek Harness (DSH)
const auditPRStep = createStep({
  id: 'audit-pr-step',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    pullNumber: z.number(),
    prTitle: z.string(),
    prDescription: z.string(),
    author: z.string(),
    diffSummary: z.string(),
  }),
  outputSchema: z.object({
    prTitle: z.string(),
    prDescription: z.string(),
    author: z.string(),
    diffSummary: z.string(),
    qualityAudit: z.string(),
    performanceAudit: z.string(),
    securityScanSummary: z.string(),
    astAnalysisSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { prTitle, prDescription, author, diffSummary } = inputData;

    // A. Execute DeepSeek Harness (DSH) Cordis plugins for Security & AST analysis
    console.log(`\n🤖 [Audit Step] Executing DeepSeek Harness (DSH) Cordis plugins...`);
    const securityRes = await deepseekHarnessTool.execute({
      pluginName: 'dsh-security-scanner',
      inputData: diffSummary,
    });

    const astRes = await deepseekHarnessTool.execute({
      pluginName: 'dsh-ast-analyzer',
      inputData: diffSummary,
    });

    // B. Run LLM Quality & Performance evaluations
    console.log(`🔍 [Audit Step] Running Code Quality evaluation...`);
    const qualityPrompt = `Audit the following PR diff for code quality, type safety, and clean code principles:\n\n${diffSummary}`;
    const qualityRes = await qualityAgent.generateLegacy(qualityPrompt, { maxSteps: 2 });

    // Short 2s pause to refresh Groq TPM sliding window
    await new Promise((r) => setTimeout(r, 2000));

    console.log(`⚡ [Audit Step] Running Performance evaluation...`);
    const perfPrompt = `Audit the following PR diff for performance bottlenecks, time complexity, and memory leaks:\n\n${diffSummary}`;
    const perfRes = await performanceAgent.generateLegacy(perfPrompt, { maxSteps: 2 });

    return {
      prTitle,
      prDescription,
      author,
      diffSummary,
      qualityAudit: qualityRes.text,
      performanceAudit: perfRes.text,
      securityScanSummary: securityRes.summary,
      astAnalysisSummary: astRes.summary,
    };
  },
});

// 3. Step 3: Master PR Preview Synthesis
const reviewSynthesisStep = createStep({
  id: 'review-synthesis-step',
  inputSchema: z.object({
    prTitle: z.string(),
    prDescription: z.string(),
    author: z.string(),
    diffSummary: z.string(),
    qualityAudit: z.string(),
    performanceAudit: z.string(),
    securityScanSummary: z.string(),
    astAnalysisSummary: z.string(),
  }),
  outputSchema: z.object({
    prReviewReport: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { prTitle, prDescription, author, diffSummary, qualityAudit, performanceAudit, securityScanSummary, astAnalysisSummary } = inputData;
    console.log(`\n📝 [PR Synthesis Step] Generating executive PR Review & Preview Report...`);

    // Short 2s pause to refresh Groq TPM sliding window
    await new Promise((r) => setTimeout(r, 2000));

    const prompt = `Synthesize an executive GitHub Pull Request Review Report for:
    - **Title**: ${prTitle}
    - **Author**: @${author}
    - **Description**: ${prDescription}
    - **DeepSeek Harness Security Scan**: ${securityScanSummary}
    - **DeepSeek Harness AST Analysis**: ${astAnalysisSummary}

    ### Git Diff Summary:
    ${diffSummary}

    ### Code Quality Audit:
    ${qualityAudit.substring(0, 1000)}

    ### Performance Audit:
    ${performanceAudit.substring(0, 1000)}
    `;

    const response = await prReviewerAgent.generateLegacy(prompt, { maxSteps: 3 });

    return {
      prReviewReport: response.text,
    };
  },
});

// 4. Connect Workflow Pipeline
export const prReviewWorkflow = createWorkflow({
  id: 'pr-review-workflow',
  inputSchema: z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    pullNumber: z.number().describe('GitHub Pull Request number'),
  }),
  outputSchema: z.object({
    prReviewReport: z.string(),
  }),
})
  .then(fetchPRStep)
  .then(auditPRStep)
  .then(reviewSynthesisStep)
  .commit();

export default prReviewWorkflow;
