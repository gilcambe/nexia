'use strict';
// Dono 20/11: "não consigo ver as dívidas dos meses próximos". Função PURA: o que vai sair em cada um dos próximos
// meses (depois do atual): contas lançadas com data futura, faturas lidas (pelo vencimento), parcelas das dívidas
// (até quitar: saldo ÷ parcela) e contas fixas do orçamento (todo mês).
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function somarMes(mes, n) { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }
const diaNoMes = (mes, dia) => { const ult = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate(); return `${mes}-${String(Math.min(ult, Math.max(1, Number(dia) || 1))).padStart(2, '0')}`; };

/**
 * d: { hoje: 'AAAA-MM-DD', futuros: [{data, descricao, valor}] (despesas com data futura), faturas: [{vencimento, valor, descricao}],
 *      dividas: [{credor, saldo, parcela, dia_vencimento}], fixas: [{nome, valor, dia}], meses: 6 }
 * -> [{ mes, total, itens: [{data, nome, valor, origem}] }]
 */
function proximosMeses(d = {}) {
  const atual = String(d.hoje).slice(0, 7);
  const n = Math.max(1, Math.min(12, Number(d.meses) || 6));
  const out = [];
  for (let k = 1; k <= n; k++) {
    const mes = somarMes(atual, k);
    const itens = [];
    for (const l of d.futuros || []) if (String(l.data).startsWith(mes)) itens.push({ data: String(l.data).slice(0, 10), nome: l.descricao || 'Conta', valor: r2(l.valor), origem: 'lancamento' });
    for (const f of d.faturas || []) if (String(f.vencimento).startsWith(mes)) itens.push({ data: String(f.vencimento).slice(0, 10), nome: f.descricao || 'Fatura do cartão', valor: r2(f.valor), origem: 'fatura' });
    for (const x of d.dividas || []) {
      const parcela = Number(x.parcela) || 0; const saldo = Number(x.saldo) || 0;
      if (!(parcela > 0) || !(saldo > 0)) continue;
      const restam = Math.ceil(saldo / parcela); // parcelas que faltam, contando a deste mês
      if (k < restam) itens.push({ data: diaNoMes(mes, x.dia_vencimento), nome: `Parcela ${x.credor || 'dívida'}`, valor: r2(Math.min(parcela, saldo - parcela * k)), origem: 'divida' });
    }
    for (const f of d.fixas || []) if (Number(f.valor) > 0) itens.push({ data: f.dia ? diaNoMes(mes, f.dia) : null, nome: f.nome || 'Conta fixa', valor: r2(f.valor), origem: 'fixa' });
    itens.sort((a, b) => String(a.data || '9').localeCompare(String(b.data || '9')));
    out.push({ mes, total: r2(itens.reduce((t, x) => t + x.valor, 0)), itens });
  }
  return out;
}

module.exports = { proximosMeses, somarMes };
