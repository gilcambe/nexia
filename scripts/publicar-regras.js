#!/usr/bin/env node
'use strict';
// NEXIA — publica firestore.rules no Firestore de produção (autorizado pelo dono em 2026-10-06:
// "pode publicar as regras"). As regras leem users/{uid}.role; por isso, antes de publicar, confere
// que a conta de MASTER_EMAIL já é master. Se não for, NÃO publica (o dono perderia o acesso) e não
// muda papel de ninguém. Outros masters só são contados (uid parcial). Nunca imprime e-mails nem segredos.
// Uso: FIREBASE_SERVICE_ACCOUNT_BASE64=... MASTER_EMAIL=... node scripts/publicar-regras.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { createTokenSource } = require('../lib/firebase-lite/google-auth');

async function main() {
  const dry = process.argv.includes('--dry-run');
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8') || '{}');
  if (!sa.project_id) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_BASE64.');
  const masterEmail = (process.env.MASTER_EMAIL || '').trim().toLowerCase();
  const p = sa.project_id;
  const token = await createTokenSource(sa).getToken();
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (url, method, body) => {
    const r = await fetch(url, { method, headers: H, body: body && JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  };
  const mask = uid => `${String(uid).slice(0, 4)}…`;

  // 1. Masters hoje (users/{uid}.role == 'master').
  const q = await call(`https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/documents:runQuery`, 'POST', {
    structuredQuery: { from: [{ collectionId: 'users' }], where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'master' } } } },
  });
  if (!q.ok) throw new Error(`Listar masters: ${q.status} ${(q.j.error && q.j.error.message) || ''}`);
  const masters = (Array.isArray(q.j) ? q.j : []).filter(x => x.document).map(x => x.document.name.split('/').pop());

  // 2. A conta do dono (MASTER_EMAIL).
  if (!masterEmail) throw new Error('Falta MASTER_EMAIL: sem ele não sei qual conta é a do dono. Nada foi publicado.');
  const lk = await call(`https://identitytoolkit.googleapis.com/v1/projects/${p}/accounts:lookup`, 'POST', { email: [masterEmail] });
  const owner = lk.ok && lk.j.users && lk.j.users[0];
  if (!owner) throw new Error('A conta de MASTER_EMAIL não existe no login do Firebase. Nada foi publicado.');
  const ownerIsMaster = masters.includes(owner.localId);
  const others = masters.filter(u => u !== owner.localId && u !== 'nexia-smoke');
  console.log(`Conta do dono: ${ownerIsMaster ? 'é master' : 'NÃO é master'} (uid ${mask(owner.localId)}${owner.emailVerified ? '' : ', e-mail não verificado'}).`);
  console.log(`::notice title=Masters::dono ${ownerIsMaster ? 'é master' : 'NÃO é master'}; outros ${others.length}`);
  console.log(`Outros masters: ${others.length}${others.length ? ` (${others.map(mask).join(', ')}): confira se são legítimos` : ''}.`);

  const source = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  if (dry) { console.log('Conferência: nada foi alterado.'); return; }
  if (!ownerIsMaster) throw new Error('A conta do dono não é master: publicar agora tiraria o acesso dele. Nada foi publicado.');

  const rules = `https://firebaserules.googleapis.com/v1/projects/${p}`;
  const rs = await call(`${rules}/rulesets`, 'POST', { source: { files: [{ name: 'firestore.rules', content: source }] } });
  if (!rs.ok) throw new Error(`Criar o conjunto de regras: ${rs.status} ${(rs.j.error && rs.j.error.message) || ''}`);
  const release = `projects/${p}/releases/cloud.firestore`;
  let rel = await call(`${rules}/releases/cloud.firestore`, 'PATCH', { release: { name: release, rulesetName: rs.j.name } });
  if (rel.status === 404) rel = await call(`${rules}/releases`, 'POST', { name: release, rulesetName: rs.j.name });
  if (!rel.ok) throw new Error(`Publicar as regras: ${rel.status} ${(rel.j.error && rel.j.error.message) || ''}`);
  console.log(`Regras publicadas (${rs.j.name.split('/').pop()}).`);
}

main().catch(e => { console.error(`::error title=Regras do Firestore::${e.message}`); process.exit(1); });
