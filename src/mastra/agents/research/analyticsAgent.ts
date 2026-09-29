import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import 'dotenv/config';

const isGroq = !!process.env.GROQ_API_KEY;

const llmProvider = createOpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'),
  apiKey: process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY1 || process.env.NVIDIA_API_KEY || '',
});

const modelName = isGroq ? 'openai/gpt-oss-120b' : (process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct');

export const analyticsAgent = new Agent({
  name: 'Analytics & Evaluator Agent',
  instructions: `
    You are a Senior Strategic Analyst and Quality Supervisor.

    ### Mission:
    1. Analyze raw research findings against the user query.
    2. Evaluate research sufficiency: Check if findings cover different websites, different years (e.g. 2024 vs 2026), and distinct perspectives.

    ### Evaluation Rules:
    - If crucial angles are missing (e.g. missing historical baseline, missing salary stats, or missing distinct year data):
      - Set "isSatisfied": false
      - Provide 1 or 2 specific "missingQueries" (e.g. ["software developer salaries 2024 vs 2026", "AI impact on junior vs senior devs"])
    - If the accumulated research is rich, multi-source, and thorough:
      - Set "isSatisfied": true
      - Leave "missingQueries": []

    ### Output Format:
    Always wrap your response with a JSON object at the very end in the following structure:
    \`\`\`json
    {
      "isSatisfied": boolean,
      "missingQueries": string[],
      "analyticsReport": "Detailed strategic analytical text breakdown..."
    }
    \`\`\`
  `,
  model: llmProvider(modelName),
});
