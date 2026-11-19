'use strict';
// Fase 9 do épico #4013 (manual CFO Pessoal, seção 8): cada oportunidade de economia tem evidência, impacto anual,
// prioridade e acompanhamento (revisar / feito / ignorar / adiar).
const STATUS = ['revisar', 'feito', 'ignorar', 'adiar'];
const r2 = (n) => Math.round(n * 100) / 100;
const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const prioridade = (anual) => (anual >= 1200 ? 'alta' : anual >= 300 ? 'media' : 'baixa');
const brl = (n) => 'R$ ' + r2(n).toFixed(2).replace('.', ',');

function oportunidadesCorte(d) {
  const dd = d || {};
  const out = [];
  for (const a of Array.isArray(dd.assinaturas) ? dd.assinaturas : []) {
    const v = Number(a && a.valor);
    if (!a || !a.nome || !(v > 0)) continue;
    out.push({ id: 'assinatura-' + chave(a.nome), tipo: 'assinatura', titulo: `Cancelar ou trocar "${a.nome}"`,
      evidencia: `Cobrança de ${brl(v)} que se repete todo mês.`, mensal: r2(v), impacto_anual: r2(v * 12) });
  }
  for (const l of Array.isArray(dd.limites) ? dd.limites : []) {
    const ex = r2(Number(l && l.gasto) - Number(l && l.limite));
    if (!l || !l.categoria || !(ex > 0)) continue;
    out.push({ id: 'limite-' + chave(l.categoria), tipo: 'limite', titulo: `Voltar ao limite de ${l.categoria}`,
      evidencia: `Gastou ${brl(Number(l.gasto))} com limite de ${brl(Number(l.limite))} neste mês.`, mensal: ex, impacto_anual: r2(ex * 12) });
  }
  for (const x of out) x.prioridade = prioridade(x.impacto_anual);
  return out.sort((a, b) => b.impacto_anual - a.impacto_anual);
}

async function agirCortes(acao, body, c) {
  if (acao !== 'corte_marcar' && acao !== 'cortes_listar') return null;
  const { base, listar, agoraIso } = c;
  const col = base.collection('cortes_status');
  if (acao === 'corte_marcar') {
    const id = typeof body.id === 'string' ? body.id.slice(0, 80) : '';
    if (!/^(assinatura|limite)-[a-z0-9-]+$/.test(id)) return [400, { error: 'Oportunidade inválida.' }];
    if (!STATUS.includes(body.status)) return [400, { error: 'Status precisa ser revisar, feito, ignorar ou adiar.' }];
    await col.doc(id).set({ id, status: body.status, atualizado_em: agoraIso });
    return [200, { ok: true, id, status: body.status }];
  }
  const prv = require('./previsto');
  const mes = String(agoraIso).slice(0, 7);
  const [lancs, gastos, limites, marcados] = await Promise.all([listar(base.collection('lancamentos')), listar(base.collection('gastos')), listar(base.collection('limites')), listar(col)]);
  const reais = prv.realizados(lancs.filter((x) => x.perfil !== 'pj'), 'data', prv.hojeDe(agoraIso));
  const porCat = {};
  for (const l of reais) if (l.tipo === 'despesa' && String(l.data).startsWith(mes)) porCat[l.categoria] = r2((porCat[l.categoria] || 0) + Number(l.valor || 0));
  const ass = require('./fluxo').assinaturas(reais, gastos).itens.map((a) => ({ nome: a.nome, valor: a.valor_mensal }));
  const consumo = require('./financas').consumoLimites(limites, porCat);
  const st = new Map(marcados.map((m) => [m.id, m.status]));
  const itens = oportunidadesCorte({ assinaturas: ass, limites: consumo }).map((x) => ({ ...x, status: st.get(x.id) || 'revisar' }));
  const abertos = itens.filter((x) => x.status === 'revisar' || x.status === 'adiar');
  return [200, { itens, impacto_anual_aberto: r2(abertos.reduce((s, x) => s + x.impacto_anual, 0)) }];
}

module.exports = { oportunidadesCorte, agirCortes, STATUS };
