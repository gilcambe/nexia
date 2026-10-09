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

// Bancos grátis do Vault em ordem (B, depois C): o primeiro é o ativo e, se a cota dele acabar, passa para o próximo.
function criarBancoB(env = process.env) {
  const contas = ['B', 'C'].map(l => lerConta(env, l)).filter(Boolean);
  if (!contas.length) return null;
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  const { createTokenSource } = require('../../lib/firebase-lite/google-auth');
  const bancos = contas.map(sa => { const tokens = createTokenSource(sa); return { projectId: sa.project_id, getToken: () => tokens.getToken() }; });
  const db = new Firestore({ projectId: bancos[0].projectId, getToken: bancos[0].getToken });
  // Último recurso fora do Firebase: Cloudflare D1 (grátis). Só entra se o token e a conta da Cloudflare estiverem no ambiente.
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    const { createD1Backend, createD1Driver } = require('../../lib/firebase-lite/d1-backend');
    const backend = createD1Backend({ driver: createD1Driver({ token: env.CLOUDFLARE_API_TOKEN, accountId: env.CLOUDFLARE_ACCOUNT_ID, databaseName: env.NEXIA_D1_NAME || 'nexia-cortex' }) });
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

module.exports = { vaultDb, criarBancoB, lerConta, _reset: () => { cache = undefined; } };
