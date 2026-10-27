// Tabela de preços por provedor/modelo (valor por 1.000 tokens).
// Valores em reais. Modelos não listados são tratados como grátis (0).
export const PRECOS_POR_MODELO = {
  openai: {
    "gpt-4o-mini": { entrada: 0.0015, saida: 0.0060 },
    "gpt-4o": { entrada: 0.0050, saida: 0.0150 },
    "gpt-3.5-turbo": { entrada: 0.0005, saida: 0.0015 },
  },
  anthropic: {
    "claude-3-haiku": { entrada: 0.00025, saida: 0.00125 },
    "claude-3-sonnet": { entrada: 0.0030, saida: 0.0150 },
    "claude-3-opus": { entrada: 0.0150, saida: 0.0750 },
  },
  groq: {
    "llama-3.1-8b": { entrada: 0, saida: 0 },
    "llama-3.1-70b": { entrada: 0, saida: 0 },
    "mixtral-8x7b": { entrada: 0, saida: 0 },
  },
};

// Retorna o preço unitário (por 1.000 tokens) de entrada ou saída.
// Retorna 0 quando não há preço cadastrado para o provedor/modelo.
export function precoUnitario(provedor, modelo, tipo = "entrada") {
  const porProvedor = PRECOS_POR_MODELO[provedor];
  if (!porProvedor) return 0;
  const info = porProvedor[modelo];
  if (!info) return 0;
  return info[tipo] ?? 0;
}

// Calcula o custo total a partir de tokens de entrada e saída.
export function calcularCusto(tokensIn, tokensOut, provedor, modelo) {
  const inPrice = precoUnitario(provedor, modelo, "entrada");
  const outPrice = precoUnitario(provedor, modelo, "saída");
  return (tokensIn / 1000) * inPrice + (tokensOut / 1000) * outPrice;
}
