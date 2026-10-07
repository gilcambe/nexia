'use strict';
/**
 * Segundo banco grátis para o Vault/Cortex (execuções, ToolCalls, projetos, auditoria).
 * Motivo: a cota diária grátis do Firestore (20 mil escritas) acabou e parou o Cortex. Com o segredo
 * FIREBASE_SERVICE_ACCOUNT_B (JSON da conta de serviço de OUTRO projeto Firebase no plano Spark), o Vault
 * passa a usar esse projeto; o login (Auth), os tenants e os dados dos apps continuam no projeto principal.
 * Sem o segredo, devolve o banco principal (nada muda). Só fetch + Web Crypto, igual ao firebase-lite.
 */
const primary = require('./firebase-init');

function lerConta(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_B && String(env.FIREBASE_SERVICE_ACCOUNT_B).trim();
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64_B && String(env.FIREBASE_SERVICE_ACCOUNT_BASE64_B).replace(/\s/g, '');
  let txt = raw || (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');
  if (!txt) return null;
  const sa = JSON.parse(txt);
  if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT_B incompleta.');
  return sa;
}

function criarBancoB(env = process.env) {
  const sa = lerConta(env);
  if (!sa) return null;
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  const { createTokenSource } = require('../../lib/firebase-lite/google-auth');
  const tokens = createTokenSource(sa);
  const db = new Firestore({ projectId: sa.project_id, getToken: () => tokens.getToken() });
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
