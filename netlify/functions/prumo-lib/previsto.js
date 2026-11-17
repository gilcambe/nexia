'use strict';
/**
 * Kernex Finance: dinheiro PREVISTO x REALIZADO.
 * Regra do dono (17/11): recebimento ou gasto com data DEPOIS de hoje é "previsto" e só conta como recebido/pago
 * depois que o dinheiro cair. No dia da data vira realizado sozinho (sem cron): calcula-se na LEITURA.
 *   - sem campo status e data <= hoje        -> realizado
 *   - sem campo status e data  > hoje        -> previsto (cobre lançamentos antigos)
 *   - status 'realizado' (botão Caiu/Paguei) -> realizado, mesmo com data futura
 *   - status 'previsto' e data > hoje        -> previsto
 * Dados só em c.base.collection (nada em arquivo). Usa as coleções que já existem: lancamentos e pagamentos.
 */
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;
const CAMPO = { lancamentos: 'data', pagamentos: 'data_pagamento' };
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cent = (v) => Math.round((Number(v) || 0) * 100);

/** "Hoje" no Brasil (UTC-3) a partir do relógio do servidor. */
function hojeDe(agoraIso) {
  const t = Date.parse(agoraIso);
  return new Date((Number.isFinite(t) ? t : Date.now()) - 3 * 3600000).toISOString().slice(0, 10);
}
/** Status com que um item NASCE. */
function statusInicial(data, hoje) { return DATA.test(String(data)) && String(data) > hoje ? 'previsto' : 'realizado'; }
/** Status de leitura. */
function statusDe(item, campo, hoje) {
  if (!item || item.status === 'realizado') return 'realizado';
  const d = String(item[campo] || '');
  return DATA.test(d) && d > hoje ? 'previsto' : 'realizado';
}
const realizados = (lista, campo, hoje) => (lista || []).filter((x) => statusDe(x, campo, hoje) === 'realizado');
const previstos = (lista, campo, hoje) => (lista || []).filter((x) => statusDe(x, campo, hoje) === 'previsto');

function dataNoMes(mes, dia) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, '0')}`;
}

/** "A receber" e "a pagar" do mês: só previstos. Parcela de dívida ainda não vencida no mês atual entra em a_pagar. */
function resumoPrevisto({ lancs, pagamentos, dividas }, mes, hoje) {
  const itens = [];
  for (const l of previstos((lancs || []).filter((x) => x.perfil !== 'pj'), 'data', hoje)) {
    if (!String(l.data).startsWith(mes)) continue;
    if (l.tipo === 'receita') itens.push({ tipo: 'receber', origem: 'lancamento', id: l.id, colecao: 'lancamentos', nome: l.descricao, data: l.data, valor: l.valor });
    else if (l.tipo === 'despesa') itens.push({ tipo: 'pagar', origem: 'lancamento', id: l.id, colecao: 'lancamentos', nome: l.descricao, data: l.data, valor: l.valor });
  }
  for (const p of previstos(pagamentos, 'data_pagamento', hoje)) {
    if (!String(p.data_pagamento).startsWith(mes)) continue;
    itens.push({ tipo: 'receber', origem: 'pagamento', id: p.id, colecao: 'pagamentos', nome: p.empresa || p.tipo, data: p.data_pagamento, valor: p.liquido });
  }
  if (mes === hoje.slice(0, 7)) {
    for (const d of dividas || []) {
      const dia = Number(d.dia_vencimento); const parcela = Number(d.parcela) || 0;
      if (!(parcela > 0) || !Number.isInteger(dia)) continue;
      const data = dataNoMes(mes, dia);
      if (data > hoje) itens.push({ tipo: 'pagar', origem: 'divida', id: d.id, colecao: null, nome: `Parcela ${d.credor || 'dívida'}`, data, valor: parcela });
    }
  }
  itens.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const soma = (t) => itens.filter((i) => i.tipo === t).reduce((s, i) => s + cent(i.valor), 0) / 100;
  return { mes, a_receber: soma('receber'), a_pagar: soma('pagar'), itens };
}

async function agirPrevisto(acao, body, c) {
  if (!['previsto_confirmar', 'previsto_adiar', 'previsto_resumo'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const hoje = hojeDe(agoraIso);
  if (acao === 'previsto_resumo') {
    const mes = texto(body.mes, 7) || hoje.slice(0, 7);
    if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
    const [lancs, pagamentos, dividas] = await Promise.all(['lancamentos', 'pagamentos', 'dividas'].map((k) => listar(base.collection(k))));
    return [200, resumoPrevisto({ lancs, pagamentos, dividas }, mes, hoje)];
  }
  const colecao = texto(body.colecao, 20);
  const campo = CAMPO[colecao];
  const id = texto(body.id, 120);
  if (!campo) return [400, { error: 'Esse tipo de item não pode ser confirmado.' }];
  if (!id) return [400, { error: 'Diga qual item.' }];
  const ref = base.collection(colecao).doc(id);
  const snap = await ref.get();
  if (!snap || !snap.exists) return [400, { error: 'Não achei esse item.' }];
  const item = snap.data() || {};
  if (acao === 'previsto_confirmar') {
    await ref.set({ ...item, status: 'realizado', confirmado_em: agoraIso });
    return [200, { ok: true, status: 'realizado' }];
  }
  const nova = texto(body.data, 10);
  if (!DATA.test(nova)) return [400, { error: 'Diga a nova data (AAAA-MM-DD).' }];
  if (nova <= hoje) return [400, { error: 'A nova data precisa ser depois de hoje.' }];
  const novo = { ...item, status: 'previsto', [campo]: nova, atualizado_em: agoraIso };
  if (colecao === 'pagamentos') novo.mes = item.mes || nova.slice(0, 7);
  await ref.set(novo);
  return [200, { ok: true, status: 'previsto', data: nova }];
}

module.exports = { agirPrevisto, hojeDe, statusInicial, statusDe, realizados, previstos, resumoPrevisto, CAMPO };
