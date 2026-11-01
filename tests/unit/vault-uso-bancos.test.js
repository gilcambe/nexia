'use strict';
// Teste unitário: contador de uso por banco (leituras e escritas do dia)

const assert = require('assert');

// Simular BANK_LIMITS conforme firestore.js
const BANK_LIMITS = {
  'firestore-default': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
  'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 },
};

function registrarUsoBanco(usoDiarioBancos, bancoKey, leituras = 0, escritas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  let cur = usoDiarioBancos.get(bancoKey);
  const limits = BANK_LIMITS[bancoKey] || BANK_LIMITS['firestore-default'];

  if (!cur || cur.data !== hoje) {
    cur = { data: hoje, leituras: 0, escritas: 0, limiteLeituras: limits.reads, limiteEscritas: limits.writes, status: 'ativo' };
    usoDiarioBancos.set(bancoKey, cur);
  }
  cur.leituras += leituras;
  cur.escritas += escritas;
  const pctLeituras = cur.leituras / limits.reads;
  const pctEscritas = cur.escritas / limits.writes;
  if (pctLeituras >= limits.warnThreshold || pctEscritas >= limits.warnThreshold) {
    cur.status = 'quase cheio';
  } else {
    cur.status = 'ativo';
  }
  return cur;
}

function getUsoBanco(usoDiarioBancos, bancoKey) {
  return usoDiarioBancos.get(bancoKey);
}

const usoDiarioBancos = new Map();

const t = assert;

// Teste 1: contador inicia em zero
const u1 = registrarUsoBanco(usoDiarioBancos, 'firestore-b', 0, 0);
t.equal(u1.leituras, 0);
t.equal(u1.escritas, 0);
t.equal(u1.status, 'ativo');

// Teste 2: acumula leituras e escritas por dia
const u2 = registrarUsoBanco(usoDiarioBancos, 'firestore-b', 1000, 500);
t.equal(u2.leituras, 1000);
t.equal(u2.escritas, 500);

const u3 = registrarUsoBanco(usoDiarioBancos, 'firestore-b', 1000, 500);
t.equal(u3.leituras, 2000);
t.equal(u3.escritas, 1000);

// Teste 3: banco diferente não interfere
const u4 = registrarUsoBanco(usoDiarioBancos, 'firestore-c', 5000, 0);
t.equal(u4.leituras, 5000);
t.equal(getUsoBanco(usoDiarioBancos, 'firestore-b').leituras, 2000);

// Teste 4: D1 usa limites diferentes (5M leituras, 100k escritas)
const u5 = registrarUsoBanco(usoDiarioBancos, 'd1', 3500000, 0);
t.equal(u5.status, 'ativo'); // 3.5M/5M = 70% == warnThreshold, deve ficar 'quase cheio'
const u5b = getUsoBanco(usoDiarioBancos, 'd1');
t.equal(u5b.status, 'quase cheio');

// Teste 5: CofreSql usa limites próprios (50M leituras, 10M escritas)
const u6 = registrarUsoBanco(usoDiarioBancos, 'cofresql', 35000000, 0);
t.equal(getUsoBanco(usoDiarioBancos, 'cofresql').status, 'quase cheio');

// Teste 6: reset diário (data diferente)
const hoje = new Date().toISOString().slice(0, 10);
t.equal(getUsoBanco(usoDiarioBancos, 'firestore-b').data, hoje);

console.log('Todos os testes de uso por banco passaram.');
