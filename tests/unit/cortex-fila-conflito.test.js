'use strict';
// Fila do Cortex (item 1 do dono, 15/11/2026): PR em conflito com a develop é refeito do zero (lista falsa, sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { decidirConflito, refazerConflitos, MAX_REFAZER_CONFLITO, MARCA_CONFLITO } = require('../../scripts/cortex-fila');

const CORPO = 'Pedido: Mudar a.js para X.\n\nCloses #10\n\nExecution: exec_1';
const pr = (extra = {}) => ({ number: 7, state: 'open', head: { ref: 'nexia/mudar-a-js-abc123', sha: 'f'.repeat(40) }, body: CORPO,
  mergeable: false, mergeable_state: 'dirty', labels: [], ...extra });

test('CFC1. só PR do Cortex aberto e em conflito de verdade é refeito', () => {
  assert.deepStrictEqual(decidirConflito({ pr: pr(), pedido: 'x' }), { tipo: 'refazer', tentativa: 1 });
  assert.strictEqual(decidirConflito({ pr: pr({ mergeable: null, mergeable_state: 'unknown' }), pedido: 'x' }), null);   // calculando
  assert.strictEqual(decidirConflito({ pr: pr({ mergeable: true, mergeable_state: 'clean' }), pedido: 'x' }), null);
  assert.strictEqual(decidirConflito({ pr: pr({ head: { ref: 'claude/x' } }), pedido: 'x' }), null);
  assert.strictEqual(decidirConflito({ pr: pr(), pedido: '' }), null);
  assert.strictEqual(decidirConflito({ pr: pr({ labels: [{ name: 'revisao-manual' }] }), pedido: 'x' }), null);
});

test('CFC2. depois do limite de refeitas pede ajuda', () => {
  assert.deepStrictEqual(decidirConflito({ pr: pr(), pedido: 'x', refeitos: 1 }), { tipo: 'refazer', tentativa: 2 });
  assert.deepStrictEqual(decidirConflito({ pr: pr(), pedido: 'x', refeitos: MAX_REFAZER_CONFLITO }), { tipo: 'ajuda' });
});

function falso({ apagar = 204, fechados = [] } = {}) {
  const chamadas = [];
  const fn = async (_t, m, p, b) => {
    chamadas.push(`${m} ${p}`);
    if (m === 'GET' && p.startsWith('/pulls?state=open')) return { status: 200, json: [pr()] };
    if (m === 'GET' && p === '/pulls/7') return { status: 200, json: pr() };
    if (m === 'GET' && p.startsWith('/pulls?state=closed')) return { status: 200, json: fechados };
    if (m === 'GET' && p.startsWith('/issues/')) return { status: 200, json: [{ body: `${MARCA_CONFLITO}refeito` }] };
    if (m === 'DELETE') return { status: apagar, json: null };
    if (m === 'POST' && p.includes('dispatches')) { chamadas.push(JSON.stringify(b.inputs)); return { status: 204, json: null }; }
    return { status: 200, json: {} };
  };
  return { fn, chamadas };
}

test('CFC3. apaga o ramo, fecha o PR e manda o Cortex refazer o mesmo pedido', async () => {
  const { fn, chamadas } = falso();
  assert.strictEqual(await refazerConflitos('t', [], fn), 7);
  const i = k => chamadas.findIndex(c => c.startsWith(k));
  assert.ok(i('DELETE /git/refs/heads/nexia/mudar-a-js-abc123') > -1);
  assert.ok(i('DELETE') < i('PATCH /pulls/7') && i('PATCH /pulls/7') < i('POST /actions/workflows/smoke-logado.yml'));
  const inputs = JSON.parse(chamadas.find(c => c.startsWith('{')));
  assert.strictEqual(inputs.task, 'Mudar a.js para X.\n\nCloses #10');   // mesmo pedido = mesmo nome de ramo
  assert.strictEqual(inputs.tarefa_id, 'PR7');
});

test('CFC4. sem conseguir apagar o ramo não fecha nem refaz', async () => {
  const { fn, chamadas } = falso({ apagar: 403 });
  assert.strictEqual(await refazerConflitos('t', [], fn), null);
  assert.ok(!chamadas.some(c => c.startsWith('PATCH') || c.includes('dispatches') || c.includes('/comments')));
});

test('CFC5. já refeito o máximo de vezes: rotula revisao-manual e não refaz', async () => {
  const { fn, chamadas } = falso({ fechados: [{ number: 5 }, { number: 6 }] });
  assert.strictEqual(await refazerConflitos('t', [], fn), null);
  assert.ok(chamadas.includes('POST /issues/7/labels'));
  assert.ok(!chamadas.some(c => c.startsWith('DELETE') || c.includes('dispatches')));
});

test('CFC6. com outra correção do Cortex rodando, espera', async () => {
  const { fn, chamadas } = falso();
  assert.strictEqual(await refazerConflitos('t', [{ name: 'Cortex #PR9', status: 'in_progress' }], fn), null);
  assert.strictEqual(chamadas.length, 0);
});
