'use strict';
/**
 * Segundo banco grátis para o Vault/Cortex (execuções, ToolCalls, projetos, auditoria).
 * Motivo: a cota diária grátis do Firestore (20 mil escritas) acabou e parou o Cortex. Com o segredo
 * FIREBASE_SERVICE_ACCOUNT_B (JSON da conta de serviço de OUTRO projeto Firebase no plano Spark), o Vault
 * passa a usar esse projeto; o login (Auth), os tenants e os dados dos apps continuam no projeto principal.
 * Sem o segredo, devolve o banco principal (nada muda). Só fetch + Web Crypto, igual ao firebase-lite.
 */
const primary = require('./firebase-init');

function lerConta(env, letra = 'B') {
  const raw = env[`FIREBASE_SERVICE_ACCOUNT_${letra}`] && String(env[`FIREBASE_SERVICE_ACCOUNT_${letra}`]).trim();
  const b64 = env[`FIREBASE_SERVICE_ACCOUNT_BASE64_${letra}`] && String(env[`FIREBASE_SERVICE_ACCOUNT_BASE64_${letra}`]).replace(/\s/g, '');
  let txt = raw || (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');
  if (!txt) return null;
  const sa = JSON.parse(txt);
  if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error(`FIREBASE_SERVICE_ACCOUNT_${letra} incompleta.`);
  return sa;
}

// Bancos grátis do Vault em ordem (B, C, D... H: cada um é um projeto Firebase grátis criado com scripts/criar-banco.bat): o primeiro é o ativo e, se a cota dele acabar, passa para o próximo.
// Métricas de uso e cota (70% threshold) para o cofre
const dbUsageCounters = Object.create(null); // { [projectId]: { reads: 0, writes: 0, day: 'YYYY-MM-DD', almostFull: false } }
function getUsageRecord(projectId) {
  const today = new Date().toISOString().slice(0, 10);
  if (!dbUsageCounters[projectId] || dbUsageCounters[projectId].day !== today) {
    dbUsageCounters[projectId] = { reads: 0, writes: 0, day: today, almostFull: false };
  }
  return dbUsageCounters[projectId];
}
function recordUsage(projectId, type, count = 1) {
  const rec = getUsageRecord(projectId);
  if (type === 'read') rec.reads += count;
  if (type === 'write') rec.writes += count;
  // Limites: Firestore (50k reads / 20k writes); D1 (5M rows / 100k writes)
  const isD1 = projectId === 'nexia-do';
  const readLimit = isD1 ? 5000000 : 50000;
  const writeLimit = isD1 ? 100000 : 20000;
  if (!rec.almostFull && (rec.reads >= readLimit * 0.7 || rec.writes >= writeLimit * 0.7)) {
    rec.almostFull = true;
    console.warn(`[NEXIA] Banco ${projectId} atingiu 70% da cota (${rec.reads} leituras, ${rec.writes} escritas). Acionando failover preventivo e aviso na Central.`);
    try {
      // Registrar aviso na Central com label sentinel
      globalThis.__NEXIA_CENTRAL_AVISOS__ = globalThis.__NEXIA_CENTRAL_AVISOS__ || [];
      globalThis.__NEXIA_CENTRAL_AVISOS__.push({
        id: 'aviso_cota_' + Date.now(),
        label: 'sentinel',
        title: `Cota do banco ${projectId} acima de 70%`,
        message: `O banco ${projectId} atingiu ${rec.reads} leituras e ${rec.writes} escritas (70% da cota grátis). Tráfego redirecionado preventivamente.`,
        at: new Date().toISOString()
      });
    } catch {}
  }
}
function getVaultDbUsageStats() {
  return dbUsageCounters;
}

function criarBancoB(env = process.env) {
  const contas = ['B', 'C', 'D', 'E', 'F', 'G', 'H'].map(l => { const sa = lerConta(env, l); return sa && Object.assign(sa, { _letra: l }); }).filter(Boolean);
  if (!contas.length) return null;
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  const { createTokenSource } = require('../../lib/firebase-lite/google-auth');
  // #2188: os bancos novos (D..H) só entram no rodízio depois de terem os índices compostos (senão a tarefa pula de banco no meio).
  const bancos = contas.map(sa => { const tokens = createTokenSource(sa); return { projectId: sa.project_id, getToken: () => tokens.getToken(), conferirIndices: !['B', 'C'].includes(sa._letra) }; });
  const db = new Firestore({ projectId: bancos[0].projectId, getToken: bancos[0].getToken });
  // Último recurso fora do Firebase: Cloudflare D1 (grátis). Só entra se o token e a conta da Cloudflare estiverem no ambiente.
  // Token próprio (só D1 Edit): NEXIA_D1_TOKEN + NEXIA_D1_ACCOUNT_ID. Nunca o token de deploy.
  if (env.NEXIA_D1_TOKEN && env.NEXIA_D1_ACCOUNT_ID) {
    const { createD1Backend, createD1Driver } = require('../../lib/firebase-lite/d1-backend');
    const backend = createD1Backend({ driver: createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID, databaseName: env.NEXIA_D1_NAME || 'nexia-cortex' }) });
    bancos.push({ projectId: backend.projectId, getToken: async () => '', backend });
  }
  // #2188: depois do D1, o banco dentro do próprio Worker (Durable Object SQLite, cota grátis separada).
  const cofre = globalThis.__NEXIA_COFRE__;
  // Fora do Worker (GitHub Actions): o mesmo banco, pela rota /api/cofre-sql do Worker, com o segredo do cron.
  const ponte = !cofre && env.NEXIA_APP_URL && String(env.NEXIA_CRON_SECRET || '').length >= 32;
  if (ponte) {
    const { createD1Backend, createD1Driver } = require('../../lib/firebase-lite/d1-backend');
    const url = `${String(env.NEXIA_APP_URL).replace(/\/+$/, '')}/api/cofre-sql`;
    const fetchImpl = (u, init) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-nexia-cron': env.NEXIA_CRON_SECRET }, body: init && init.body });
    const backend = createD1Backend({ driver: createD1Driver({ token: 'do', accountId: 'do', databaseId: 'do', fetchImpl }), projectId: 'nexia-do' });
    bancos.push({ projectId: backend.projectId, getToken: async () => '', backend });
  }
  if (cofre) {
    const { createD1Backend, createD1Driver } = require('../../lib/firebase-lite/d1-backend');
    // O Worker não deixa um pedido usar o stub criado em outro pedido: pega o stub na hora, com o binding atual.
    const fetchImpl = (url, init) => {
      const ns = globalThis.__NEXIA_COFRE__ || cofre;
      return ns.get(ns.idFromName('cofre')).fetch('https://cofre/query', { method: 'POST', body: init && init.body });
    };
    const backend = createD1Backend({ driver: createD1Driver({ token: 'do', accountId: 'do', databaseId: 'do', fetchImpl }), projectId: 'nexia-do' });
    bancos.push({ projectId: backend.projectId, getToken: async () => '', backend });
  }
  db.enableFailover(bancos);
  try { db.settings({ ignoreUndefinedProperties: true }); } catch { /* opcional */ }
  return db;
}

let cache;
function vaultDb(env = process.env) {
  if (cache === undefined) {
    try { cache = criarBancoB(env); } catch (e) { console.error('[NEXIA] Banco B do Vault inválido:', e.message); cache = null; }
    if (cache) console.info('[NEXIA] Vault usando o banco B (projeto separado) ✓');
  }
  return cache || primary.db;
}

module.exports = { vaultDb, criarBancoB, lerConta, recordUsage, getVaultDbUsageStats, _reset: () => { cache = undefined; } };
