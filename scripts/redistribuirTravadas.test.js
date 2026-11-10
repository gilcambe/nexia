const test = require('node:test');
const assert = require('node:assert');
const { redistribuirTravadas, aplicarNoGitHub, CONSERTO_SMOKE } = require('./redistribuirTravadas.js');

test('redistribuirTravadas processa as 12 tarefas travadas corretamente', () => {
  const issuesMock = Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    labels: ['cortex-travado', 'precisa-de-voce', 'reserva-tentou', 'outra-label']
  }));

  const resultado = redistribuirTravadas(issuesMock);

  assert.strictEqual(resultado.tratadas.length, 12);
  assert.strictEqual(resultado.consertoSmoke, CONSERTO_SMOKE);

  for (const t of resultado.tratadas) {
    assert.ok(!t.novosLabels.includes('precisa-de-voce'));
    assert.ok(!t.novosLabels.includes('reserva-tentou'));
    assert.ok(!t.novosLabels.includes('cortex-travado'));
    assert.ok(t.novosLabels.includes('cortex-reserva.yml'));
    assert.ok(t.novosLabels.includes('outra-label'));
  }
});

test('aplicarNoGitHub chama ghFn para remover e adicionar rótulos', async () => {
  const chamadas = [];
  const fakeGh = async (token, method, path, body) => {
    chamadas.push({ method, path, body });
    return { status: 200, json: {} };
  };

  const tratadas = [
    {
      number: 101,
      labelsRemovidos: ['cortex-travado', 'precisa-de-voce'],
      labelsAdicionados: ['cortex-reserva.yml']
    }
  ];

  const resultado = await aplicarNoGitHub('fake-token', tratadas, fakeGh);
  assert.deepStrictEqual(resultado, [101]);
  assert.strictEqual(chamadas.length, 3);
  assert.strictEqual(chamadas[0].method, 'DELETE');
  assert.strictEqual(chamadas[0].path, '/issues/101/labels/cortex-travado');
  assert.strictEqual(chamadas[1].method, 'DELETE');
  assert.strictEqual(chamadas[1].path, '/issues/101/labels/precisa-de-voce');
  assert.strictEqual(chamadas[2].method, 'POST');
  assert.strictEqual(chamadas[2].path, '/issues/101/labels');
  assert.deepStrictEqual(chamadas[2].body, { labels: ['cortex-reserva.yml'] });
});
