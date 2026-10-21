#!/usr/bin/env node
'use strict';
// Gera o código de primeiro acesso de uma conta de nutricionista (KERNEX Nutri) e as linhas para clientes/nutris.js.
//   node scripts/nutri-codigo.js
// Mostra o código UMA vez: mande para o profissional. No repositório fica só o hash.
const crypto = require('crypto');
const { hashSenha } = require('../netlify/functions/nutri.js');

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
(async () => {
  const codigo = Array.from(crypto.randomBytes(10)).map(b => ALFA[b % ALFA.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  console.log(`Código para o nutricionista: ${codigo.slice(0, 5)}-${codigo.slice(5)}`);
  console.log(`    codigo_salt: '${salt}',`);
  console.log(`    codigo_hash: '${await hashSenha(codigo, salt)}',`);
})();
