export interface AIProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export const GROQ_LLAMA_INSTANT: AIProviderConfig = {
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  temperature: 0.1,
  maxTokens: 500,
};

export const AI_PROVIDERS = {
  groqInstant: GROQ_LLAMA_INSTANT,
} as const;

export function getAIProviderConfig(name: keyof typeof AI_PROVIDERS = 'groqInstant'): AIProviderConfig {
  return AI_PROVIDERS[name] || GROQ_LLAMA_INSTANT;
}
