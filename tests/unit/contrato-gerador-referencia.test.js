'use strict';
// Melhoria 22 (portão 9): o teste gerado só vale se a solução de REFERÊNCIA da própria IA passar nele.
// Pega teste impossível ou contraditório antes de gastar a escada inteira.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gerar } = require('../../nexia-ai/contrato/gerador');

const semContexto = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
const rodar = raiz => async cmd => {
  try { execFileSync(process.execPath, cmd.split(' ').slice(1), { cwd: raiz, stdio: 'pipe', timeout: 60000, env: semContexto() }); return { ok: true, saida: '' }; }
  catch (e) { return { ok: false, saida: String(e.stdout || '') + String(e.stderr || '') }; }
};
const repo = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kx-ref-'));
const TESTE = "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { dobro } = require('../../lib/dobro');\ntest('dobro', () => {\n  assert.equal(dobro(2), 4);\n  assert.equal(dobro(0), 0);\n  assert.throws(() => dobro('x'));\n});\n";
// Teste contraditório: dobro(2) tem que ser 4 E 5 ao mesmo tempo.
const IMPOSSIVEL = TESTE.replace("assert.equal(dobro(0), 0);", "assert.equal(dobro(2), 5);");
const SOL_BOA = "module.exports.dobro = n => { if (typeof n !== 'number') throw new Error('x'); return n * 2; };\n";
const proposta = (o = {}) => JSON.stringify({ testavel: true, arquivos: ['lib/dobro.js'], teste: 'tests/unit/contrato-dobro.test.js', codigo: TESTE, solucao: { 'lib/dobro.js': SOL_BOA }, ...o });
const roteiro = r => { const vistos = []; return { vistos, chat: async (m, req) => { vistos.push(req.messages[0].content); return { text: r.shift() || '' }; } }; };
const M = [{ provider: 'gratis', model: 'a' }];
const PEDIDO = 'Função dobro(n) em lib/dobro.js; texto lança erro';

test('R1. referência passa no teste: contrato aceito, e a referência é DESCARTADA (a solução não fica no projeto)', async () => {
  const raiz = repo();
  const rt = roteiro([proposta()]);
  const r = await gerar({ pedido: PEDIDO, raiz, router: rt, modelos: M, rodarTeste: rodar(raiz), referencia: true });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(path.join(raiz, 'tests/unit/contrato-dobro.test.js')));
  assert.equal(fs.existsSync(path.join(raiz, 'lib/dobro.js')), false, 'a referência não pode ficar: outra IA implementa');
  assert.match(rt.vistos[0], /referencia pedida/);
});

test('R2. teste contraditório: a referência não passa, o teste é recusado e a IA recebe o motivo', async () => {
  const raiz = repo();
  const rt = roteiro([proposta({ codigo: IMPOSSIVEL }), proposta()]);
  const r = await gerar({ pedido: PEDIDO, raiz, router: rt, modelos: M, rodarTeste: rodar(raiz), referencia: true });
  assert.equal(r.ok, true);
  assert.equal(r.tentativas, 2);
  assert.match(rt.vistos[1], /RECUSADA: a sua solução de referência NÃO passou/);
  assert.equal(fs.readFileSync(path.join(raiz, 'tests/unit/contrato-dobro.test.js'), 'utf8'), TESTE, 'fica o teste possível');
});

test('R3. sem "solucao" (ou solução para arquivo fora do contrato) é recusado', async () => {
  const raiz = repo();
  const semSol = JSON.parse(proposta()); delete semSol.solucao;
  const rt = roteiro([JSON.stringify(semSol), proposta({ solucao: { 'lib/outro.js': SOL_BOA } })]);
  const r = await gerar({ pedido: PEDIDO, raiz, router: rt, modelos: M, rodarTeste: rodar(raiz), referencia: true });
  assert.equal(r.ok, false);
  assert.match(rt.vistos[1], /faltou "solucao"/);
  assert.equal(fs.existsSync(path.join(raiz, 'lib/outro.js')), false);
});

test('R4. arquivo que já existia volta ao original depois da prova', async () => {
  const raiz = repo();
  fs.mkdirSync(path.join(raiz, 'lib'));
  fs.writeFileSync(path.join(raiz, 'lib/dobro.js'), 'module.exports.dobro = n => n;\n');
  const r = await gerar({ pedido: PEDIDO, raiz, router: roteiro([proposta()]), modelos: M, rodarTeste: rodar(raiz), referencia: true });
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(path.join(raiz, 'lib/dobro.js'), 'utf8'), 'module.exports.dobro = n => n;\n');
});
