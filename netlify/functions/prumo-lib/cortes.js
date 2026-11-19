'use strict';
/**
 * Kernex Finance, fase 9: cortes de gasto com impacto anual e acompanhamento.
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 * d = { assinaturas: [{ nome, valor }], limites: [{ categoria, limite, gasto }] } (valores mensais).
 */
const STATUS = ['revisar', 'feito', 'ignorar', 'adiar'];
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;
const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function slug(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function prioridadeDe(impacto) {
  if (impacto >= 1200) return 'alta';
  if (impacto >= 300) return 'media';
  return 'baixa';
}

function oportunidadesCorte(d) {
  const assinaturas = Array.isArray(d && d.assinaturas) ? d.assinaturas : [];
  const limites = Array.isArray(d && d.limites) ? d.limites : [];
  const itens = [];
  for (const a of assinaturas) {
    const valor = numero(a && a.valor);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const mensal = dinheiro(valor);
    const impacto = dinheiro(mensal * 12);
    itens.push({
      id: `assinatura-${slug(a.nome)}`,
      tipo: 'assinatura',
      titulo: texto(a.nome, 80),
      evidencia: `Cobrança recorrente de ${brl(mensal)} por mês.`,
      mensal,
      impacto_anual: impacto,
      prioridade: prioridadeDe(impacto),
    });
  }
  for (const l of limites) {
    const limite = numero(l && l.limite);
    const gasto = numero(l && l.gasto);
    if (!Number.isFinite(limite) || !Number.isFinite(gasto) || gasto <= limite) continue;
    const mensal = dinheiro(gasto - limite);
    const impacto = dinheiro(mensal * 12);
    itens.push({
      id: `limite-${slug(l.categoria)}`,
      tipo: 'limite',
      titulo: texto(l.categoria, 80),
      evidencia: `Gasto de ${brl(gasto)} excede o limite de ${brl(limite)}.`,
      mensal,
      impacto_anual: impacto,
      prioridade: prioridadeDe(impacto),
    });
  }
  itens.sort((a, b) => b.impacto_anual - a.impacto_anual);
  return itens;
}

async function agirCorte(acao, body, c) {
  if (acao === 'cortes_listar') {
    const d = body && body.dados ? body.dados : body;
    return [200, { itens: oportunidadesCorte(d) }];
  }
  if (acao === 'corte_marcar') {
    const id = texto(body && body.id, 60);
    const status = texto(body && body.status, 20);
    if (!id) return [400, { error: 'Informe o id do corte.' }];
    if (!STATUS.includes(status)) return [400, { error: 'Status inválido. Use: ' + STATUS.join(', ') + '.' }];
    await base.collection('cortes_status').doc(id).set({ id, status, atualizado_em: agoraIso });
    return [200, { ok: true, id, status }];
  }
  return null;
}

module.exports = { oportunidadesCorte, STATUS, agirCorte };

