#!/usr/bin/env node
'use strict';
// NEXIA — publica no Firestore de produção os índices compostos de firestore.indexes.json.
// Só CRIA o que falta (nunca apaga nem altera índice existente). Usa a chave de serviço pela API
// REST do Firestore (grátis no plano Spark). O Google leva alguns minutos para construir cada índice.
// Uso: FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/publicar-indices.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { createTokenSource } = require('../lib/firebase-lite/google-auth');

const key = idx => `${idx.collectionGroup}|${idx.queryScope || 'COLLECTION'}|${idx.fields.map(f => `${f.fieldPath}:${f.order || f.arrayConfig}`).join(',')}`;

async function main() {
  const dry = process.argv.includes('--dry-run');
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8') || '{}');
  if (!sa.project_id) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_BASE64.');
  await publicar(sa, dry);
  // Segundo projeto grátis do Vault/Cortex (FIREBASE_SERVICE_ACCOUNT_B): mesmos índices.
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_B || '').trim();
  if (raw) {
    const b = JSON.parse(raw);
    if (typeof b.private_key === 'string' && b.private_key.includes('\\n')) b.private_key = b.private_key.replace(/\\n/g, '\n');
    console.log(`--- Projeto B (${b.project_id}) ---`);
    await publicar(b, dry);
  }
}

async function publicar(sa, dry) {
  const wanted = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firestore.indexes.json'), 'utf8')).indexes;
  const token = await createTokenSource(sa).getToken();
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/collectionGroups`;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const existing = new Map();
  let pageToken = '';
  do {
    const r = await fetch(`${base}/-/indexes${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: H });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Listar índices: ${r.status} ${(j.error && j.error.message) || ''}`);
    for (const ix of j.indexes || []) {
      const cg = ix.name.split('/collectionGroups/')[1].split('/')[0];
      const fields = (ix.fields || []).filter(f => f.fieldPath !== '__name__');
      existing.set(key({ collectionGroup: cg, queryScope: ix.queryScope, fields }), ix.state);
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);

  const missing = wanted.filter(ix => !existing.has(key(ix)));
  console.log(`Índices no arquivo: ${wanted.length}. Já no Firestore: ${wanted.length - missing.length}. A criar: ${missing.length}.`);
  const porEstado = {};
  for (const st of existing.values()) porEstado[st] = (porEstado[st] || 0) + 1;
  // ::notice:: aparece nas anotações do GitHub, que são legíveis mesmo sem os logs do job.
  console.log(`::notice::Índices do projeto ${sa.project_id}: ${JSON.stringify(porEstado)}; faltando ${missing.length}`);
  const building = [...existing.values()].filter(s => s === 'CREATING').length;
  if (building) console.log(`Em construção no Google: ${building}.`);
  if (dry) { for (const ix of missing) console.log(`  faltando: ${key(ix)}`); return; }
  let ok = 0, fail = 0, skip = 0;
  for (const ix of missing) {
    const r = await fetch(`${base}/${encodeURIComponent(ix.collectionGroup)}/indexes`, {
      method: 'POST', headers: H, body: JSON.stringify({ queryScope: ix.queryScope || 'COLLECTION', fields: ix.fields }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok || r.status === 409) ok++;
    // Índice de um campo só: o Firestore já cria sozinho, não precisa publicar.
    else if (r.status === 400 && /not necessary/i.test((j.error && j.error.message) || '')) skip++;
    else { fail++; console.log(`  FALHOU ${ix.collectionGroup}: ${r.status} ${(j.error && j.error.message || '').slice(0, 200)}`); }
  }
  console.log(`Pedidos de criação aceitos: ${ok}. Automáticos (campo único): ${skip}. Falhas: ${fail}. Os índices ficam prontos em alguns minutos.`);
  if (fail) process.exit(1);
}

main().catch(e => { console.error('ERRO:', e && e.message); process.exit(1); });
