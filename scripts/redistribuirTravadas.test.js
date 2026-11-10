const test = require('node:test');
const assert = require('node:assert');
const { redistribuirTravadas, CONSERTO_SMOKE } = require('./redistribuirTravadas.js');

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
