#!/usr/bin/env node
'use strict';
// NEXIA — dá o papel master a UMA conta, a que o dono nomeou por escrito (2026-10-08: "Pode dar master para
// o e-mail do dono"). Só aceita esse e-mail; a conta precisa já existir no login do Firebase.
// Grava users/{uid}.role = 'master' (mesmo lugar que as regras e a API já leem). Não mexe em mais nada.
// Uso: FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/dar-master.js o e-mail do dono [--dry-run]
const { createTokenSource } = require('../lib/firebase-lite/google-auth');

// O e-mail autorizado vem do segredo MASTER_EMAIL (ou DONO_EMAIL), fora do código público desde 12/11/2026.
const PERMITIDO = String(process.env.DONO_EMAIL || process.env.MASTER_EMAIL || '').trim().toLowerCase();

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const dry = process.argv.includes('--dry-run');
  if (!PERMITIDO) throw new Error('Falta o segredo MASTER_EMAIL.');
  if (email !== PERMITIDO) throw new Error(`Só autorizado para o e-mail do dono (segredo MASTER_EMAIL).`);
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8') || '{}');
  if (!sa.project_id) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_BASE64.');
  const p = sa.project_id;
  const token = await createTokenSource(sa).getToken();
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (url, method, body) => { const r = await fetch(url, { method, headers: H, body: body && JSON.stringify(body) }); return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }; };

  const lk = await call(`https://identitytoolkit.googleapis.com/v1/projects/${p}/accounts:lookup`, 'POST', { email: [email] });
  const u = lk.j.users && lk.j.users[0];
  if (!u) throw new Error('Essa conta ainda não existe no login do Firebase. Entre uma vez no app com esse e-mail e rode de novo.');
  const doc = `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents/users/${u.localId}`;
  const atual = await call(doc, 'GET');
  const jaE = atual.ok && atual.j.fields && atual.j.fields.role && atual.j.fields.role.stringValue === 'master';
  console.log(`Conta encontrada (uid ${u.localId.slice(0, 4)}…${u.emailVerified ? '' : ', e-mail não verificado'}). ${jaE ? 'Já é master.' : 'Ainda não é master.'}`);
  if (jaE || dry) return;
  const r = await call(`${doc}?updateMask.fieldPaths=role&updateMask.fieldPaths=email`, 'PATCH', { fields: { role: { stringValue: 'master' }, email: { stringValue: email } } });
  if (!r.ok) throw new Error(`Falha ao gravar: ${r.status} ${(r.j.error && r.j.error.message) || ''}`);
  console.log('Pronto: a conta agora é master.');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
