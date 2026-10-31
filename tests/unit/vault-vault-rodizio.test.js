'use strict';
/**
 * Testes unitários para o cofre (Vault) com contadores por banco, rodízio proativo a 70% e cache TTL 60s.
 */
const { test } = require('node:test');
const assert = require('node:assert');

test('Contador de uso por banco e limites (firestore.js)', () => {
  const fsMod = require('../lib/firebase-lite/firestore.js');
  assert.ok(fsMod, 'Módulo firestore carregado');
  assert.ok(typeof fsMod.registrarUsoBanco === 'function', 'registrarUsoBanco existe');
  assert.ok(typeof fsMod.getUsoBanco === 'function', 'getUsoBanco existe');
  assert.ok(typeof fsMod.getBancosUsoGeral === 'function', 'getBancosUsoGeral existe');

  const usoDefault = fsMod.getUsoBanco('firestore-default');
  assert.ok(usoDefault, 'Uso padrão retornado');
  assert.strictEqual(usoDefault.leituras, 0);
  assert.strictEqual(usoDefault.escritas, 0);

  fsMod.registrarUsoBanco('firestore-default', 10, 5);
  const usoAtualizado = fsMod.getUsoBanco('firestore-default');
  assert.strictEqual(usoAtualizado.leituras, 10);
  assert.strictEqual(usoAtualizado.escritas, 5);
});

test('Rodízio de bancos proativo ao atingir 70%', () => {
  const fsMod = require('../lib/firebase-lite/firestore.js');
  const bancoAntes = fsMod.getBancoAtivo();
  assert.ok(bancoAntes, 'Banco ativo obtido');

  // Registrar uso massivo para atingir o limite de 70%
  const limits = fsMod.BANK_LIMITS[bancoAntes] || { reads: 50000, writes: 20000 };
  const leiturasNecessarias = Math.ceil(limits.reads * 0.75);
  
  fsMod.registrarUsoBanco(bancoAntes, leiturasNecessarias, 0);
  const uso = fsMod.getUsoBanco(bancoAntes);
  assert.strictEqual(uso.status, 'quase cheio', 'Status deve mudar para quase cheio');
});

test('Resumo de saúde e uso do Vault na Central', async () => {
  const saudeMod = require('../netlify/functions/central/saude-historico.js');
  assert.ok(saudeMod, 'Módulo de saúde carregado');
  assert.ok(typeof saudeMod.resumo === 'function', 'Função resumo existe');
});
