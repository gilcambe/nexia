'use strict';
/**
 * Kernex Finance, divisão automática do salário 50/30/20 (melhoria 7).
 * Exporta divisaoSalario({ liquido, fixas }) e agirDivisao(acao, body, c) para a ação 'divisao_salario'.
 * Devolve null para qualquer outra ação.
 */
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;
const centavos = (n) => {
  const v = numero(n);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};
const deCentavos = (c) => dinheiro(c / 100);

function divisaoSalario({ liquido, fixas } = {}) {
  const L = centavos(liquido);
  const F = centavos(fixas);
  if (!Number.isFinite(L) || L <= 0) return { liquido: 0, partes: [] };

  const metade = Math.floor(L / 2);
  const vinte = Math.floor((L * 20) / 100);

  // Necessidades pega o maior entre as contas fixas e a metade do líquido.
  // Quando as fixas passam do líquido, elas ficam inteiras e livre/guardar zeram (nunca negativos).
  const necessidades = Math.max(F, metade);

  const restante = Math.max(0, L - necessidades);
  const guardar = Math.min(vinte, restante);
  const livre = Math.max(0, restante - guardar);

  const pct = (valor) => L > 0 ? dinheiro((valor / L) * 100) : 0;
  const partes = [
    { id: 'necessidades', nome: 'Necessidades', valor: deCentavos(necessidades), pct: pct(necessidades) },
    { id: 'livre', nome: 'Livre', valor: deCentavos(livre), pct: pct(livre) },
    { id: 'guardar', nome: 'Guardar', valor: deCentavos(guardar), pct: pct(guardar) }
  ];
  return { liquido: deCentavos(L), partes };
}

async function agirDivisao(acao, body, c) {
  if (acao !== 'divisao_salario') return null;
  const { base, agoraIso } = c || {};
  const mes = texto(body && body.mes, 7) || (agoraIso ? agoraIso.slice(0, 7) : '');

  const lerSalario = async () => {
    try {
      return await require('./salario').agirSalario('salario_previsao', { mes }, c);
    } catch {
      return null;
    }
  };

  const lerOrcamento = async () => {
    try {
      if (!base || typeof base.collection !== 'function') return null;
      const s = await base.collection('orcamento').doc('atual').get();
      return s && s.exists ? s.data() : null;
    } catch {
      return null;
    }
  };

  const [sp, orc] = await Promise.all([lerSalario(), lerOrcamento()]);

  let totalFixas = 0;
  if (body && Array.isArray(body.fixas)) {
    for (const f of body.fixas) {
      const v = numero(f && f.valor);
      if (Number.isFinite(v) && v > 0) totalFixas += v;
    }
  } else if (body && Number.isFinite(numero(body.fixas))) {
    totalFixas = numero(body.fixas);
  } else if (orc && Array.isArray(orc.fixas)) {
    for (const f of orc.fixas) {
      const v = numero(f && f.valor);
      if (Number.isFinite(v) && v > 0) totalFixas += v;
    }
  }

  let liquido = 0;
  if (body && body.liquido !== undefined && Number.isFinite(numero(body.liquido))) {
    liquido = numero(body.liquido);
  } else {
    const d = sp && sp[0] === 200 ? sp[1] : null;
    if (d) {
      if (d.previsao) {
        liquido = (Number(d.previsao.liquido) || 0) + (Number(d.previsao.extras) || Number(d.extras) || 0);
      }
      if (!liquido) {
        liquido = (Number(d.total_recebido) || 0) + (Number(d.total_a_receber) || 0);
      }
      if (!liquido && Number.isFinite(numero(d.liquido))) {
        liquido = numero(d.liquido);
      }
    }
  }
  if (!Number.isFinite(liquido) || liquido < 0) liquido = 0;

  const resultado = divisaoSalario({ liquido: dinheiro(liquido), fixas: dinheiro(totalFixas) });
  return [200, { mes, ...resultado }];
}

module.exports = { divisaoSalario, agirDivisao };
