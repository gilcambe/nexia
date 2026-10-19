'use strict';
const { strict: assert } = require('node:assert');
const { describe: describe, it: it } = require('node:test');
const { createPlacar, parseReset } = require('../../nexia-ai/model-router/cota');

const DESC_A = { provider: 'groq', model: 'llama-3.1-8b' };
const DESC_B = { provider: 'groq', model: 'mixtral-8x7b' };

function relogioFalso(inicio = 0) {
  let agora_ = inicio;
  return { agora: () => agora_, avancar: ms => { agora_ += ms; } };
}

describe('placar de cota (model-router/cota)', () => {
  it('marcar daily sem retry bloqueia por 6 h e libera depois', () => {
    const rel = relogioFalso(1000);
    const p = createPlacar({ agora: rel.agora });
    p.marcar(DESC_A, 'daily');
    assert.strictEqual(p.bloqueado(DESC_A), true);
    rel.avancar(6 * 60 * 60 * 1000 - 1);
    assert.strictEqual(p.bloqueado(DESC_A), true);
    rel.avancar(1);
    assert.strictEqual(p.bloqueado(DESC_A), false);
  });

  it('ordenar nunca devolve vazio: todos bloqueados => todos ordenados por ate', () => {
    const rel = relogioFalso(1000);
    const p = createPlacar({ agora: rel.agora });
    p.marcar(DESC_A, 'daily'); // 6 h
    p.marcar(DESC_B, 'fatal'); // 24 h
    const ordem = p.ordenar([DESC_A, DESC_B]);
    assert.strictEqual(ordem.length, 2);
    // daily (6 h) vem antes de fatal (24 h)
    assert.strictEqual(ordem[0], DESC_A);
    assert.strictEqual(ordem[1], DESC_B);
  });

  it('ordenar devolve apenas os não bloqueados', () => {
    const rel = relogioFalso(1000);
    const p = createPlacar({ agora: rel.agora });
    p.marcar(DESC_A, 'daily');
    const ordem = p.ordenar([DESC_A, DESC_B]);
    assert.deepStrictEqual(ordem, [DESC_B]);
  });

  it('importar descarta entradas vencidas', () => {
    const rel = relogioFalso(1000);
    const p = createPlacar({ agora: rel.agora });
    p.importar({
      'groq|llama': { ate: rel.agora() - 1, motivo: 'daily' },
      'groq|mixtral': { ate: rel.agora() + 60000, motivo: 'rate' },
    });
    assert.strictEqual(p.bloqueado({ provider: 'groq', model: 'llama' }), false);
    assert.strictEqual(p.bloqueado({ provider: 'groq', model: 'mixtral' }), true);
  });

  it('exportar devolve objeto simples de { ate, motivo }', () => {
    const rel = relogioFalso(1000);
    const p = createPlacar({ agora: rel.agora });
    p.marcar(DESC_A, 'daily');
    const exp = p.exportar();
    const k = 'groq|llama-3.1-8b';
    assert.ok(exp[k]);
    assert.strictEqual(exp[k].motivo, 'daily');
    assert.strictEqual(exp[k].ate, rel.agora() + 6 * 60 * 60 * 1000);
  });
});

describe('parseReset', () => {
  it('2m59.56s → 179560 ms', () => {
    assert.strictEqual(parseReset('2m59.56s'), 179560);
  });

  it('7.66s → 7660 ms', () => {
    assert.strictEqual(parseReset('7.66s'), 7660);
  });

  it('30 (segundos) → 30000 ms', () => {
    assert.strictEqual(parseReset('30'), 30000);
  });

  it('sem reset → 60 s', () => {
    assert.strictEqual(parseReset(null), 60000);
    assert.strictEqual(parseReset(''), 60000);
    assert.strictEqual(parseReset('invalido'), 60000);
  });
});

describe('registrarCabecalhos', () => {
  it('marca quando remaining-requests é 0 ou 1', () => {
    const p = createPlacar({ agora: () => 1000 });
    const HEADERS = (h) => new Headers(h);

    p.registrarCabecalhos({ provider: 'groq', model: 'a' }, HEADERS({ 'x-ratelimit-remaining-requests': '0' }));
    assert.strictEqual(p.bloqueado({ provider: 'groq', model: 'a' }), true);

    const p2 = createPlacar({ agora: () => 1000 });
    p2.registrarCabecalhos({ provider: 'openrouter', model: 'b' }, HEADERS({ 'x-ratelimit-remaining-requests': '1' }));
    assert.strictEqual(p2.bloqueado({ provider: 'openrouter', model: 'b' }), true);
  });

  it('marca quando remaining-tokens < 2000', () => {
    const p = createPlacar({ agora: () => 1000 });
    p.registrarCabecalhos({ provider: 'mistral', model: 'c' }, new Headers({ 'x-ratelimit-remaining-tokens': '1999' }));
    assert.strictEqual(p.bloqueado({ provider: 'mistral', model: 'c' }), true);
  });

  it('não marca quando há cota sobrando', () => {
    const p = createPlacar({ agora: () => 1000 });
    p.registrarCabecalhos({ provider: 'groq', model: 'd' }, new Headers({
      'x-ratelimit-remaining-requests': '5',
      'x-ratelimit-remaining-tokens': '5000',
    }));
    assert.strictEqual(p.bloqueado({ provider: 'groq', model: 'd' }), false);
  });

  it('não lança com headers ausentes', () => {
    const p = createPlacar({ agora: () => 1000 });
    assert.doesNotThrow(() => p.registrarCabecalhos({ provider: 'groq', model: 'e' }, undefined));
    assert.strictEqual(p.bloqueado({ provider: 'groq', model: 'e' }), false);
  });
});

