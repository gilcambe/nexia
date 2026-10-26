export const AI_PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    apiKeyEnv: 'GROQ_API_KEY',
  },
} as const;

export function groqApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada');
  return key;
}

export async function groqChat(messages: { role: string; content: string }[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const res = await fetch(AI_PROVIDERS.groq.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.groq.model,
      temperature: opts?.temperature ?? 0,
      max_tokens: opts?.maxTokens ?? 500,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
