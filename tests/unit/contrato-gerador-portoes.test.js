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
