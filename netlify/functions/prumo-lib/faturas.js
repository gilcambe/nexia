'use strict';
// Dono 19-20/11: "mandei o print da fatura, diz que gravou mas os valores não aparecem". A fatura do cartão é uma CONTA
// A PAGAR no dia do vencimento: 'fatura_gravar' guarda o total como lançamento (categoria 'fatura', data = vencimento).
// Ela entra no "A pagar"/"Próximos meses", mas não conta como gasto do mês (as compras já contam) nem baixa o "Tenho".
// Mesmo cartão e mesmo vencimento = mesma fatura: gravar de novo só troca o valor.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cartao';

async function agirFaturas(acao, body, c) {
  if (acao !== 'fatura_gravar') return null;
  const { base, agoraIso } = c;
  const valor = typeof body.valor === 'number' ? body.valor : Number(String(body.valor || '').replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const venc = String(body.vencimento || '').slice(0, 10);
  if (!(valor > 0)) return [400, { error: 'Digite o total da fatura.' }];
  if (!DATA.test(venc)) return [400, { error: 'Diga a data de vencimento da fatura.' }];
  const nome = String(body.nome || 'Cartão').trim().slice(0, 60) || 'Cartão';
  const id = `fat-${venc}-${slug(nome)}`;
  const hoje = require('./previsto').hojeDe(agoraIso);
  await base.collection('lancamentos').doc(id).set({ data: venc, vencimento: venc, descricao: `Fatura ${nome}`, estabelecimento: nome, valor: r2(valor), tipo: 'despesa', categoria: 'fatura',
    documento: 'fatura_total', status: require('./previsto').statusInicial(venc, hoje), origem: 'fatura', criado_em: agoraIso });
  return [200, { ok: true, id }];
}

module.exports = { agirFaturas };
