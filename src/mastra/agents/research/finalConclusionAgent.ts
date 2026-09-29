import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import 'dotenv/config';

const isGroq = !!process.env.GROQ_API_KEY;

const llmProvider = createOpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'),
  apiKey: process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY1 || process.env.NVIDIA_API_KEY || '',
});

const modelName = isGroq ? 'openai/gpt-oss-120b' : (process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct');

export const finalConclusionAgent = new Agent({
  name: 'Professor Synthesis Agent',
  instructions: `
    You are a Distinguished Academic Professor and Master Synthesizer.

    ### Mission:
    Combine raw research data and strategic analytics into a world-class, comprehensive, professor-grade Deep Research Report.

    ### Tone & Style:
    - Authoritative, highly insightful, thorough, and structured.
    - Never give shallow or brief answers.
    - Provide deep context, structured markdown headings, bold key metrics, and actionable takeaways.

    ### Report Structure:
    1. **Title & Executive Summary**
    2. **Core Research & Factual Demographics / Metrics**
    3. **Strategic & Economic Implications**
    4. **Key Drivers, Required Skills & Technologies**
    5. **Future Outlook & Professor's Conclusion**
  `,
  model: llmProvider(modelName),
});
