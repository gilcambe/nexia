'use strict';
// #814 Matriz "quem lê/escreve o quê" das regras do Firestore, por coleção e por papel, no Emulator.
// Rodar com: npm run test:rules. A matriz fica em tests/firestore-matriz.js (a cobertura das coleções
// das regras é conferida também sem emulador, em tests/unit/firestore-matriz.test.js).
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { PAPEIS, USUARIOS, SEMENTES, MATRIZ } = require('../firestore-matriz');

let env;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-nexia';

test.before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
  await semear();
});
test.after(async () => { if (env) await env.cleanup(); });

async function semear() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, perfil] of Object.entries(USUARIOS)) if (perfil) await db.doc(`users/${uid}`).set({ uid, ...perfil });
    for (const [p, dados] of Object.entries(SEMENTES)) await db.doc(p).set(dados);
  });
}

// Escrita de um papel não pode mudar o que o próximo papel encontra: devolve o documento ao estado semeado.
async function restaurar(doc) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = ctx.firestore().doc(doc);
    const uid = doc.startsWith('users/') ? doc.slice(6) : null;
    const dados = SEMENTES[doc] || (uid && USUARIOS[uid] ? { uid, ...USUARIOS[uid] } : null);
    await (dados ? ref.set(dados) : ref.delete());
  });
}

const banco = (papel) => (papel === 'anon' ? env.unauthenticatedContext() : env.authenticatedContext(papel)).firestore();

function operar(db, caso) {
  if (caso.op === 'list') return db.collection(caso.doc).get();
  const ref = db.doc(caso.doc);
  if (caso.op === 'read') return ref.get();
  if (caso.op === 'create') return ref.set(caso.dados || { x: 1 });
  if (caso.op === 'update') return ref.update(caso.dados || { x: 2 });
  if (caso.op === 'delete') return ref.delete();
  throw new Error('op desconhecida: ' + caso.op);
}

for (const caso of MATRIZ) {
  test(`MATRIZ ${caso.op} ${caso.doc}${caso.nota ? ` (${caso.nota})` : ''}`, async () => {
    for (const papel of PAPEIS) {
      if (caso.op !== 'read' && caso.op !== 'list') await restaurar(caso.doc);
      const pode = caso.pode.includes(papel);
      const r = operar(banco(papel), caso);
      try { await (pode ? assertSucceeds(r) : assertFails(r)); }
      catch (e) { throw new Error(`${papel} ${pode ? 'deveria poder' : 'NÃO deveria poder'} ${caso.op} em ${caso.doc}: ${e.message}`); }
    }
  });
}
