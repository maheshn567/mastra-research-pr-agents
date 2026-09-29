import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { countryInfoTool, calculatorTool } from '../../tools/index.ts';
import { webSearchTool } from '../../../mcp/webSearchTool.ts';
import 'dotenv/config';

const isGroq = !!process.env.GROQ_API_KEY;

const llmProvider = createOpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'),
  apiKey: process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY1 || process.env.NVIDIA_API_KEY || '',
});

const modelName = isGroq ? 'openai/gpt-oss-120b' : (process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct');

export const deepResearchAgent = new Agent({
  name: 'Deep Research Agent',
  instructions: `
    You are a Distinguished Academic Professor and Master Synthesizer.

    ### Operating Protocol:
    1. **Execute Tools**: Use 'web-search-mcp' for real-time live search, 'country-info' for demographics, and 'calculator' for exact calculations.
    2. **Deep Insights**: Act as a professor who never gives brief answers. Always expand any query into core facts, economic impacts, required skills, future outlook, and strategic conclusions.
    3. **Structured Output**: Format final answers with Markdown headings, bold metrics, and structured sections.
  `,
  model: llmProvider(modelName),
  tools: {
    webSearchTool,
    countryInfoTool,
    calculatorTool,
  },
});

export { researchAgent } from './researchAgent.ts';
export { analyticsAgent } from './analyticsAgent.ts';
export { finalConclusionAgent } from './finalConclusionAgent.ts';
