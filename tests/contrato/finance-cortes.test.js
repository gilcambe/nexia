'use strict';
// Contrato (épico #4013, fase 9; manual seção 8): cada oportunidade de economia tem evidência, impacto anual,
// prioridade e acompanhamento. netlify/functions/prumo-lib/cortes.js exporta oportunidadesCorte(d) e STATUS.
// d = { assinaturas: [{ nome, valor }], limites: [{ categoria, limite, gasto }] } (valores mensais).
// Cada item: { id, tipo: 'assinatura'|'limite', titulo, evidencia, mensal, impacto_anual = mensal*12, prioridade: 'alta'|'media'|'baixa' }.
// Limite estourado: mensal = gasto − limite. Ordem: maior impacto_anual primeiro. prioridade alta >= 1200/ano, media >= 300.
// STATUS = ['revisar','feito','ignorar','adiar']. Ação 'corte_marcar' { id, status } grava em cortes_status (status fora da lista = 400).
// prumo/economizar.js mostra impacto_anual e os 4 botões de status.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const ct = require(path.join(raiz, 'netlify/functions/prumo-lib/cortes.js'));

test('assinaturas e limites viram oportunidades com impacto anual, ordenadas', () => {
  const r = ct.oportunidadesCorte({ assinaturas: [{ nome: 'Streaming', valor: 55.9 }, { nome: 'App', valor: 9.9 }], limites: [{ categoria: 'Delivery', limite: 300, gasto: 450 }, { categoria: 'Mercado', limite: 900, gasto: 700 }] });
  assert.deepEqual(r.map((x) => x.impacto_anual), [1800, 670.8, 118.8]);
  assert.deepEqual(r.map((x) => x.prioridade), ['alta', 'media', 'baixa']);
  assert.equal(r[0].tipo, 'limite'); assert.equal(r[0].mensal, 150);
  for (const x of r) assert.ok(x.id && x.titulo && x.evidencia, 'id, título e evidência');
});

test('sem dados: lista vazia; STATUS do manual', () => {
  assert.deepEqual(ct.oportunidadesCorte({}), []);
  assert.deepEqual(ct.STATUS, ['revisar', 'feito', 'ignorar', 'adiar']);
});

test('corte_marcar no servidor e botões na tela', () => {
  const s = ler('netlify/functions/prumo-lib/cortes.js');
  assert.match(s, /'corte_marcar'/); assert.match(s, /cortes_status/);
  assert.match(ler('netlify/functions/prumo-lib/extra.js'), /require\('\.\/cortes'\)/, 'ligado em agirExtra (prumo-lib/extra.js)');
  const t = ler('prumo/economizar.js');
  assert.match(t, /corte_marcar/); assert.match(t, /impacto_anual/);
});
