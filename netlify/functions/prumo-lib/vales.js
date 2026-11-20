'use strict';
// Dono 20/11: "não consegui cadastrar o vale refeição". Vale refeição/alimentação (Ticket, VR, Alelo, Sodexo...):
// saldo, recarga do mês e dia da recarga. A recarga entra sozinha no dia (calculada na leitura, sem robô).
// Gasto no vale vira lançamento (categoria alimentação, meio 'vale') e baixa o saldo; não mexe no "Tenho" (não é dinheiro em conta).
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const TIPOS = { refeicao: 'Vale refeição', alimentacao: 'Vale alimentação', outro: 'Outro benefício' };
const num = (v) => (typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')));

function validarVale(o) {
  const nome = String((o && o.nome) || '').trim().slice(0, 60);
  if (!nome) return { ok: false, erro: 'Escreva o nome do vale (ex.: Ticket Restaurante).' };
  const saldo = num(o.saldo === '' || o.saldo == null ? 0 : o.saldo);
  const recarga = num(o.recarga === '' || o.recarga == null ? 0 : o.recarga);
  const dia = o.dia_recarga === '' || o.dia_recarga == null ? null : Math.round(Number(o.dia_recarga));
  if (!Number.isFinite(saldo) || saldo < 0) return { ok: false, erro: 'O saldo precisa ser um número igual ou maior que zero.' };
  if (!Number.isFinite(recarga) || recarga < 0) return { ok: false, erro: 'A recarga precisa ser um número igual ou maior que zero.' };
  if (dia !== null && !(dia >= 1 && dia <= 31)) return { ok: false, erro: 'O dia da recarga vai de 1 a 31.' };
  return { ok: true, item: { nome, tipo: TIPOS[o.tipo] ? o.tipo : 'refeicao', saldo: r2(saldo), recarga: r2(recarga), dia_recarga: dia } };
}

/** Aplica a recarga do mês se o dia já chegou e ainda não foi aplicada. Devolve o vale novo (ou o mesmo). */
function comRecarga(v, hoje) {
  const mes = hoje.slice(0, 7); const dia = Number(hoje.slice(8, 10));
  if (!(v.recarga > 0) || !v.dia_recarga || v.ultima_recarga >= mes || dia < v.dia_recarga) return v;
  return { ...v, saldo: r2((Number(v.saldo) || 0) + v.recarga), ultima_recarga: mes };
}
function mesAnterior(mes) { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; }

async function agirVales(acao, body, c) {
  if (!['vale_salvar', 'vale_listar', 'vale_gasto', 'vale_apagar'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const prv = require('./previsto'); const hoje = prv.hojeDe(agoraIso);
  const col = base.collection('vales');
  const id = String(body.id || '').slice(0, 60);
  if (acao === 'vale_salvar') {
    const v = validarVale(body); if (!v.ok) return [400, { error: v.erro }];
    const novo = id || ('vl' + Date.now().toString(36));
    // O saldo informado hoje já inclui a recarga deste mês se o dia já passou.
    const ultima = v.item.dia_recarga && Number(hoje.slice(8, 10)) >= v.item.dia_recarga ? hoje.slice(0, 7) : mesAnterior(hoje.slice(0, 7));
    await col.doc(novo).set({ ...v.item, ultima_recarga: ultima, atualizado_em: agoraIso });
    return [200, { ok: true, id: novo }];
  }
  if (acao === 'vale_apagar') { if (!id) return [400, { error: 'Diga qual vale apagar.' }]; await col.doc(id).delete(); return [200, { ok: true }]; }
  const vales = await listar(col);
  const atualizados = [];
  for (const v of vales) { const n = comRecarga(v, hoje); if (n !== v) { const { id: vid, ...dados } = n; await col.doc(v.id).set({ ...dados, atualizado_em: agoraIso }); } atualizados.push(n); }
  if (acao === 'vale_listar') {
    return [200, { vales: atualizados.map((v) => ({ ...v, tipo_nome: TIPOS[v.tipo] || TIPOS.outro, proxima_recarga: v.dia_recarga ? (Number(hoje.slice(8, 10)) < v.dia_recarga ? hoje.slice(0, 8) + String(v.dia_recarga).padStart(2, '0') : null) : null })), total: r2(atualizados.reduce((t, v) => t + (Number(v.saldo) || 0), 0)), tipos: TIPOS }];
  }
  // vale_gasto
  const v = atualizados.find((x) => x.id === id);
  if (!v) return [404, { error: 'Esse vale não existe.' }];
  const valor = num(body.valor);
  if (!(valor > 0)) return [400, { error: 'Digite o valor do gasto.' }];
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(body.data || '')) ? body.data : hoje;
  const descricao = String(body.descricao || 'Refeição').trim().slice(0, 80) || 'Refeição';
  const lid = 'vale-' + id + '-' + Date.now().toString(36);
  await base.collection('lancamentos').doc(lid).set({ data, descricao, estabelecimento: descricao, valor: r2(valor), tipo: 'despesa', categoria: 'alimentacao', documento: 'vale', meio: 'vale', vale_id: id, status: prv.statusInicial(data, hoje), origem: 'vale', criado_em: agoraIso });
  const { id: _i, ...dados } = v;
  await col.doc(id).set({ ...dados, saldo: r2((Number(v.saldo) || 0) - valor), atualizado_em: agoraIso });
  return [200, { ok: true, saldo: r2((Number(v.saldo) || 0) - valor), lancamento: lid }];
}

module.exports = { agirVales, validarVale, comRecarga };
