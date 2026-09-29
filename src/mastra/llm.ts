import { createOpenAI } from '@ai-sdk/openai';
import 'dotenv/config';

/**
 * Shared LLM configuration for every agent.
 * Works with any OpenAI-compatible provider (Groq, NVIDIA NIM, OpenAI, etc.) via environment variables.
 */
export const llmProvider = createOpenAI({
  baseURL: process.env.API_BASE_URL || 'https://api.groq.com/openai/v1',
  apiKey: process.env.API_KEY || '',
});

export const modelName = process.env.MODEL_NAME || 'openai/gpt-oss-120b';
