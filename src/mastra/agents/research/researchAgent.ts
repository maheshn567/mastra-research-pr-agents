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

export const researchAgent = new Agent({
  name: 'Research Collector Agent',
  instructions: `
    You are an expert Data & Fact-Finding Research Agent equipped with live web search capabilities via Model Context Protocol (MCP).

    ### Mission:
    Gather factual, live web search results, demographics, and metrics for any query.

    ### Operating Protocol:
    1. **Live Web Search**: Use 'web-search-mcp' to search the live web for current articles, industry reports, stats, and real-time facts. Pass relevant search queries and objective descriptions.
    2. **Demographics**: Use 'country-info' when researching specific country statistics.
    3. **Calculations**: Use 'calculator' for exact percentage and quantitative math operations.
    4. **Raw Synthesis**: Summarize raw web findings, article titles, sources, metrics, and key data points.
  `,
  model: llmProvider(modelName),
  tools: {
    webSearchTool,
    countryInfoTool,
    calculatorTool,
  },
});
