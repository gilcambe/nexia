'use strict';
// 17/11, celular do dono: o holerite "não era reconhecido". O servidor nem chegava a responder: o app desistia em 25 s
// (só ler_print tinha 3 min) e a leitura com as IAs grátis leva até 75 s. Regra: TODA ação de ler imagem tem o prazo longo,
// e a tela do salário mostra o erro em vez de recarregar calada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

test('toda ação *_ler do servidor ganha o prazo longo no app', () => {
  const app = ler('prumo/app.js');
  const m = app.match(/const LEITURA_IMG = (\/.+\/);/);
  assert.ok(m, 'app.js define LEITURA_IMG');
  const re = eval(m[1]); // eslint-disable-line no-eval
  assert.match(app, /LEITURA_IMG\.test\(String\(acao\)\) \? 180000/);
  const dir = path.join(raiz, 'netlify/functions/prumo-lib');
  const fontes = [ler('netlify/functions/prumo.js'), ...fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))].join('\n');
  const acoes = [...new Set([...fontes.matchAll(/case '([a-z_]+_ler|ler_print)'/g)].map((x) => x[1]))];
  assert.ok(acoes.length >= 8, `achou ${acoes.length} ações de leitura`);
  for (const a of acoes) assert.ok(re.test(a), `${a} precisa do prazo longo`);
  for (const a of ['inicio_resumo', 'salario_previsao', 'carteira_listar']) assert.ok(!re.test(a), `${a} fica com 25 s`);
});

test('salário não engole o erro da leitura', () => {
  const s = ler('prumo/orcamento.js');
  assert.doesNotMatch(s, /catch \{ return recarregar\(\); \}/);
  assert.match(s, /catch \(e\) \{ await recarregar\(\); return ok\(/);
});
