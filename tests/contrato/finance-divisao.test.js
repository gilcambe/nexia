// Contrato (melhoria 7): divisão automática do salário. netlify/functions/prumo-lib/divisao.js exporta
// divisaoSalario({ liquido, fixas }) e agirDivisao (ação 'divisao_salario', ligada em agirExtra; usa o líquido previsto do mês e as contas fixas do orçamento).
// Regra 50/30/20: necessidades = max(fixas, 50%), guardar = 20% (ou o que sobrar, nunca negativo), livre = resto. Valores em centavos certos.
// Devolve { liquido, partes: [{ id:'necessidades'|'livre'|'guardar', nome, valor, pct }] } (somam o líquido quando as fixas cabem nele); liquido <= 0 -> partes [].
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const extra = fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/extra.js'), 'utf8');
const dv = require(path.join(raiz, 'netlify/functions/prumo-lib/divisao.js'));
const m = (r) => Object.fromEntries(r.partes.map((p) => [p.id, p.valor]));
test('50/30/20 quando as fixas cabem', () => { const r = dv.divisaoSalario({ liquido: 10000, fixas: 3000 }); assert.deepEqual(m(r), { necessidades: 5000, livre: 3000, guardar: 2000 }); });
test('fixas grandes comem o livre primeiro', () => { const r = dv.divisaoSalario({ liquido: 10000, fixas: 7000 }); assert.deepEqual(m(r), { necessidades: 7000, livre: 1000, guardar: 2000 }); });
test('fixas maiores que tudo: guardar e livre zero, nunca negativo', () => { const r = dv.divisaoSalario({ liquido: 5000, fixas: 6000.5 }); assert.deepEqual(m(r), { necessidades: 6000.5, livre: 0, guardar: 0 }); });
test('sem salário: vazio; ação ligada', () => { assert.deepEqual(dv.divisaoSalario({ liquido: 0, fixas: 10 }).partes, []); assert.match(extra, /require\('\.\/divisao'\)/); });
