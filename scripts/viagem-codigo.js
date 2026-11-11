#!/usr/bin/env node
'use strict';
// Gera o código de primeiro acesso de uma conta de viagens (KERNEX Viagens) e as linhas para clientes/viagens.js.
//   node scripts/viagem-codigo.js
// Mostra o código UMA vez: mande para o dono da agência. No repositório fica só o hash.
const crypto = require('crypto');
const { hashSenha } = require('../netlify/functions/viagem.js');

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
(async () => {
  const codigo = Array.from(crypto.randomBytes(10)).map(b => ALFA[b % ALFA.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  console.log(`Código para o dono: ${codigo.slice(0, 5)}-${codigo.slice(5)}`);
  console.log(`    codigo_salt: '${salt}',`);
  console.log(`    codigo_hash: '${await hashSenha(codigo, salt)}',`);
})();
