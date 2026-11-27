/**
 * Limites gratuitos dos provedores de IA (matriz de uso da Central).
 * Valores fictícios de exemplo; substituir pelos reais da matriz publicada.
 */
export const MATRIZ_FREE_LIMITS = {
  groq: { nome: "Groq", limiteDiario: 100 },
  gemini: { nome: "Gemini", limiteDiario: 60 },
  openrouter: { nome: "OpenRouter", limiteDiario: 50 },
  "workers-ai": { nome: "Workers AI", limiteDiario: 100 },
  mistral: { nome: "Mistral", limiteDiario: 40 },
  codestral: { nome: "Codestral", limiteDiario: 30 },
  kilo: { nome: "Kilo", limiteDiario: 50 },
};

export function limitePara(provedor) {
  return MATRIZ_FREE_LIMITS[provedor]?.limiteDiario;
}

export function nomePara(provedor) {
  return MATRIZ_FREE_LIMITS[provedor]?.nome || provedor;
}
