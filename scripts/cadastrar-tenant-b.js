#!/usr/bin/env node
'use strict';
// NEXIA — cadastra UM tenant no banco B (Vault/Cortex), a pedido do dono (2026-10-07).
// O cadastro oficial de tenants continua no banco principal; aqui só se cria o registro mínimo
// para o Vault aceitar o tenant no banco B. Só cria se não existir; nunca altera nem apaga.
// Uso: FIREBASE_SERVICE_ACCOUNT_B=... TENANT=nexia node scripts/cadastrar-tenant-b.js
const { criarBancoB } = require('../netlify/functions/firebase-vault');

async function main() {
  const tenant = String(process.env.TENANT || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(tenant)) throw new Error('TENANT inválido.');
  const db = criarBancoB(process.env);
  const ref = db.collection('tenants').doc(tenant);
  const snap = await ref.get();
  if (snap.exists) { console.log(`Tenant ${tenant} já existe no banco B.`); return; }
  await ref.set({ slug: tenant, name: tenant, source: 'banco-b-cadastro-manual' });
  console.log(`Tenant ${tenant} cadastrado no banco B.`);
}

main().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
