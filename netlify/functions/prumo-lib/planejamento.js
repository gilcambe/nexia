'use strict';
// Refatoração do Finance (dono 19/11): calendário do mês (6), reserva de emergência (10), saldo do fim do mês (14) e
// "quanto posso gastar hoje" (17) numa leitura só do banco. Os cálculos são os dos módulos do Cortex
// (calendario.js, reserva.js, fimdemes.js); aqui só lemos os dados CERTOS: despesas realizadas em 'lancamentos',
// saldo das contas e o previsto do mês. Vem antes deles em agirExtra e responde também às ações deles.
const r2 = (n) => Math.round(n * 100) / 100;

function mesesAntes(mes, n) { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }

async function carregarPlano(c, mes) {
  const { base, listar, agoraIso } = c;
  const prv = require('./previsto');
  const hoje = prv.hojeDe(agoraIso);
  const [lancsTodos, contas, pagamentos, dividas, cartoes, gastos, cfgS] = await Promise.all([
    listar(base.collection('lancamentos')), listar(base.collection('contas')), listar(base.collection('pagamentos')),
    listar(base.collection('dividas')), listar(base.collection('cartoes')), listar(base.collection('gastos')),
    base.collection('config').doc('reserva').get(),
  ]);
  const lancs = lancsTodos.filter((x) => x.perfil !== 'pj');
  const reais = prv.realizados(lancs, 'data', hoje);
  const desp = reais.filter((l) => l.tipo === 'despesa');
  // gasto mensal: média dos 3 meses completos antes deste
  const ult3 = [1, 2, 3].map((n) => mesesAntes(hoje.slice(0, 7), n));
  const gastoMensal = r2(desp.filter((l) => ult3.includes(String(l.data).slice(0, 7))).reduce((s, l) => s + (Number(l.valor) || 0), 0) / 3);
  // gasto diário: últimos 30 dias
  const desde = new Date(Date.parse(hoje) - 30 * 86400000).toISOString().slice(0, 10);
  const gastoDiario = r2(desp.filter((l) => String(l.data) > desde && String(l.data) <= hoje).reduce((s, l) => s + (Number(l.valor) || 0), 0) / 30);
  const sd = require('./financas').saldoDisponivel(contas);
  const prev = prv.resumoPrevisto({ lancs: lancsTodos, pagamentos, dividas }, hoje.slice(0, 7), hoje);
  const guardado = r2(contas.filter((k) => String(k.tipo || '').toLowerCase() === 'poupanca').reduce((s, k) => s + (Number(k.saldo) || 0), 0));
  const cfg = cfgS && cfgS.exists ? cfgS.data() || {} : {};
  const fatura = require('./cartoes').faturaDoMes;
  const cartoesMes = cartoes.map((k) => ({ ...k, fatura_atual: k.fatura_atual > 0 ? k.fatura_atual : fatura(gastos, k.id, mes) }));
  return {
    mes, hoje,
    calendario: require('./calendario').calendarioMes({ pagamentos, lancs, dividas, cartoes: cartoesMes }, mes),
    reserva: { ...require('./reserva').reservaEmergencia({ gasto_mensal: gastoMensal, guardado, meses: cfg.meses, aporte: cfg.aporte }), meses: cfg.meses || 6, gasto_mensal: gastoMensal },
    fim_mes: require('./fimdemes').fimDoMes({ saldo: sd.saldo, a_receber: prev.a_receber, a_pagar: prev.a_pagar, gasto_diario: gastoDiario, hoje }),
  };
}

async function agirPlanejamento(acao, body, c) {
  if (!['planejar_mes', 'calendario_mes', 'reserva_status', 'fim_mes_previsao'].includes(acao)) return null;
  const mes = typeof body.mes === 'string' && /^\d{4}-\d{2}$/.test(body.mes) ? body.mes : c.agoraIso.slice(0, 7);
  const p = await carregarPlano(c, mes);
  if (acao === 'calendario_mes') return [200, p.calendario];
  if (acao === 'reserva_status') return [200, p.reserva];
  if (acao === 'fim_mes_previsao') return [200, p.fim_mes];
  return [200, p];
}

module.exports = { agirPlanejamento, carregarPlano };
