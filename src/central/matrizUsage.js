/**
 * Limites grátis por provedor de IA (dados da matriz de IAs grátis).
 * Usado pelo DailySpendCard quando /api/usage (parte 2) não informa o limite.
 * Valores de referência da matriz; sem custo e sem cartão.
 */
export const MATRIX_FREE_LIMITS = {
  gemini: 1500,
  groq: 14400,
  cerebras: 1000,
  openrouter: 50,
  mistral: 1,
  deepseek: 50,
  claude: 20,
  openai: 20,
  cloudflare: 10000,
  codestral: 2000,
  nvidia: 40,
  kilo: 60,
  zai: 30,
};

export const DEFAULT_FREE_LIMIT = 0;

/** Limite grátis de um provedor pelo nome (case-insensitive). 0 = não informado. */
export function freeLimitOf(name) {
  const key = String(name || '').toLowerCase().trim();
  return MATRIX_FREE_LIMITS[key] ?? DEFAULT_FREE_LIMIT;
}

export default MATRIX_FREE_LIMITS;
