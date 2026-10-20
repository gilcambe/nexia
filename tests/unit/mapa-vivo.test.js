'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const m = require('../../scripts/gerar-mapa.js');

const RAIZ = path.resolve(__dirname, '..', '..');

test('MAPA1. mapa do repositório traz rotas, segredos (só nomes) e workflows', () => {
  const t = m.gerarMapa(RAIZ);
  assert.match(t, /^# MAPA vivo do NEXIA/);
  assert.match(t, /- `\/api\/central` → `central`/);
  assert.match(t, /- `ci\.yml` — CI \(.*pull_request.*\)/);
  assert.match(t, /- `BREVO_API_KEY` EW?/);
  // Só nomes: nenhuma linha de segredo com "=" ou valor.
  const secao = t.slice(t.indexOf('## Segredos'), t.indexOf('## Workflows'));
  assert.ok(!/=/.test(secao));
});

test('MAPA2. lê workflows, gatilhos e segredos usados num repositório falso', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-'));
  fs.mkdirSync(path.join(raiz, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(raiz, '.github', 'workflows', 'a.yml'), "name: Robô A\non:\n  schedule:\n    - cron: '0 * * * *'\n  workflow_dispatch:\njobs:\n  x:\n    env:\n      K: ${{ secrets.CHAVE_A }}\n");
  fs.writeFileSync(path.join(raiz, '.github', 'workflows', 'b.yml'), 'name: B\non: [push, pull_request]\n');
  fs.writeFileSync(path.join(raiz, '.env.example'), '# comentário\nCHAVE_A=\nOUTRA=valor-exemplo\n');
  const wf = m.workflows(raiz);
  assert.deepStrictEqual(wf.map((w) => [w.arquivo, w.nome, w.gatilhos, w.segredos]), [
    ['a.yml', 'Robô A', ['schedule', 'workflow_dispatch'], ['CHAVE_A']],
    ['b.yml', 'B', ['push', 'pull_request'], []],
  ]);
  assert.deepStrictEqual(m.segredosDoEnv(raiz), ['CHAVE_A', 'OUTRA']);
  const t = m.gerarMapa(raiz);
  assert.match(t, /- `CHAVE_A` EW: a\.yml/);
  assert.ok(!t.includes('valor-exemplo'));
});

test('MAPA3. o Cortex recebe o mapa vivo no contexto do pedido', () => {
  const ap = require('../../nexia-ai/context-engine/arquivos-provaveis.js');
  const c = ap.contextoDoRepo({ raiz: RAIZ, texto: 'central cotas', spawn: () => ({ status: 1, stdout: '' }) });
  assert.match(c.texto, /### Mapa vivo \(gerado do código agora\)\nRotas da API/);
  assert.match(c.texto, /\/api\/central→central/);
});

test('MAPA4. docs/MAPA.md existe e foi gerado pelo script', () => {
  const t = fs.readFileSync(path.join(RAIZ, 'docs', 'MAPA.md'), 'utf8');
  assert.match(t, /^# MAPA vivo do NEXIA \(gerado do código\)/);
});
