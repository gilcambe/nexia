'use strict';
/**
 * Kernex Finance, fase 5: saúde financeira (nota 0 a 100), "Posso comprar isso?" e relatório do mês.
 * Tudo determinístico, sobre os números do motor. A nota só considera indicadores com dados suficientes e mostra o que falta.
 */
const { totais } = require('./motor');
const cartoes = require('./cartoes');
const fin = require('./financas');

const MES = /^\d{4}-\d{2}$/;
const arred = (n) => Math.round(n * 100) / 100;
const clamp = (n) => Math.max(0, Math.min(100, n));
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const mesAnterior = (m) => cartoes.somarMes(m, -1);

/** Média mensal de despesas dos meses COM lançamentos (até 3 meses anteriores ao de referência). */
function despesaMensalMedia(lancs, mes) {
  const vals = [];
  for (let i = 1; i <= 3; i++) { const t = totais(lancs.filter((x) => String(x.data).startsWith(cartoes.somarMes(mes, -i)))); if (t.despesas > 0) vals.push(t.despesas); }
  const atual = totais(lancs.filter((x) => String(x.data).startsWith(mes))).despesas;
  if (atual > 0) vals.push(atual);
  return vals.length ? arred(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
}

/** Indicadores com dados. Cada um: { id, nome, valor, texto, nota } ou lacuna. */
function saudeFinanceira({ receitas, despesas, saldo, despesaMedia, limiteTotal, comprometido, limites }) {
  const ind = []; const lacunas = [];
  if (receitas > 0) {
    const taxa = (receitas - despesas) / receitas;
    ind.push({ id: 'poupar', nome: 'Capacidade de poupar', valor: Math.round(taxa * 1000) / 10, texto: `${String(Math.round(taxa * 1000) / 10).replace('.', ',')}% da renda sobra`, nota: Math.round(clamp((taxa / 0.2) * 100)) });
  } else lacunas.push('renda do mês (envie extrato ou holerite)');
  if (saldo !== null && despesaMedia) {
    const meses = Math.round((saldo / despesaMedia) * 10) / 10;
    ind.push({ id: 'reserva', nome: 'Reserva de emergência', valor: meses, texto: `cobre ${String(meses).replace('.', ',')} mês(es) de despesas`, nota: Math.round(clamp((meses / 6) * 100)) });
  } else lacunas.push(saldo === null ? 'contas (para a reserva de emergência)' : 'despesas dos últimos meses');
  if (limiteTotal > 0) {
    const pct = Math.round((comprometido / limiteTotal) * 1000) / 10;
    ind.push({ id: 'cartao', nome: 'Uso do limite de cartão', valor: pct, texto: `${String(pct).replace('.', ',')}% do limite comprometido`, nota: Math.round(clamp(((100 - pct) / 70) * 100)) });
  }
  if ((limites || []).length) {
    const ok = limites.filter((l) => l.status === 'ok').length;
    ind.push({ id: 'orcamento', nome: 'Orçamento respeitado', valor: ok, texto: `${ok} de ${limites.length} limite(s) dentro do combinado`, nota: Math.round((ok / limites.length) * 100) });
  }
  lacunas.push('dívidas (endividamento e custo dos juros)');
  const nota = ind.length >= 3 ? Math.round(ind.reduce((s, x) => s + x.nota, 0) / ind.length) : null;
  return { nota, indicadores: ind, lacunas, aviso: nota === null ? 'Ainda não há dados suficientes para uma nota (preciso de pelo menos 3 indicadores).' : `Nota calculada só com ${ind.length} indicador(es) que têm dados. O que falta está em "lacunas".` };
}

/** Posso comprar isso? Responde com regras fixas e mostra cada motivo com número. */
function posso({ valor, parcelas, saldo, economiaMensal, despesaMedia, simulacao }) {
  const razoes = []; let nivel = 0; // 0 sim, 1 com cuidado, 2 melhor esperar, 3 não
  const sobe = (n, t) => { nivel = Math.max(nivel, n); razoes.push(t); };
  const parcela = arred(valor / parcelas);
  if (simulacao && !simulacao.cabe) sobe(3, `Não cabe no limite do cartão: faltariam ${fmt(-simulacao.disponivel_depois)}.`);
  if (parcelas === 1 && !simulacao) {
    if (saldo === null) sobe(1, 'Não sei seu saldo (cadastre suas contas), então não consigo dizer se o dinheiro está disponível.');
    else if (valor > saldo) sobe(3, `O valor é maior que seu saldo disponível de ${fmt(saldo)}.`);
    else {
      const reserva = despesaMedia ? (saldo - valor) / despesaMedia : null;
      if (reserva !== null && reserva < 1) sobe(2, `Depois da compra sua reserva cairia para ${String(arred(reserva)).replace('.', ',')} mês de despesas.`);
      else if (reserva !== null && reserva < 3) sobe(1, `Depois da compra sua reserva cairia para ${String(arred(reserva)).replace('.', ',')} meses de despesas (o mínimo recomendado costuma ser 3).`);
      else razoes.push(`Seu saldo de ${fmt(saldo)} cobre a compra.`);
    }
  }
  if (parcelas > 1 || simulacao) {
    if (economiaMensal === null) sobe(1, 'Não tenho a sua economia mensal (envie receitas e gastos) para comparar com a parcela.');
    else if (economiaMensal <= 0) sobe(2, `Hoje você não está sobrando dinheiro no mês; uma parcela de ${fmt(parcela)} aumentaria o aperto.`);
    else if (parcela > economiaMensal) sobe(2, `A parcela de ${fmt(parcela)} é maior que o que sobra por mês (${fmt(economiaMensal)}).`);
    else if (parcela > economiaMensal * 0.3) sobe(1, `A parcela de ${fmt(parcela)} consome ${Math.round((parcela / economiaMensal) * 100)}% do que sobra por mês.`);
    else razoes.push(`A parcela de ${fmt(parcela)} usa ${Math.round((parcela / economiaMensal) * 100)}% do que sobra por mês.`);
  }
  const veredito = ['sim', 'com cuidado', 'melhor esperar', 'não'][nivel];
  return { veredito, razoes, parcela, aviso: 'Isto é uma conta com os seus números, não é recomendação de investimento.' };
}
const fmt = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function agirSaude(acao, body, c) {
  if (!['saude_financeira', 'posso_comprar', 'relatorio_mensal'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
  if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
  const [lancs, contas, limites, cts, gastos] = await Promise.all(['lancamentos', 'contas', 'limites', 'cartoes', 'gastos'].map((n) => listar(base.collection(n))));
  const doMes = totais(lancs.filter((x) => String(x.data).startsWith(mes)));
  const sd = fin.saldoDisponivel(contas);
  const media = despesaMensalMedia(lancs, mes);
  const consumo = fin.consumoLimites(limites, doMes.por_categoria);
  const lim = cts.map((k) => cartoes.limiteDoCartao(k, gastos, mes));
  const limiteTotal = lim.reduce((s, x) => s + x.limite, 0); const comprometido = lim.reduce((s, x) => s + x.comprometido, 0);
  const saude = () => saudeFinanceira({ receitas: doMes.receitas, despesas: doMes.despesas, saldo: sd.saldo, despesaMedia: media, limiteTotal, comprometido, limites: consumo });
  switch (acao) {
    case 'saude_financeira': {
      const atual = saude();
      const ant = saudeFinanceira({ ...(() => { const m = mesAnterior(mes); const t = totais(lancs.filter((x) => String(x.data).startsWith(m))); return { receitas: t.receitas, despesas: t.despesas }; })(), saldo: sd.saldo, despesaMedia: media, limiteTotal, comprometido, limites: [] });
      return [200, { mes, ...atual, nota_mes_anterior: ant.nota }];
    }
    case 'posso_comprar': {
      const valor = Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0) return [400, { error: 'O valor precisa ser maior que zero.' }];
      const parcelas = body.parcelas === undefined || body.parcelas === '' ? 1 : Number(body.parcelas);
      if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) return [400, { error: 'As parcelas vão de 1 a 48.' }];
      const cartaoId = texto(body.cartao_id, 60);
      let simulacao = null;
      if (cartaoId) {
        const k = cts.find((x) => x.id === cartaoId);
        if (!k) return [400, { error: 'Escolha um cartão válido.' }];
        simulacao = cartoes.simularCompra({ cartao: k, gastos, mesRef: mes, valor, parcelas });
      }
      const economia = doMes.receitas > 0 ? arred(doMes.receitas - doMes.despesas) : null;
      const r = posso({ valor, parcelas, saldo: sd.saldo, economiaMensal: economia, despesaMedia: media, simulacao });
      const cat = texto(body.categoria, 30); const l = cat && consumo.find((x) => x.categoria === cat);
      if (l && l.restante < valor / parcelas) r.razoes.push(`O limite de ${cat} no mês tem ${fmt(Math.max(0, l.restante))} sobrando.`);
      return [200, { valor, parcelas, ...r, simulacao }];
    }
    case 'relatorio_mensal': {
      const ant = totais(lancs.filter((x) => String(x.data).startsWith(mesAnterior(mes))));
      const rec = cartoes.recorrencias(lancs); const sus = cartoes.cobrancasSuspeitas(lancs).filter((s) => String(s.lancamento.data).startsWith(mes));
      const s = saude();
      const prioridades = [];
      consumo.filter((x) => x.status === 'estourado').slice(0, 2).forEach((x) => prioridades.push(`Reduzir ${x.categoria}: passou ${fmt(-x.restante)} do limite.`));
      if (sus.length) prioridades.push(`Revisar ${sus.length} cobrança(s) suspeita(s) no cartão.`);
      const pior = s.indicadores.slice().sort((a, b) => a.nota - b.nota)[0];
      if (pior && pior.nota < 60) prioridades.push(`Melhorar "${pior.nome}" (${pior.texto}).`);
      if (s.lacunas.length) prioridades.push(`Completar dados: ${s.lacunas[0]}.`);
      return [200, { mes, recebeu: doMes.receitas, gastou: doMes.despesas, economizou: doMes.receitas > 0 ? arred(doMes.receitas - doMes.despesas) : null,
        gasto_mes_anterior: ant.despesas, investiu: null, juros_pagos: null, pontos_acumulados: null, rendimentos: null, patrimonio_evolucao: null,
        onde_gastou_mais: Object.entries(doMes.por_categoria).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([categoria, valor]) => ({ categoria, valor })),
        recorrentes: rec.slice(0, 5), cobrancas_para_revisar: sus.length, saude: { nota: s.nota, lacunas: s.lacunas }, prioridades: prioridades.slice(0, 3),
        sem_dados: ['investiu', 'juros_pagos', 'pontos_acumulados', 'rendimentos', 'patrimonio_evolucao'] }];
    }
    default: return null;
  }
}

module.exports = { agirSaude, saudeFinanceira, posso, despesaMensalMedia };
