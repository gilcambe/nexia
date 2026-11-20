'use strict';
// Redesign fase 3 (QA do plano): cada documento gravado vira um LOTE; apagar o lote apaga os lançamentos que vieram dele.
// O lote é criado por documentos.js (doc_confirmar) via registrar(); aqui ficam listar e apagar.
const ORIGEM = { extrato: 'Extrato do banco', fatura: 'Fatura do cartão', fatura_cartao: 'Fatura do cartão', comprovante: 'Comprovante', nota: 'Nota fiscal', boleto: 'Boleto', recibo: 'Recibo', conta: 'Conta de consumo', manual: 'Digitado', vale: 'Vale refeição', openfinance: 'Open Finance' };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function registrar(base, { id, nome, agoraIso, itens }) {
  const dm = `${agoraIso.slice(8, 10)}/${agoraIso.slice(5, 7)}`;
  const soma = (t) => r2(itens.filter((x) => x.tipo === t).reduce((s, x) => s + (Number(x.valor) || 0), 0));
  // Plano "sem Pluggy": cada importação mostra a origem, o período coberto e quando entrou.
  const datas = itens.map((x) => String(x.data || '').slice(0, 10)).filter(Boolean).sort();
  const conta = {}; for (const x of itens) { const k = String(x.documento || 'outro'); conta[k] = (conta[k] || 0) + 1; }
  const doc = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  const origem = ORIGEM[doc ? doc[0] : ''] || 'Documento';
  const lote = { id, nome: (typeof nome === 'string' && nome.trim() ? nome.trim().slice(0, 80) : `${origem} de ${dm}`), origem, de: datas[0] || null, ate: datas[datas.length - 1] || null, criado_em: agoraIso, qtd: itens.length, receitas: soma('receita'), despesas: soma('despesa') };
  await base.collection('lotes').doc(id).set(lote);
  return lote;
}

async function agirLotes(acao, body, c) {
  if (!['lote_listar', 'lote_apagar'].includes(acao)) return null;
  const { base, listar } = c;
  if (acao === 'lote_listar') {
    const lotes = (await listar(base.collection('lotes'))).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    return [200, { lotes }];
  }
  const id = String(body.id || '').slice(0, 80);
  const s = id ? await base.collection('lotes').doc(id).get() : null;
  if (!s || !s.exists) return [404, { error: 'Esse documento já não existe.' }];
  const col = base.collection('lancamentos');
  const doLote = (await listar(col)).filter((l) => l.lote === id);
  for (const l of doLote) await col.doc(l.id).delete();
  await base.collection('lotes').doc(id).delete();
  return [200, { ok: true, apagados: doLote.length }];
}

module.exports = { agirLotes, registrar };
