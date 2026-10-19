'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { createCache } = require('./cache');

describe('createCache', () => {
  test('get devolve undefined para chave inexistente', () => {
    const c = createCache();
    assert.strictEqual(c.get('nao-existe'), undefined);
  });

  test('set/get armazena e devolve o valor', () => {
    const c = createCache();
    c.set('a', { texto: 'resposta' });
    assert.deepStrictEqual(c.get('a'), { texto: 'resposta' });
  });

  test('chave eh sha256 deterministico de { system, messages }', () => {
    const c = createCache();
    const req = { system: 's', messages: [{ role: 'user', content: 'oi' }] };
    const k1 = c.chave(req);
    const k2 = c.chave(req);
    assert.strictEqual(k1, k2);
    assert.strictEqual(k1.length, 64);
    const k3 = c.chave({ system: 's', messages: [{ role: 'user', content: 'outro' }] });
    assert.notStrictEqual(k1, k3);
  });

  test('LRU remove a mais antiga ao exceder max', () => {
    const c = createCache({ max: 2 });
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' vira a mais recente; 'b' fica mais antiga
    c.set('c', 3); // excede max: remove 'b'
    assert.strictEqual(c.get('a'), 1);
    assert.strictEqual(c.get('b'), undefined);
    assert.strictEqual(c.get('c'), 3);
  });

  test('item vencido eh ignorado e removido', () => {
    let tempo = 1000;
    const c = createCache({ ttlMs: 100, agora: () => tempo });
    c.set('a', 1);
    assert.strictEqual(c.get('a'), 1);
    tempo = 2000; // venceu
    assert.strictEqual(c.get('a'), undefined);
  });

  test('defaults: max 500 e ttl 24h', () => {
    const c = createCache();
    c.set('x', 1);
    assert.strictEqual(c.get('x'), 1);
    assert.strictEqual(typeof c.chave, 'function');
    assert.strictEqual(typeof c.get, 'function');
    assert.strictEqual(typeof c.set, 'function');
  });
});
