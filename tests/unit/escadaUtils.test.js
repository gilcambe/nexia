/**
 * Teste unitário de escadaUtils - lógica pura que conta issues por degrau.
 * Roda com `npm test` (node --test).
 */
const test = require('node:test');
const assert = require('node:assert');
const { semana, percentCortex, fila, faseB, contarPorDegrau } = require('../../src/lib/escadaUtils.js');

function issue(sobrescrito = {}) {
  return {
    data: '2026-10-09T10:00:00Z', // sexta-feira
    status: 'open',
    labels: [],
    ...sobrescrito,
  };
}

test('escadaUtils.semana - retorna zeros para array vazio', () => {
  const resultado = semana([]);
  assert.deepEqual(resultado, {
    seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0,
  });
});

test('escadaUtils.semana - conta issues pelo dia da semana', () => {
  const issues = [
    issue({ data: '2026-10-05T08:00:00Z' }), // segunda-feira
    issue({ data: '2026-10-05T09:00:00Z' }), // segunda-feira
    issue({ data: '2026-10-06T08:00:00Z' }), // terça-feira
    issue({ data: '2026-10-11T08:00:00Z' }), // domingo
  ];
  const resultado = semana(issues);
  assert.deepEqual(resultado, {
    seg: 2, ter: 1, qua: 0, qui: 0, sex: 0, sab: 0, dom: 1,
  });
});

test('escadaUtils.semana - ignora issues sem data ou com data inválida', () => {
  const issues = [
    issue({ data: 'invalida' }),
    issue({ data: '' }),
    issue({ data: null }),
    issue({ data: '2026-10-05T08:00:00Z' }), // segunda-feira
  ];
  const resultado = semana(issues);
  assert.deepEqual(resultado, {
    seg: 1, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0,
  });
});

test('escadaUtils.semana - não muta o array de entrada', () => {
  const issues = [issue({ data: '2026-10-05T08:00:00Z' })];
  const antes = JSON.stringify(issues);
  semana(issues);
  const depois = JSON.stringify(issues);
  assert.strictEqual(depois, antes);
});

test('escadaUtils.percentCortex - retorna 0 para array vazio', () => {
  const resultado = percentCortex([]);
  assert.strictEqual(resultado, 0);
});

test('escadaUtils.percentCortex - calcula percentual de issues do Cortex', () => {
  const issues = [
    issue({ labels: ['cortex'] }),
    issue({ labels: ['cortex'] }),
    issue({ labels: ['outro'] }),
    issue({ labels: [] }),
  ];
  const resultado = percentCortex(issues);
  assert.strictEqual(resultado, 50);
});

test('escadaUtils.percentCortex - retorna 100 quando todas são do Cortex', () => {
  const issues = [issue({ labels: ['cortex'] }), issue({ labels: ['cortex'] })];
  const resultado = percentCortex(issues);
  assert.strictEqual(resultado, 100);
});

test('escadaUtils.fila - retorna 0 para array vazio', () => {
  const resultado = fila([]);
  assert.strictEqual(resultado, 0);
});

test('escadaUtils.fila - conta issues na fila (open ou fila)', () => {
  const issues = [
    issue({ status: 'open' }),
    issue({ status: 'fila' }),
    issue({ status: 'closed' }),
    issue({ status: 'concluida' }),
  ];
  const resultado = fila(issues);
  assert.strictEqual(resultado, 2);
});

test('escadaUtils.faseB - retorna 0 para array vazio', () => {
  const resultado = faseB([]);
  assert.strictEqual(resultado, 0);
});

test('escadaUtils.faseB - conta issues na fase B (fase-b, faseB, fase b)', () => {
  const issues = [
    issue({ labels: ['fase-b'] }),
    issue({ labels: ['faseB'] }),
    issue({ labels: ['fase b'] }),
    issue({ labels: ['outro'] }),
  ];
  const resultado = faseB(issues);
  assert.strictEqual(resultado, 3);
});

test('escadaUtils.contarPorDegrau - gera o JSON esperado com semana, percentCortex, fila e faseB', () => {
  const issues = [
    issue({ data: '2026-10-05T08:00:00Z', status: 'open', labels: ['cortex', 'fase-b'] }), // segunda
    issue({ data: '2026-10-06T08:00:00Z', status: 'closed', labels: ['outro'] }), // terça
    issue({ data: '2026-10-09T10:00:00Z', status: 'fila', labels: ['cortex'] }), // sexta
  ];
  const resultado = contarPorDegrau(issues);

  assert.ok(resultado.semana);
  assert.ok(resultado.percentCortex);
  assert.ok(resultado.fila);
  assert.ok(resultado.faseB);
  assert.strictEqual(resultado.semana.seg, 1);
  assert.strictEqual(resultado.semana.ter, 1);
  assert.strictEqual(resultado.semana.sex, 1);
  assert.strictEqual(resultado.percentCortex, 67); // 2 de 3
  assert.strictEqual(resultado.fila, 2); // open + fila
  assert.strictEqual(resultado.faseB, 1); // apenas o primeiro
});