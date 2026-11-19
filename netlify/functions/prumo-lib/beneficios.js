'use strict';
// Redesign fase 6 (plano, tela 7): Benefícios numa leitura só. Ação 'beneficios_resumo'.
// Quanto valem os pontos (saldo ÷ 1.000 × milheiro editável), o que vence em 30/60/90 dias e os cartões com
// anuidade e pontos por real. Nunca pede senha de programa: saldo vem de print ou digitação.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function resumoPontos(pontos, hoje) {
  const t0 = Date.parse(String(hoje).slice(0, 10));
  const programas = (pontos || []).map((p) => {
    const dias = p.validade ? Math.round((Date.parse(p.validade) - t0) / 86400000) : null;
    return { id: p.id, programa: p.programa, saldo: Number(p.saldo) || 0, validade: p.validade || null, dias, valor_milheiro: Number(p.valor_milheiro) || 0,
      valor: r2(((Number(p.saldo) || 0) / 1000) * (Number(p.valor_milheiro) || 0)), faixa: dias == null || dias < 0 ? null : dias <= 30 ? 30 : dias <= 60 ? 60 : dias <= 90 ? 90 : null };
  }).sort((a, b) => (a.dias == null ? 1e9 : a.dias) - (b.dias == null ? 1e9 : b.dias));
  return {
    total_pontos: programas.reduce((s, p) => s + p.saldo, 0),
    valor_estimado: r2(programas.reduce((s, p) => s + p.valor, 0)),
    programas,
    vencendo: programas.filter((p) => p.faixa && p.saldo > 0),
  };
}

async function agirBeneficios(acao, body, c) {
  if (acao !== 'beneficios_resumo') return null;
  const { base, listar, agoraIso } = c;
  const [pontos, cartoes] = await Promise.all([listar(base.collection('pontos')), listar(base.collection('cartoes'))]);
  const r = resumoPontos(pontos, agoraIso.slice(0, 10));
  return [200, { ...r, cartoes: cartoes.map((k) => ({ id: k.id, nome: k.nome, anuidade: Number(k.anuidade) || 0, pontos_por_real: Number(k.pontos_por_real) || 0, cashback_pct: Number(k.cashback_pct) || 0, programa: k.programa_pontos || null, beneficios: k.beneficios || null })),
    aviso: 'Valor estimado com o milheiro que você define. O app só lembra o que vence; promoções de transferência você confere no programa.' }];
}

module.exports = { agirBeneficios, resumoPontos };
