'use strict';
// Portões 7 e 8 do gerador de contrato (12/11/2026): teste fraco não vale e entrega não fica solta fora do produto.
//   7. a solução mexe em pelo menos 1 arquivo que o produto já tem, ou o pedido nomeia o arquivo novo;
//   8. uma 2ª IA confere se o teste cobre o que o pedido exige (ex.: "pular sábado e domingo"); sem resposta, não trava.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gerar, revisarCobertura } = require('../../nexia-ai/contrato/gerador');

const TESTE = "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { proximoDia } = require('../../lib/agenda');\ntest('dia', () => {\n  assert.equal(proximoDia('2026-11-12'), '2026-11-13');\n  assert.equal(proximoDia('2026-11-30'), '2026-12-01');\n  assert.throws(() => proximoDia('x'));\n});\n";
const proposta = (o = {}) => JSON.stringify({ testavel: true, arquivos: ['lib/agenda.js'], teste: 'tests/unit/contrato-agenda.test.js', codigo: TESTE, ...o });
const roteiro = r => { const vistos = []; return { vistos, chat: async (m, req) => { vistos.push(req.messages[0].content); return { text: r.shift() || '' }; } }; };
const M = [{ provider: 'gratis', model: 'a' }];
const falha = async () => ({ ok: false, saida: 'falhou' });
const repo = (arquivos = {}) => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-portoes-'));
  for (const [a, c] of Object.entries(arquivos)) { fs.mkdirSync(path.dirname(path.join(raiz, a)), { recursive: true }); fs.writeFileSync(path.join(raiz, a), c); }
  return raiz;
};

test('GP1. portão 7: arquivo novo que o pedido não nomeia e que o produto não tem é recusado (entrega solta)', async () => {
  const rt = roteiro([proposta(), proposta(), proposta()]);
  const r = await gerar({ pedido: 'A agenda deve pular sábado e domingo', raiz: repo(), router: rt, modelos: M, rodarTeste: falha });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /arquivo que o produto já usa/);
});

test('GP2. portão 7: arquivo que já existe, ou que o pedido nomeia, passa', async () => {
  const r1 = await gerar({ pedido: 'A agenda deve pular fim de semana', raiz: repo({ 'lib/agenda.js': 'module.exports = {};\n' }), router: roteiro([proposta()]), modelos: M, rodarTeste: falha });
  assert.equal(r1.ok, true);
  const r2 = await gerar({ pedido: 'Criar lib/agenda.js com proximoDia(data)', raiz: repo(), router: roteiro([proposta()]), modelos: M, rodarTeste: falha });
  assert.equal(r2.ok, true);
});

test('GP3. portão 8: revisor diz que o teste não cobre o pedido → recusado com o que falta; teste apagado', async () => {
  const raiz = repo({ 'lib/agenda.js': 'module.exports = {};\n' });
  const rt = roteiro([proposta(), proposta()]);
  const revisar = async () => ({ cobre: false, falta: 'não testa sábado nem domingo' });
  const r = await gerar({ pedido: 'A agenda deve pular sábado e domingo', raiz, router: rt, modelos: M, rodarTeste: falha, revisar });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /não cobre o pedido: não testa sábado nem domingo/);
  assert.match(rt.vistos[1], /RECUSADA: o teste não cobre o pedido/);
  assert.equal(fs.existsSync(path.join(raiz, 'tests/unit/contrato-agenda.test.js')), false);
});

test('GP4. portão 8: revisor sem resposta (null) não trava o fluxo; revisor que aprova também passa', async () => {
  const raiz = () => repo({ 'lib/agenda.js': 'module.exports = {};\n' });
  assert.equal((await gerar({ pedido: 'agenda', raiz: raiz(), router: roteiro([proposta()]), modelos: M, rodarTeste: falha, revisar: async () => null })).ok, true);
  assert.equal((await gerar({ pedido: 'agenda', raiz: raiz(), router: roteiro([proposta()]), modelos: M, rodarTeste: falha, revisar: async () => ({ cobre: true }) })).ok, true);
});

test('GP5. revisarCobertura: lê o JSON da IA; sem IA respondendo devolve null', async () => {
  const ok = await revisarCobertura({ chat: async () => ({ text: '{"cobre": false, "falta": "fim de semana"}' }) }, M, 'pedido', 'codigo');
  assert.deepEqual(ok, { cobre: false, falta: 'fim de semana' });
  const nada = await revisarCobertura({ chat: async () => { throw new Error('429'); } }, M, 'pedido', 'codigo');
  assert.equal(nada, null);
  const lixo = await revisarCobertura({ chat: async () => ({ text: 'não sei' }) }, M, 'pedido', 'codigo');
  assert.equal(lixo, null);
});

// B6 (12/11, achado do PC 2): 6 rodadas sem PR porque o gerador recusava tudo que mexe em arquivo existente.
const { conferir, SISTEMA } = require('../../nexia-ai/contrato/gerador');
const LER = "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst src = fs.readFileSync(path.join(__dirname, '../../src/pages/legais/termos/page.tsx'), 'utf8');\ntest('termos', () => {\n  assert.match(src, /contato@kernex\.com\.br/);\n  assert.doesNotMatch(src, /nexiaos/);\n  assert.ok(src.length > 100);\n});\n";
const prop = (o = {}) => ({ testavel: true, arquivos: ['src/pages/legais/termos/page.tsx'], teste: 'tests/unit/contrato-termos.test.js', codigo: LER, ...o });

test('GP6. arquivo existente .tsx/.html/.json pode ser a solução e o teste pode LER o arquivo da solução', () => {
  const c = conferir(prop());
  assert.equal(c.ok, true, c.erros.join('; '));
  for (const a of ['public/conheca/index.html', 'apps/body-coach/android/twa-manifest.json', 'src/x.ts', 'docs/x.md']) assert.equal(conferir(prop({ arquivos: [a], codigo: LER.replace('src/pages/legais/termos/page.tsx', a) })).ok, true, a);
  for (const a of ['package.json', 'wrangler.toml', '.github/workflows/ci.yml', '.env', 'tests/unit/a.js']) assert.equal(conferir(prop({ arquivos: [a] })).ok, false, a);
});

test('GP7. teste que não importa nem lê nenhum arquivo da solução é recusado', () => {
  assert.match(conferir(prop({ codigo: LER.replace('src/pages/legais/termos/page.tsx', 'src/outro.tsx') })).erros.join(), /nenhum arquivo da solução/);
});

test('GP8. gravar em disco só em pasta temporária; caminho absoluto e processo continuam proibidos', () => {
  const grava = LER.replace("test('termos'", "fs.writeFileSync('x.txt', 'a');\ntest('termos'");
  assert.match(conferir(prop({ codigo: grava })).erros.join(), /pasta temporária/);
  const tmp = grava.replace("fs.writeFileSync('x.txt'", "const os = require('node:os');\nconst d = fs.mkdtempSync(path.join(os.tmpdir(), 'k-'));\nfs.writeFileSync(path.join(d, 'x.txt')");
  assert.equal(conferir(prop({ codigo: tmp })).ok, true, conferir(prop({ codigo: tmp })).erros.join('; '));
  assert.match(conferir(prop({ codigo: LER.replace("path.join(__dirname, '../../src/pages/legais/termos/page.tsx')", "'C:\\NEXIA\\src\\pages\\legais\\termos\\page.tsx'") })).erros.join(), /caminho absoluto/);
  assert.match(conferir(prop({ codigo: LER + "\nrequire('node:child_process');" })).erros.join(), /importa o que não pode: node:child_process/);
});

test('GP9. instrução da IA: mudar arquivo existente É testável (função exportada ou handler com pedido falso)', () => {
  assert.match(SISTEMA, /arquivo existente/);
  assert.match(SISTEMA, /handler/);
  assert.match(SISTEMA, /readFileSync/);
});

test('GP10. executor: arquivo existente grande não pode ser trocado por um arquivo inteiro com menos da metade (IA truncou)', () => {
  const { aplicar } = require('../../nexia-ai/contrato/executor');
  const raiz = repo({ 'src/pagina.tsx': 'linha de código\n'.repeat(300) });
  const c = { arquivos: ['src/pagina.tsx'] };
  const curto = aplicar('ARQUIVO: src/pagina.tsx\n```tsx\nexport default 1;\n```\n', c, raiz);
  assert.deepEqual(curto.aplicados, []);
  assert.match(curto.recusas.join(), /menos da metade/);
  assert.equal(fs.readFileSync(path.join(raiz, 'src/pagina.tsx'), 'utf8').length, 'linha de código\n'.length * 300);
  const novo = aplicar('ARQUIVO: src/novo.tsx\n```tsx\nexport default 1;\n```\n', { arquivos: ['src/novo.tsx'] }, raiz);
  assert.deepEqual(novo.aplicados, ['src/novo.tsx']);
});
