'use strict';
// Estimativa de custo por modelo (USD por 1 milhão de tokens).
// TEMPORÁRIO: tabela estática e incompleta. Motivo: a Fase 5 precisa de cost_estimate
// para o roteamento, e o custo real por execução (com a fatura do provedor) é da Fase 11.
// Risco: preço desatualizado; modelos fora da tabela retornam known:false (nunca 0).
// Remoção: Fase 11 (custo por execução medido).
const PRICES = [
  [/^claude-opus-4-[5-9]/, { input: 5, output: 25 }],
  [/^claude-sonnet-4/, { input: 3, output: 15 }],
  [/^claude-haiku-4-5/, { input: 1, output: 5 }],
  [/^gpt-4o-mini/, { input: 0.15, output: 0.6 }],
  [/^gpt-4o(?!-mini)/, { input: 2.5, output: 10 }],
  [/^deepseek-chat$|^deepseek-coder$/, { input: 0.27, output: 1.1 }],
  [/^deepseek-reasoner$/, { input: 0.55, output: 2.19 }],
];

function priceFor(provider, model) {
  // Modelos ":free" do OpenRouter não cobram por token.
  if (provider === 'openrouter' && /:free$/.test(model)) return { input: 0, output: 0 };
  if (!['anthropic', 'openai', 'deepseek', 'openrouter'].includes(provider)) return null;
  const hit = PRICES.find(([re]) => re.test(model));
  return hit ? hit[1] : null;
}

function costEstimate(provider, model, { input_tokens = 0, output_tokens = 0 } = {}) {
  const p = priceFor(provider, model);
  if (!p) return { known: false, usd: null, input_tokens, output_tokens };
  const usd = (input_tokens * p.input + output_tokens * p.output) / 1e6;
  return { known: true, usd: Math.round(usd * 1e6) / 1e6, input_tokens, output_tokens, per_million: p };
}

module.exports = { costEstimate, priceFor };
