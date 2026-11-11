'use strict';
// Regra do último degrau "plano Claude Pro do dono" (11/11/2026). Função pura para testar.
// Regra do dono: tudo grátis; o Claude é a única paga e é usada o mínimo. A cota do plano é dividida com o uso
// pessoal do dono, então há teto diário (CONTRATO_CLAUDE_DIA, padrão 5) e desligar é só CONTRATO_CLAUDE_PRO=0.
function regraClaude(env = {}, usadosHoje = 0) {
  if (!env.CLAUDE_CODE_OAUTH_TOKEN) return { usar: false, motivo: 'sem CLAUDE_CODE_OAUTH_TOKEN (plano Pro não ligado)' };
  if (env.CONTRATO_CLAUDE_PRO === '0') return { usar: false, motivo: 'desligado (CONTRATO_CLAUDE_PRO=0)' };
  const teto = Math.max(0, Math.min(50, Number(env.CONTRATO_CLAUDE_DIA) || 5));
  if (usadosHoje >= teto) return { usar: false, motivo: `teto diário atingido (${usadosHoje}/${teto})` };
  return { usar: true, motivo: `ok (${usadosHoje}/${teto} hoje)`, teto };
}

module.exports = { regraClaude };
