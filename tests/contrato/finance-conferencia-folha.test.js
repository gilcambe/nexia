'use strict';
// Contrato (épico #4013, fase 6; manual seções 3 e 4): divergências holerite × espelho de ponto.
// netlify/functions/prumo-lib/conferencia.js exporta conferirFolha(holerite, ponto) e agirConferencia (ação 'folha_conferir',
// ligada em agirExtra). Cada hora do ponto (he50, he75, he100, noturnas, sobreaviso) > 0 precisa de um provento com o
// nome certo no holerite; faltas > 0 precisa de um desconto de falta. Provento pago sem hora no ponto também é divergência.
// prumo/orcamento.js mostra o card id="kf-conferencia" com as divergências (ou "tudo bate").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const cf = require(path.join(raiz, 'netlify/functions/prumo-lib/conferencia.js'));

const HOL = { mes: '2026-11', proventos: [{ nome: 'Salário base', valor: 6000 }, { nome: 'Hora Extra 50%', valor: 410.2 }, { nome: 'Adicional Noturno', valor: 120 }], descontos: [{ nome: 'INSS', valor: 700 }] };

test('tudo bate: horas do ponto pagas no holerite', () => {
  const r = cf.conferirFolha(HOL, { mes: '2026-10', he50: 10, noturnas: 6 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.divergencias, []);
  assert.equal(r.itens.find((x) => x.campo === 'he50').provento, 'Hora Extra 50%');
});

test('hora no ponto sem pagamento, falta sem desconto e pago sem hora', () => {
  const r = cf.conferirFolha(HOL, { mes: '2026-10', he50: 0, he100: 4, faltas: 8, noturnas: 6 });
  assert.equal(r.ok, false);
  const c = r.divergencias.map((d) => d.campo).sort();
  assert.deepEqual(c, ['faltas', 'he100', 'he50']);
  const he50 = r.divergencias.find((d) => d.campo === 'he50');
  assert.equal(he50.tipo, 'pago_sem_ponto');
  assert.equal(r.divergencias.find((d) => d.campo === 'he100').tipo, 'ponto_sem_pagamento');
  for (const d of r.divergencias) assert.ok(d.texto && d.texto.length > 10, 'explica em português');
});

test('HE 100% não confunde com HE 50%; sem dados não quebra', () => {
  const r = cf.conferirFolha({ proventos: [{ nome: 'H.E. 100%', valor: 300 }] }, { he100: 3 });
  assert.equal(r.ok, true);
  assert.equal(cf.conferirFolha(null, null).ok, true);
});

test('ação folha_conferir ligada e card na tela de salário', () => {
  assert.equal(typeof cf.agirConferencia, 'function');
  assert.match(ler('netlify/functions/prumo-lib/conferencia.js'), /'folha_conferir'/);
  assert.match(ler('netlify/functions/prumo-lib/extra.js'), /require\('\.\/conferencia'\)/);
  const t = ler('prumo/orcamento.js');
  assert.match(t, /folha_conferir/);
  assert.match(t, /kf-conferencia/);
});
