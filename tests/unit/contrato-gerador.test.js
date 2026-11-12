'use strict';
// Gerador de contrato: IA escreve só o teste; portões impedem teste inútil, perigoso ou que já passa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gerar, conferir } = require('../../nexia-ai/contrato/gerador');
const { executar } = require('../../nexia-ai/contrato/executor');

const semContexto = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
const rodar = raiz => async cmd => {
  try { execFileSync(process.execPath, cmd.split(' ').slice(1), { cwd: raiz, stdio: 'pipe', timeout: 60000, env: semContexto() }); return { ok: true, saida: '' }; }
  catch (e) { return { ok: false, saida: String(e.stdout || '') + String(e.stderr || '') }; }
};
const repo = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kx-gerador-'));
const TESTE_BOM = "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { dobro } = require('../../lib/dobro');\ntest('dobro', () => {\n  assert.equal(dobro(2), 4);\n  assert.equal(dobro(0), 0);\n  assert.throws(() => dobro('x'));\n});\n";
const proposta = (o = {}) => JSON.stringify({ testavel: true, arquivos: ['lib/dobro.js'], teste: 'tests/unit/contrato-dobro.test.js', codigo: TESTE_BOM, ...o });
const roteiro = r => { const vistos = []; return { vistos, chat: async (m, req) => { vistos.push(req.messages[0].content); return { text: r.shift() || '' }; } }; };
const M = [{ provider: 'gratis', model: 'a' }, { provider: 'gratis', model: 'b' }];

test('GC1. portões recusam: teste fora do lugar, arquivo proibido, import perigoso, poucas asserções, sem importar a solução', () => {
  assert.equal(conferir(JSON.parse(proposta())).ok, true);
  assert.equal(conferir(JSON.parse(proposta({ teste: 'tests/contrato/x.test.js' }))).ok, false);
  assert.equal(conferir(JSON.parse(proposta({ arquivos: ['.github/workflows/ci.yml'] }))).ok, false);
  assert.equal(conferir(JSON.parse(proposta({ arquivos: ['tests/unit/a.js'] }))).ok, false);
  assert.match(conferir(JSON.parse(proposta({ codigo: TESTE_BOM.replace("require('node:test')", "require('node:test'); require('node:child_process')") }))).erros.join(), /importa o que não pode: node:child_process/);
  assert.match(conferir(JSON.parse(proposta({ codigo: TESTE_BOM + '\nprocess.env.X;' }))).erros.join(), /recurso proibido/);
  assert.match(conferir(JSON.parse(proposta({ codigo: TESTE_BOM.replace(/assert\.(throws|equal)\(dobro\((0|'x')\)[^\n]*\n/g, '') }))).erros.join(), /poucas asserções/);
  assert.match(conferir(JSON.parse(proposta({ codigo: TESTE_BOM.replace("require('../../lib/dobro')", "require('node:assert')") }))).erros.join(), /não importa nem lê nenhum arquivo da solução/);
});

test('GC2. pedido de tela/texto volta "não testável" (segue o caminho antigo)', async () => {
  const r = await gerar({ pedido: 'Mudar a cor do botão', raiz: repo(), router: roteiro(['{"testavel": false, "motivo": "é visual"}']), modelos: M, rodarTeste: rodar(repo()) });
  assert.deepEqual([r.ok, r.nao_testavel, r.motivo], [false, true, 'é visual']);
});

test('GC3. teste recusado volta com o motivo; o aceito precisa FALHAR no código atual e fica gravado', async () => {
  const raiz = repo();
  const rt = roteiro([proposta({ codigo: TESTE_BOM + "\nrequire('node:child_process');" }), proposta()]);
  const r = await gerar({ pedido: 'Função dobro(n) em lib/dobro.js; texto lança erro', raiz, router: rt, modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(r.ok, true);
  assert.equal(r.tentativas, 2);
  assert.match(rt.vistos[1], /RECUSADA: .*child_process/);
  assert.deepEqual(r.contrato.arquivos, ['lib/dobro.js']);
  assert.equal(r.contrato.teste, 'node --test tests/unit/contrato-dobro.test.js');
  assert.ok(fs.existsSync(path.join(raiz, 'tests/unit/contrato-dobro.test.js')));
});

test('GC4. teste que já passa é recusado e apagado', async () => {
  const raiz = repo();
  fs.mkdirSync(path.join(raiz, 'lib'));
  fs.writeFileSync(path.join(raiz, 'lib/dobro.js'), "module.exports = { dobro: n => { if (typeof n !== 'number') throw new Error('x'); return n * 2; } };\n");
  const r = await gerar({ pedido: 'dobro', raiz, router: roteiro([proposta(), proposta(), proposta(), proposta()]), modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /já passa/);
  assert.equal(fs.existsSync(path.join(raiz, 'tests/unit/contrato-dobro.test.js')), false);
});

test('GC5. ponta a ponta: pedido → contrato gerado → executor resolve → teste passa', async () => {
  const raiz = repo();
  // Portão 7: arquivo novo precisa ser nomeado no pedido (senão é entrega solta fora do produto).
  const g = await gerar({ pedido: 'Criar lib/dobro.js com dobro(n)', raiz, router: roteiro([proposta()]), modelos: M, rodarTeste: rodar(raiz) });
  const solucao = "ARQUIVO: lib/dobro.js\n```js\nmodule.exports = { dobro: n => { if (typeof n !== 'number') throw new TypeError('número'); return n * 2; } };\n```\n";
  const e = await executar({ contrato: g.contrato, raiz, router: roteiro([solucao]), modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(e.ok, true);
  assert.deepEqual(e.arquivos, ['lib/dobro.js']);
});

test('GC6. fila: com contrato vai direto; sem contrato tenta gerar; já devolvido (não testável/falhou) segue o caminho antigo', () => {
  const { vaiParaContrato } = require('../../scripts/cortex-fila');
  assert.equal(vaiParaContrato({ tarefa: 'x\nArquivos: `lib/a.js`\nTeste: `node --test tests/unit/a.test.js`', rotulos: [] }, {}), true);
  assert.equal(vaiParaContrato({ tarefa: 'Criar função de soma', rotulos: [] }, {}), true);
  assert.equal(vaiParaContrato({ tarefa: 'Criar função de soma', rotulos: ['contrato-nao-testavel'] }, {}), false);
  assert.equal(vaiParaContrato({ tarefa: 'Criar função de soma', rotulos: ['contrato-falhou'] }, {}), false);
  assert.equal(vaiParaContrato({ tarefa: 'Criar função de soma', rotulos: [] }, { CONTRATO_GERAR: '0' }), false);
});

test('motivoCurto: diz por que a IA não respondeu, sem vazar chave', () => {
  const { motivoCurto } = require('../../nexia-ai/contrato/gerador');
  const m = motivoCurto(Object.assign(new Error('401 Unauthorized: key sk-abcdefghijklmnopqrstuvwxyz123456 invalid'), { status: 401 }));
  assert.match(m, /^401: /);
  assert.doesNotMatch(m, /sk-abcdef/);
  assert.ok(motivoCurto(new Error('x'.repeat(500))).length <= 160);
});
