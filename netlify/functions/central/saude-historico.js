'use strict';
// Central NEXIA (aba Sistema): histórico de saúde dos sites e rotas públicas, 30 dias.
// + Monitoramento do Vault (cofre) - uso dos bancos B, C, D1 e CofreSql com rodízio automático.

// O cron do Worker (5 em 5 min) chama guardarAmostra; só a 1ª batida de cada hora mede (1 amostra
// por hora por rota: código HTTP e tempo de resposta). Guardado no Cloudflare D1 (banco grátis de
// reserva) quando NEXIA_D1_TOKEN/NEXIA_D1_ACCOUNT_ID existem; senão no Firestore do projeto.
// Uma amostra = 1 documento por hora em saude_horas/<AAAA-MM-DDTHH>; mais velho que 30 dias é apagado.

const { NO_AR } = require('../../../central/produtos');

const DIAS = 30;
const HORA = 36e5;
const COLECAO = 'saude_horas';
const COLECAO_VAULT = 'vault_usage';
// Rotas públicas importantes: o site de cada produto (as mesmas da "saúde agora") e a página
// inicial e a Central da NEXIA no Worker.
const BASE = 'https://nexia.gcbezerra.workers.dev';
const ROTAS = [
  { id: 'nexia', nome: 'NEXIA (página inicial)', url: BASE + '/' },
  { id: 'central', nome: 'Central', url: BASE + '/central' },
  ...NO_AR.map((p) => ({ id: p.id, nome: p.nome, url: p.site })),
];

const horaDe = (ms) => new Date(ms).toISOString().slice(0, 13); // "2026-10-19T13"

/** Banco do histórico: D1 (via firebase-lite, mesmo jeito de usar do Firestore) ou o Firestore. */
function abrirBanco(env = process.env, o = {}) {
  const driver = o.driver || (env.NEXIA_D1_TOKEN && env.NEXIA_D1_ACCOUNT_ID
    ? require('../../../lib/firebase-lite/d1-backend').createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID })
    : null);
  if (!driver) return require('../firebase-init').db || null;
  const { createD1Backend } = require('../../../lib/firebase-lite/d1-backend');
  const { Firestore } = require('../../../lib/firebase-lite/firestore');
  const backend = createD1Backend({ driver });
  const db = new Firestore({ projectId: backend.projectId, getToken: async () => '' });
  db._backend = backend;
  return db;
}

/** Mede todas as rotas uma vez nesta hora (se já mediu, não faz nada) e apaga o que passou de 30 dias. */
async function guardarAmostra(db, { at = Date.now(), medir, rotas = ROTAS } = {}) {
  if (!db) return { skipped: 'sem banco' };
  const hora = horaDe(at);
  const ref = db.collection(COLECAO).doc(hora);
  if ((await ref.get()).exists) return { skipped: 'hora já medida', hora };
  const medidas = await Promise.all(rotas.map(async (r) => [r.id, await medir(r.url)]));
  const porRota = {};
  for (const [id, m] of medidas) porRota[id] = { ok: !!m.ok, codigo: Number(m.codigo) || 0, tempo: Math.round(Number(m.tempo) || 0) };
  await ref.set({ hora, em: new Date(at).toISOString(), rotas: porRota });
  const velhas = await db.collection(COLECAO).where('hora', '<', horaDe(at - DIAS * 24 * HORA)).limit(200).get();
  if (!velhas.empty) {
    const b = db.batch();
    velhas.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  return { hora, rotas: medidas.length, fora: medidas.filter(([, m]) => !m.ok).map(([id]) => id), apagadas: velhas.size, porRota };
}

/** Resumo dos últimos 30 dias por rota: disponibilidade %, quedas, tempo médio e erros. */
async function resumo(db, { agora = Date.now(), rotas = ROTAS } = {}) {
  // Integrar uso dos bancos do cofre (Vault) para a Central (label sentinel)
  let bancosUso = [];
  try {
    const fsMod = require('../../../lib/firebase-lite/firestore.js');
    if (fsMod && typeof fsMod.getBancosUsoGeral === 'function') {
      bancosUso = fsMod.getBancosUsoGeral();
    }
  } catch (e) {
    console.error('Erro ao buscar uso dos bancos no resumo de saúde:', e);
  }
  const desde = horaDe(agora - DIAS * 24 * HORA);
  const snap = await db.collection(COLECAO).where('hora', '>=', desde).get();
  const horas = snap.docs.map((d) => d.data()).filter((h) => h && h.rotas).sort((a, b) => (a.hora < b.hora ? -1 : 1));
  const porRota = rotas.map((r) => {
    let amostras = 0, noAr = 0, erros = 0, quedas = 0, somaTempo = 0, nTempo = 0, ultimaQueda = null, caido = false;
    const codigos = {};
    for (const h of horas) {
      const m = h.rotas[r.id];
      if (!m) continue;
      amostras++;
      if (m.ok) { noAr++; somaTempo += Number(m.tempo) || 0; nTempo++; caido = false; }
      else { if (!caido) quedas++; caido = true; ultimaQueda = h.em || h.hora; }
      if (!m.ok || m.codigo >= 400) { erros++; const c = String(m.codigo || 'sem resposta'); codigos[c] = (codigos[c] || 0) + 1; }
    }
    return {
      id: r.id, nome: r.nome, url: r.url, amostras,
      disponibilidade: amostras ? Math.round((noAr / amostras) * 1000) / 10 : null,
      quedas, horasFora: amostras - noAr, erros, codigos,
      tempoMedio: nTempo ? Math.round(somaTempo / nTempo) : null,
      ultimaQueda, agora: caido,
    };
  });
  // Disponibilidade de todas as rotas juntas, dia a dia (para o gráfico).
  const dias = {};
  for (const h of horas) {
    const dia = h.hora.slice(0, 10);
    const t = (dias[dia] ||= { total: 0, ok: 0 });
    for (const m of Object.values(h.rotas)) { t.total++; if (m && m.ok) t.ok++; }
  }
  return {
    dias: DIAS, amostras: horas.length, desde: horas.length ? horas[0].em || horas[0].hora : null,
    rotas: porRota,
    bancosUso,
    porDia: Object.entries(dias).map(([dia, t]) => ({ dia, disponibilidade: t.total ? Math.round((t.ok / t.total) * 1000) / 10 : 0 })),
  };
}

/** Última medição de hora em hora (o cron do Worker mede o próprio Worker sem problema; um pedido da página não consegue). */
async function ultimaAmostra(db, agora = Date.now()) {
  if (!db) return null;
  const snap = await db.collection(COLECAO).where('hora', '>=', horaDe(agora - 3 * HORA)).get();
  const horas = snap.docs.map((d) => d.data()).filter((h) => h && h.rotas).sort((a, b) => (a.hora < b.hora ? 1 : -1));
  return horas[0] || null;
}

/**
 * Guarda o uso diário dos bancos do Vault no banco de dados.
 * @param {Object} db - Instância do banco de dados
 * @param {Object} dados - Dados de uso: { banco, leituras, escritas, percentualLeituras, percentualEscritas }
 * @param {string} data - Data no formato YYYY-MM-DD
 */
async function guardarUsoVault(db, dados, data = new Date().toISOString().slice(0, 10)) {
  if (!db) return { success: false, error: 'Banco indisponível' };
  
  const ref = db.collection(COLECAO_VAULT).doc(`${data}_${dados.banco}`);
  const snapshot = await ref.get();
  
  if (snapshot.exists) {
    await ref.update({
      ...dados,
      atualizado: new Date().toISOString()
    });
  } else {
    await ref.set({
      data,
      banco: dados.banco,
      leituras: dados.leituras,
      escritas: dados.escritas,
      percentualLeituras: dados.percentualLeituras,
      percentualEscritas: dados.percentualEscritas,
      status: dados.status || 'ativo',
      criado: new Date().toISOString(),
      atualizado: new Date().toISOString()
    });
  }
  
  return { success: true, banco: dados.banco };
}

/**
 * Obtém o uso atual dos bancos do Vault.
 * @param {Object} db - Instância do banco de dados
 * @param {string} data - Data opcional (padrão: hoje)
 */
async function obterUsoVault(db, data = new Date().toISOString().slice(0, 10)) {
  if (!db) return { success: false, error: 'Banco indisponível' };
  
  const snapshot = await db.collection(COLECAO_VAULT)
    .where('data', '==', data)
    .orderBy('banco')
    .get();
  
  const bancos = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    bancos[data.banco] = {
      leituras: data.leituras,
      escritas: data.escritas,
      percentualLeituras: data.percentualLeituras,
      percentualEscritas: data.percentualEscritas,
      status: data.status,
      atualizado: data.atualizado
    };
  });
  
  return { success: true, data, bancos };
}

/**
 * Obtém o histórico de uso dos bancos do Vault (últimos N dias).
 * @param {Object} db - Instância do banco de dados
 * @param {number} dias - Número de dias (padrão: 7)
 */
async function historicoUsoVault(db, dias = 7) {
  if (!db) return { success: false, error: 'Banco indisponível' };
  
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  
  const snapshot = await db.collection(COLECAO_VAULT)
    .where('data', '>=', desde.toISOString().slice(0, 10))
    .orderBy('data', 'desc')
    .get();
  
  const historico = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!historico[data.data]) {
      historico[data.data] = {};
    }
    historico[data.data][data.banco] = {
      leituras: data.leituras,
      escritas: data.escritas,
      percentualLeituras: data.percentualLeituras,
      percentualEscritas: data.percentualEscritas,
      status: data.status
    };
  });
  
  return { success: true, dias, historico };
}

module.exports = { ultimaAmostra, ROTAS, COLECAO, DIAS, horaDe, abrirBanco, guardarAmostra, resumo, guardarUsoVault, obterUsoVault, historicoUsoVault };
