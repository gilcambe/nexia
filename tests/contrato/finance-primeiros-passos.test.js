'use strict';
// Contrato (épico #4013, fase 3; manual seção 2): onboarding em etapas.
// netlify/functions/prumo-lib/onboarding.js exporta etapas(d) e agirOnboarding(acao, ctx) com a ação 'onboarding_status'
// (ligada em agirExtra, prumo-lib/extra.js). d = { salario, jornada, contas, cartoes, fixas, importacoes } (números ou booleanos).
// etapas(d) -> { etapas: [{ id, nome, feito, aba }] nesta ordem, proxima: id da 1ª não feita ou null, feitas, total: 6 }.
// prumo/inicio.js: card id="kf-primeiros-passos" com a próxima etapa e botão para a aba dela; some quando proxima = null.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const ob = require(path.join(raiz, 'netlify/functions/prumo-lib/onboarding.js'));
const ORDEM = [['salario', 'orcamento'], ['jornada', 'carreira'], ['contas', 'contas'], ['cartoes', 'cartoes'], ['fixas', 'gastos'], ['importacoes', 'documentos']];

test('etapas na ordem do manual, com a aba de cada uma', () => {
  const r = ob.etapas({});
  assert.deepEqual(r.etapas.map((e) => [e.id, e.aba]), ORDEM);
  assert.equal(r.total, 6); assert.equal(r.feitas, 0); assert.equal(r.proxima, 'salario');
  for (const e of r.etapas) assert.ok(e.nome && e.feito === false);
});

test('próxima é a primeira não feita; tudo feito -> null', () => {
  const r = ob.etapas({ salario: 1, jornada: true, contas: 2, cartoes: 0, fixas: 3, importacoes: 0 });
  assert.equal(r.proxima, 'cartoes'); assert.equal(r.feitas, 4);
  assert.equal(ob.etapas({ salario: 1, jornada: 1, contas: 1, cartoes: 1, fixas: 1, importacoes: 1 }).proxima, null);
});

test('ação onboarding_status ligada no servidor', () => {
  assert.equal(typeof ob.agirOnboarding, 'function');
  assert.match(ler('netlify/functions/prumo-lib/onboarding.js'), /'onboarding_status'/);
  assert.match(ler('netlify/functions/prumo-lib/extra.js'), /require\('\.\/onboarding'\)/, 'ligado em agirExtra (prumo-lib/extra.js)');
});

test('Início mostra o card de primeiros passos', () => {
  const s = ler('prumo/inicio.js');
  assert.match(s, /onboarding_status/); assert.match(s, /kf-primeiros-passos/);
});
