// #819 Contexto do projeto no prompt: MAPA.md + 5 a 8 arquivos prováveis achados pelas palavras do pedido.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ap = require('../../nexia-ai/context-engine/arquivos-provaveis');

function repoFalso() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-repo-'));
  const pôr = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true }); fs.writeFileSync(path.join(raiz, rel), txt); };
  pôr('MAPA.md', '# MAPA\n- `apps/body-coach/` app\n');
  pôr('apps/body-coach/src/lib/lembretes.ts', 'export const lembrete = "Hora da refeição";');
  pôr('apps/body-coach/src/pages/nutrition/Refeicoes.tsx', 'export default function Refeicoes() { return "refeição do aluno"; }');
  pôr('netlify/functions/body-coach-chat.js', 'module.exports = "chat do aluno";');
  pôr('sites/bezsan/index.html', '<p>Leilões</p>');
  pôr('node_modules/x/lembretes.js', 'refeição lembrete');
  pôr('docs/referencia/velho/lembretes.js', 'refeição lembrete');
  pôr('nexia-audit/relatorio.md', 'refeição lembrete');
  pôr('tests/unit/lembretes.test.js', 'lembrete refeição');
  return raiz;
}

test('CTX1. palavras do pedido: sem palavras vazias, identificadores primeiro, com e sem acento', () => {
  const p = ap.palavrasDoPedido('Crie um lembrete de refeição no cortex-fila para o aluno em https://x.com/abc');
  assert.equal(p[0], 'cortex-fila');
  assert.ok(p.includes('lembrete') && p.includes('refeição') && p.includes('aluno'));
  for (const v of ['crie', 'para', 'cortex', 'https']) assert.ok(!p.includes(v), v);
  assert.match('refeicao', new RegExp(ap.regexSemAcento('refeição')));
  assert.match('Refeição', new RegExp(ap.regexSemAcento('refeicao'), 'i'));
});

for (const modo of ['rg', 'node']) {
  test(`CTX2. arquivos prováveis (${modo}): acha os reais, ignora node_modules, referência e auditoria, no máximo 8`, () => {
    const raiz = repoFalso();
    const spawn = modo === 'node' ? () => ({ error: new Error('sem rg') }) : undefined;
    const r = ap.arquivosProvaveis({ raiz, texto: 'Lembrete de refeicao para o aluno', ...(spawn ? { spawn } : {}) });
    const caminhos = r.arquivos.map((a) => a.path);
    if (modo === 'node') assert.equal(r.busca, 'node');
    assert.ok(caminhos.includes('apps/body-coach/src/lib/lembretes.ts'), caminhos.join());
    assert.ok(caminhos.includes('apps/body-coach/src/pages/nutrition/Refeicoes.tsx'));
    assert.ok(!caminhos.some((c) => /node_modules|referencia|nexia-audit|bezsan/.test(c)), caminhos.join());
    assert.ok(caminhos.indexOf('apps/body-coach/src/lib/lembretes.ts') < caminhos.indexOf('tests/unit/lembretes.test.js'), 'código antes do teste');
    assert.ok(caminhos.length <= 8);
  });
}

test('CTX3. texto do prompt leva o MAPA.md e a lista; sem repositório no disco não busca nada', () => {
  const raiz = repoFalso();
  const c = ap.contextoDoRepo({ raiz, texto: 'lembrete de refeição' });
  assert.match(c.texto, /### Mapa do repositório \(MAPA\.md\)\n# MAPA/);
  assert.match(c.texto, /### Arquivos prováveis para este pedido/);
  assert.match(c.texto, /- apps\/body-coach\/src\/lib\/lembretes\.ts \(tem: /);
  assert.match(c.texto, /Não invente caminhos/);
  assert.deepEqual(ap.contextoDoRepo({ raiz: null, texto: 'x' }), { texto: '', arquivos: [] });
  const repo = { owner: 'gilcambe', repo: 'nexia' };
  assert.equal(ap.raizLocal(repo, { GITHUB_WORKSPACE: raiz, GITHUB_REPOSITORY: 'gilcambe/nexia' }), raiz);
  assert.equal(ap.raizLocal(repo, { GITHUB_WORKSPACE: raiz, GITHUB_REPOSITORY: 'outro/site' }), null, 'repositório de cliente não é o do disco');
  assert.equal(ap.raizLocal(repo, {}), null);
});

test('CTX4. o repositório tem MAPA.md e o orquestrador usa o contexto e pré-lê os prováveis quando nada foi citado', () => {
  const R = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
  const mapa = R('MAPA.md');
  for (const p of ['cloudflare/worker.js', 'netlify/functions/', 'nexia-ai/orchestrator/', 'apps/body-coach/src/', 'firestore.rules']) assert.ok(mapa.includes(p), p);
  assert.ok(mapa.split('\n').length <= 80, 'cabe inteiro no prompt');
  const o = R('nexia-ai/orchestrator/index.js');
  assert.match(o, /require\('\.\.\/context-engine\/arquivos-provaveis'\)/);
  assert.match(o, /\(await getRepoCtx\(\)\)\.texto/);
  assert.match(o, /citados\.length \? citados : \(\(await getRepoCtx\(\)\)\.arquivos \|\| \[\]\)\.slice\(0, 4\)/);
});
