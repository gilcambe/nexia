'use strict';
/**
 * Kernex Finance, Reserva de emergência (melhoria 10).
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 * Regras: só servidor, grátis, sem IA. Leituras em paralelo com Promise.all.
 * Cada chamada é pura; não guarda estado em variável solta.
 */
const MES = /^\d{4}-\d{2}$/;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;

function reservaEmergencia({ gasto_mensal, guardado, meses, aporte } = {}) {
  const gm = Number.isFinite(numero(gasto_mensal)) ? Math.max(0, numero(gasto_mensal)) : 0;
  const gd = Number.isFinite(numero(guardado)) ? Math.max(0, numero(guardado)) : 0;
  const m = meses === undefined || meses === null || meses === '' ? 6 : Math.max(1, Math.floor(Number(meses) || 6));
  const ap = Number.isFinite(numero(aporte)) ? numero(aporte) : null;
  const alvo = dinheiro(gm * m);
  const falta = Math.max(0, alvo - gd);
  const pct = alvo <= 0 ? 0 : Math.min(100, Math.round((gd / alvo) * 1000) / 10);
  let meses_para_completar;
  if (falta <= 0) meses_para_completar = 0;
  else if (!ap || ap <= 0) meses_para_completar = null;
  else meses_para_completar = Math.ceil(falta / ap);
  return { alvo, guardado: gd, falta: dinheiro(falta), pct, meses_para_completar };
}

async function statusReserva(c) {
  const { base, listar, agoraIso } = c;
  const agora = agoraIso || new Date().toISOString();
  const mesesPassados = [];
  let d = new Date(Date.parse(agora));
  d.setMonth(d.getMonth() - 1);
  for (let i = 0; i < 3; i++) {
    mesesPassados.push(String(d.toISOString()).slice(0, 7));
    d.setMonth(d.getMonth() - 1);
  }

  const [gastosSnap, contasSnap, cfgData] = await Promise.all([
    listar(base.collection('gastos')),
    listar(base.collection('contas')),
    (async () => {
      try {
        const cfg = await base.collection('config').doc('reserva').get();
        return cfg && cfg.exists ? (cfg.data() || {}) : {};
      } catch { return {}; }
    })(),
  ]);

  const gastos = (gastosSnap || []).filter((g) => g && MES.test(String(g.mes || '')) && mesesPassados.includes(String(g.mes)));
  const total = gastos.reduce((s, g) => s + (numero(g.valor) || 0), 0);
  const gasto_mensal = gastos.length ? dinheiro(total / gastos.length) : 0;

  const contas = (contasSnap || []).filter((c_) => c_ && String(c_.tipo || '').toLowerCase() === 'poupanca');
  const guardado = dinheiro(contas.reduce((s, c_) => s + (numero(c_.saldo) || 0), 0));

  let meses = 6; let aporte = null;
  if (cfgData.meses != null) meses = Math.max(1, Math.floor(Number(cfgData.meses) || 6));
  if (cfgData.aporte != null) aporte = numero(cfgData.aporte);

  return reservaEmergencia({ gasto_mensal, guardado, meses, aporte });
}

async function agirReserva(acao, body, c) {
  if (acao === 'reserva_status') {
    const st = await statusReserva(c);
    return [200, st];
  }
  if (acao === 'reserva_salvar') {
    const { base, agoraIso } = c;
    const meses = body && body.meses == null ? 6 : Math.max(1, Math.floor(Number(body.meses) || 6));
    const aporte = body && body.aporte == null ? null : numero(body.aporte);
    if (aporte != null && (!Number.isFinite(aporte) || aporte < 0)) return [400, { error: 'O aporte precisa ser zero ou mais.' }];
    await base.collection('config').doc('reserva').set({ meses, aporte, atualizado_em: agoraIso || new Date().toISOString() });
    return [200, { ok: true, meses, aporte }];
  }
  return null;
}

module.exports = { reservaEmergencia, agirReserva };
