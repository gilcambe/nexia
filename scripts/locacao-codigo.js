#!/usr/bin/env node
'use strict';
// Gera o código de primeiro acesso de uma conta de locação (NEXIA Locação) e as linhas para clientes/locacoes.js.
//   node scripts/locacao-codigo.js
// Mostra o código UMA vez: mande para a dona do local. No repositório fica só o hash.
const crypto = require('crypto');
const { hashSenha } = require('../netlify/functions/locacao.js');

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
(async () => {
  const codigo = Array.from(crypto.randomBytes(10)).map(b => ALFA[b % ALFA.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  console.log(`Código para a dona: ${codigo.slice(0, 5)}-${codigo.slice(5)}`);
  console.log(`    codigo_salt: '${salt}',`);
  console.log(`    codigo_hash: '${await hashSenha(codigo, salt)}',`);
})();
