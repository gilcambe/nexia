'use strict';
const { Firestore, DocumentReference, registrarUsoBanco, getUsoBanco, getBancosUsoGeral } = require('../../lib/firebase-lite/firestore.js');

test('contador de uso diário por banco acumula leituras e escritas', () => {
  registrarUsoBanco('firestore-b', 100, 50);
  registrarUsoBanco('firestore-b', 200, 30);
  const uso = getUsoBanco('firestore-b');
  expect(uso.leituras).toBe(300);
  expect(uso.escritas).toBe(80);
});

test('contador reinicia no dia seguinte', () => {
  const antes = getUsoBanco('firestore-default');
  expect(antes.data).toBe(new Date().toISOString().slice(0, 10));
});

test('getBancosUsoGeral retorna todos os bancos com limites', () => {
  const bancos = getBancosUsoGeral();
  expect(bancos.length).toBeGreaterThanOrEqual(4);
  expect(bancos.find(b => b.banco === 'firestore-default')).toBeDefined();
  expect(bancos.find(b => b.banco === 'cofresql')).toBeDefined();
});

test('Firestore registra uso ao ler e gravar', async () => {
  const db = new Firestore({ projectId: 'teste' });
  const ref = db.collection('clientes').doc('cli-1');
  await ref.set({ nome: 'Cliente Teste' });
  await ref.get();
  const uso = getUsoBanco(db._bancoAtual);
  expect(uso.leituras).toBeGreaterThanOrEqual(1);
  expect(uso.escritas).toBeGreaterThanOrEqual(1);
});

module.exports = {};
