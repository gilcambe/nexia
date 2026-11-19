'use strict';
// Redesign fase 7 (plano, seção 14): motor de decisões. Função PURA: recebe os números do painel e devolve dicas,
// cada uma com o dado usado, uma frase e uma ação de 1 toque. A Home mostra no máximo 3, por impacto e urgência.
// Linguagem de apoio à decisão: nunca indica produto financeiro.
const CAT = { moradia: 'Moradia', alimentacao: 'Mercado e comida', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', outros: 'Outros' };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (v) => 'R$ ' + r2(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Meses até juntar `alvo` guardando `aporte` por mês, com juros de `taxa` ao mês (0,5% padrão). */
function mesesAte(atual, aporte, alvo, taxa = 0.005) {
  if (atual >= alvo) return 0;
  if (!(aporte > 0) && !(atual > 0)) return null;
  let s = atual; let m = 0;
  while (s < alvo && m < 1200) { s = s * (1 + taxa) + aporte; m++; }
  return m >= 1200 ? null : m;
}

/**
 * d: { hoje, tenho, gasto_mensal, reserva_meses, faturas: [{nome, valor, dias}], dividas: [{credor, tipo, saldo, juros_mes}],
 *      pontos: [{programa, saldo, dias}], categorias: [{categoria, valor, media3}], investido, aporte_mensal, mes_num }
 * devolve [{ id, nivel: 'risco'|'atencao'|'info', impacto (R$/mês aproximado), texto, dado, acao: { rotulo, aba } }]
 */
function gerarInsights(d = {}) {
  const out = [];
  const tenho = Number(d.tenho);
  for (const f of d.faturas || []) {
    if (f.dias != null && f.dias >= 0 && f.dias < 5 && Number.isFinite(tenho) && tenho < f.valor) {
      out.push({ id: 'fatura-' + f.nome, nivel: 'risco', impacto: f.valor, texto: `Faltam ${brl(f.valor - tenho)} para pagar a ${f.nome}.`, dado: `Fatura ${brl(f.valor)} vence em ${f.dias} dia(s); saldo ${brl(tenho)}.`, acao: { rotulo: 'Ver contas', aba: 'mes' } });
    }
  }
  const caras = (d.dividas || []).filter((x) => ['cheque_especial', 'cartao'].includes(x.tipo) && x.saldo > 0);
  if (caras.length) {
    const custo = r2(caras.reduce((s, x) => s + (x.saldo * (x.juros_mes || 0)) / 100, 0));
    out.push({ id: 'rotativo', nivel: 'risco', impacto: custo || 1, texto: 'Rotativo ou cheque especial: quite antes de investir.', dado: `Juros de cerca de ${brl(custo)} por mês em ${caras.length} dívida(s).`, acao: { rotulo: 'Ver dívidas', aba: 'dividas' } });
  }
  if (d.reserva_meses != null && d.reserva_meses < 3 && d.gasto_mensal > 0) {
    const falta = r2(d.gasto_mensal * 3 - (d.reserva_meses * d.gasto_mensal));
    out.push({ id: 'reserva', nivel: 'atencao', impacto: falta / 12, texto: 'Mande a sobra do mês para a reserva até chegar a 3 meses.', dado: `Reserva cobre ${String(r2(d.reserva_meses)).replace('.', ',')} mês(es); faltam ${brl(falta)} para 3 meses.`, acao: { rotulo: 'Ver reserva', aba: 'patrimonio' } });
  }
  if (Number.isFinite(tenho) && d.gasto_mensal > 0 && tenho > d.gasto_mensal * 2) {
    const parado = r2(tenho - d.gasto_mensal);
    out.push({ id: 'parado', nivel: 'info', impacto: parado * 0.008, texto: 'Dinheiro parado na conta: avalie uma aplicação com liquidez diária.', dado: `${brl(parado)} acima de 1 mês de gastos (${brl(d.gasto_mensal)}).`, acao: { rotulo: 'Ver patrimônio', aba: 'patrimonio' } });
  }
  for (const p of d.pontos || []) {
    if (p.dias != null && p.dias >= 0 && p.dias < 60 && p.saldo > 0) out.push({ id: 'pontos-' + p.programa, nivel: p.dias <= 30 ? 'atencao' : 'info', impacto: p.valor || p.saldo / 100, texto: `Use ou transfira os pontos ${p.programa} antes de vencer.`, dado: `${Number(p.saldo).toLocaleString('pt-BR')} pontos vencem em ${p.dias} dia(s).`, acao: { rotulo: 'Ver benefícios', aba: 'beneficios' } });
  }
  for (const c of (d.categorias || []).filter((x) => x.categoria !== 'investimentos')) { // investir mais não é gasto a cortar
    if (c.media3 > 0 && c.valor > c.media3 * 1.2) out.push({ id: 'cat-' + c.categoria, nivel: 'atencao', impacto: c.valor - c.media3, texto: `${c.nome || CAT[c.categoria] || c.categoria} está ${Math.round((c.valor / c.media3 - 1) * 100)}% acima da média.`, dado: `${brl(c.valor)} este mês contra média de ${brl(c.media3)} nos últimos 3 meses.`, acao: { rotulo: 'Ver gastos', aba: 'mes' } });
  }
  const m = Number(d.mes_num);
  if (m === 11 || m === 12) out.push({ id: 'sazonal-13', nivel: 'info', impacto: 1, texto: 'Fim de ano: planeje o 13º antes de gastar.', dado: 'O 13º cai em novembro e dezembro; IPVA e IPTU vêm em janeiro.', acao: { rotulo: 'Ver salário', aba: 'orcamento' } });
  else if (m === 1 || m === 2) out.push({ id: 'sazonal-ipva', nivel: 'info', impacto: 1, texto: 'IPVA e IPTU do ano: veja se compensa pagar à vista.', dado: 'Os carnês chegam em janeiro e fevereiro.', acao: { rotulo: 'Ver impostos', aba: 'impostos' } });
  else if (m >= 3 && m <= 5) out.push({ id: 'sazonal-ir', nivel: 'info', impacto: 1, texto: 'Declaração do Imposto de Renda: separe os informes.', dado: 'O prazo vai de março ao fim de maio.', acao: { rotulo: 'Ver impostos', aba: 'impostos' } });
  if (d.gasto_mensal > 0 && d.investido >= 0) {
    const alvo = d.gasto_mensal * 12 * 25; const ap = Number(d.aporte_mensal) || 0;
    const a = mesesAte(d.investido, ap, alvo); const b = mesesAte(d.investido, ap + 500, alvo);
    if (a != null && b != null && a - b >= 12) out.push({ id: 'aporte-500', nivel: 'info', impacto: 0.5, texto: `+ R$ 500/mês antecipa a independência em ${Math.round((a - b) / 12)} ano(s).`, dado: `Conta com 0,5% ao mês, investido ${brl(d.investido)} e meta de ${brl(alvo)}.`, acao: { rotulo: 'Ver futuro', aba: 'patrimonio' } });
  }
  const ordem = { risco: 0, atencao: 1, info: 2 };
  return out.sort((x, y) => ordem[x.nivel] - ordem[y.nivel] || y.impacto - x.impacto);
}

module.exports = { gerarInsights, mesesAte };
