'use strict';
// #3419 / #3418: "cortex-travado" não é estado final. Tarefa travada que nunca passou pelo executor de contrato
// (escada de IAs grátis + PC 2 + Claude Pro, com espera de cota) volta para ele. Só fica parada quem o contrato já
// tentou (contrato-falhou / contrato-nao-testavel) ou quem está com uma pessoa (so-humano, vez-do-claude).
const test = require('node:test');
const assert = require('node:assert/strict');
const { travadasPeloCofre, tentaContrato, MAX_RECUPERAR_POR_CICLO } = require('../../scripts/cortex-fila');

const issue = (n, labels = []) => ({ number: n, body: 'x', author_association: 'OWNER', labels: ['cortex-travado', ...labels].map(name => ({ name })) });
const DEPOIS = '2026-11-10T18:00:00Z';   // travou depois do conserto do ambiente: antes ficava parada para sempre
function githubFalso({ prs = [] } = {}) {
  return async (_t, _m, caminho) => {
    if (/^\/issues\/\d+\/events/.test(caminho)) return { status: 200, json: caminho.endsWith('page=1') ? [{ event: 'labeled', label: { name: 'cortex-travado' }, created_at: DEPOIS }] : [] };
    if (caminho.startsWith('/pulls?state=closed')) return { status: 200, json: prs };
    throw new Error('chamada inesperada: ' + caminho);
  };
}

test('TC1. tentaContrato: travada sem passagem pelo contrato vai; quem o contrato já tentou ou está com pessoa não vai', () => {
  assert.equal(tentaContrato(issue(1)), true);
  assert.equal(tentaContrato(issue(2, ['jules-enviado', 'cortex-jules'])), true, 'Jules parado há dias não segura a tarefa');
  for (const l of ['contrato-falhou', 'contrato-nao-testavel', 'cortex-contrato', 'so-humano', 'vez-do-claude', 'cortex-dividido', 'cortex-alerta']) {
    assert.equal(tentaContrato(issue(3, [l])), false, l);
  }
  assert.equal(tentaContrato({ ...issue(4), pull_request: {} }), false);
});

test('TC2. travadasPeloCofre devolve a travada recente para o contrato (motivo contrato), sem repetir entrega já feita', async () => {
  const issues = [issue(10), issue(11, ['jules-enviado']), issue(12, ['contrato-falhou']), issue(13)];
  const prs = [{ number: 99, merged_at: '2026-11-11T00:00:00Z', title: 'x', body: 'Closes #13' }];
  const r = await travadasPeloCofre('t', issues, { ghFn: githubFalso({ prs }), agora: Date.parse(DEPOIS) + 4 * 24 * 3600 * 1000 });
  assert.deepEqual(r.map(a => [a.numero, a.motivo]), [[10, 'contrato'], [11, 'contrato']]);
  assert.ok(r.every(a => a.tipo === 'reserva-volta'));
});

test('TC3. no máximo MAX_RECUPERAR_POR_CICLO por ciclo', async () => {
  const issues = Array.from({ length: 20 }, (_, k) => issue(100 + k));
  const r = await travadasPeloCofre('t', issues, { ghFn: githubFalso() });
  assert.equal(r.length, MAX_RECUPERAR_POR_CICLO);
});
