import { GROQ_LLAMA_INSTANT } from '../config/aiProviders.ts';
import type { AIProviderConfig } from '../config/aiProviders.ts';

export interface FactExtractorOptions {
  aiConfig?: AIProviderConfig;
  chatRunner?: (config: AIProviderConfig, systemPrompt: string, userPrompt: string) => Promise<string>;
}

// PII & Sensitive data filter rules
const SENSITIVE_PATTERNS = [
  // Passwords, Tokens, Keys
  /\b(senha|password|passwd|secret|token|api_?key|bearer|chave\s+privada|private_?key)\b/i,
  /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/,

  // CPF and CNPJ
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
  /\b(cpf|cnpj)[:\s]*\d+/i,

  // Detailed Health
  /\b(diagnóstico|laudo|doença|tratamento|medicamento|psiquiátri|oncolog|hiv|câncer|exame\s+de\s+sangue|prontuário)\b/i,

  // Financial secrets
  /\b(cartão\s+de\s+crédito|cvv|cartao\s+de\s+credito|código\s+de\s+segurança)\b/i,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
];

/**
 * Validates whether a fact candidate contains sensitive or prohibited information.
 */
export function isSensitiveFact(fact: string): boolean {
  if (!fact || typeof fact !== 'string') return true;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fact));
}

/**
 * Filters a list of raw extracted facts, removing any that contain sensitive info or exceed limits.
 */
export function filterSensitiveFacts(facts: string[]): string[] {
  if (!Array.isArray(facts)) return [];

  const cleanFacts: string[] = [];

  for (const rawFact of facts) {
    if (cleanFacts.length >= 3) break;
    if (typeof rawFact !== 'string') continue;

    const trimmed = rawFact.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 250) continue;

    if (!isSensitiveFact(trimmed)) {
      cleanFacts.push(trimmed);
    }
  }

  return cleanFacts;
}

const SYSTEM_PROMPT = `Você é um extrator de fatos duráveis do usuário.
Dada a conversa ou resposta, extraia até 3 fatos duráveis Relevantes sobre o usuário (ex: nome, localização, preferência, área de atuação, objetivos).

REGRAS RÍGIDAS:
1. Retorne SOMENTE um array JSON com no máximo 3 strings: ["fato 1", "fato 2", "fato 3"].
2. Se nenhum fato durável for encontrado, retorne um array vazio: [].
3. NUNCA inclua dados sensíveis: senhas, CPFs, chaves de API, segredos, saúde detalhada ou dados bancários.
4. Responda APENAS com o JSON, sem texto explicativo adicional.`;

/**
 * Default chat runner using nexia-ai model-router if available.
 */
async function defaultChatRunner(
  config: AIProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  try {
    // Dynamic require for Node environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const modelRouter = require('../../nexia-ai/model-router');
    const router = modelRouter.getRouter();
    const response = await router.chat(
      { provider: config.provider, model: config.model },
      {
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: config.maxTokens || 500,
        temperature: config.temperature || 0.1,
      }
    );
    return response.text || '';
  } catch (err) {
    return '';
  }
}

/**
 * Extracts up to 3 durable facts from a response text / user message context.
 */
export async function extractFacts(
  responseText: string,
  userMessage: string = '',
  options: FactExtractorOptions = {}
): Promise<string[]> {
  if (!responseText && !userMessage) return [];

  const aiConfig = options.aiConfig || GROQ_LLAMA_INSTANT;
  const runner = options.chatRunner || defaultChatRunner;

  const combinedContent = `MENSAGEM DO USUÁRIO:\n${userMessage}\n\nRESPOSTA DO ASSISTENTE:\n${responseText}`;

  let rawOutput = '';
  try {
    rawOutput = await runner(aiConfig, SYSTEM_PROMPT, combinedContent);
  } catch {
    rawOutput = '';
  }

  let parsed: string[] = [];
  if (rawOutput) {
    try {
      const match = rawOutput.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = JSON.parse(rawOutput);
      }
    } catch {
      parsed = [];
    }
  }

  // Fallback heuristic extraction if LLM didn't return valid JSON array
  if (!Array.isArray(parsed) || parsed.length === 0) {
    parsed = [];
    // Basic regex heuristic for clear durable user facts if present
    const nameMatch = userMessage.match(/meu nome é ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i) || responseText.match(/Seu nome é ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) parsed.push(`Nome do usuário: ${nameMatch[1]}`);

    const locMatch = userMessage.match(/moro em ([A-Za-z\s]+)/i) || responseText.match(/localizad[oa] em ([A-Za-z\s]+)/i);
    if (locMatch) parsed.push(`Localização do usuário: ${locMatch[1].trim()}`);

    const prefMatch = userMessage.match(/prefiro ([A-Za-z0-9\s]+)/i);
    if (prefMatch) parsed.push(`Preferência do usuário: ${prefMatch[1].trim()}`);
  }

  return filterSensitiveFacts(parsed);
}
