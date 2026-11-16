'use strict';
// Melhoria 16 do Cortex: revisor item a item depois que o teste passa. O teste continua mandando.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar, lerContrato } = require('../../nexia-ai/contrato/executor');

const F = '```';
const ARQ = v => `ARQUIVO: src/a.js\n${F}js\nmodule.exports = ${v};\n${F}`;
function cenario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'rev-'));
  fs.mkdirSync(path.join(raiz, 'tests')); fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), 'module.exports = 0;\n');
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const c = () => lerContrato('Faça a função\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`');
const ler = raiz => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8');
const falhou = { ok: false, saida: 'erro', completo: '✖ x (1ms)\nℹ pass 0\nℹ fail 1' };
// teste "passa" quando o valor é 1 ou 2; 9 quebra
const rodarTeste = raiz => async () => /= (1|2);/.test(ler(raiz)) ? { ok: true, saida: 'ok' } : falhou;
const MODELOS = [{ provider: 'a', model: 'autor' }, { provider: 'b', model: 'outro' }];

function router(respostasAutor, respostaRevisor) {
  const chamadas = [];
  return { chamadas, chat: async (m, p) => {
    chamadas.push({ modelo: m.model, system: p.system, conteudo: p.messages[0].content });
    if (/REVISOR/.test(p.system)) { if (respostaRevisor instanceof Error) throw respostaRevisor; return { text: respostaRevisor, stop_reason: 'stop' }; }
    return { text: respostasAutor.shift(), stop_reason: 'stop' };
  } };
}

test('revisor acha item faltando: o autor corrige numa rodada e a versão nova é entregue', async () => {
  const raiz = cenario();
  const r0 = router([ARQ(1), ARQ(2)], '{"faltando": ["tratar entrada nula"]}');
  const r = await executar({ contrato: c(), raiz, router: r0, modelos: MODELOS, memoria: false, porModelo: 2, revisor: true, rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.revisado, true);
  assert.match(ler(raiz), /= 2;/);
  const rev = r0.chamadas.find(x => /REVISOR/.test(x.system));
  assert.strictEqual(rev.modelo, 'outro', 'o revisor é OUTRA IA (outro provedor)');
  assert.match(rev.conteudo, /PEDIDO:[\s\S]*Faça a função[\s\S]*module.exports = 1/);
  const segunda = r0.chamadas.filter(x => !/REVISOR/.test(x.system))[1];
  assert.match(segunda.conteudo, /REVISOR[\s\S]*tratar entrada nula/);
});

test('a correção da revisão quebra o teste: fica a versão que já tinha passado', async () => {
  const raiz = cenario();
  const r = await executar({ contrato: c(), raiz, router: router([ARQ(1), ARQ(9)], '{"faltando": ["x"]}'), modelos: MODELOS, memoria: false, porModelo: 2, revisor: true, rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.match(ler(raiz), /= 1;/);
});

test('revisor diz que nada falta, erra ou responde lixo: entrega direto, sem rodada extra', async () => {
  for (const resp of ['{"faltando": []}', new Error('429'), 'não sei']) {
    const raiz = cenario();
    const r0 = router([ARQ(1)], resp);
    const r = await executar({ contrato: c(), raiz, router: r0, modelos: MODELOS, memoria: false, porModelo: 2, revisor: true, rodarTeste: rodarTeste(raiz) });
    assert.strictEqual(r.ok, true, String(resp));
    assert.match(ler(raiz), /= 1;/);
    assert.strictEqual(r0.chamadas.filter(x => !/REVISOR/.test(x.system)).length, 1);
  }
});

test('sem revisor (padrão do executor): não chama revisão', async () => {
  const raiz = cenario();
  const r0 = router([ARQ(1)], '{"faltando": ["x"]}');
  const r = await executar({ contrato: c(), raiz, router: r0, modelos: MODELOS, memoria: false, porModelo: 2, rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r0.chamadas.some(x => /REVISOR/.test(x.system)), false);
});

test('a revisão não responde nada aplicável e acabam as tentativas: entrega a versão aprovada', async () => {
  const raiz = cenario();
  const r = await executar({ contrato: c(), raiz, router: router([ARQ(1), 'texto sem bloco', 'nada'], '{"faltando": ["x"]}'), modelos: MODELOS, memoria: false, porModelo: 1, revisor: true, rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.match(ler(raiz), /= 1;/);
});

// Melhoria 17: diagnóstico de teste suspeito (3+ IAs diferentes param no mesmo teste).
const { testeSuspeito } = require('../../nexia-ai/contrato/executor');
test('testeSuspeito: aponta o teste em que 3 IAs diferentes pararam na última tentativa', () => {
  const h = [
    { modelo: 'a/1', aplicados: ['x'], falham: ['lista', 'valida'] }, { modelo: 'a/1', aplicados: ['x'], falham: ['lista'] },
    { modelo: 'b/2', aplicados: ['x'], falham: ['lista'] }, { modelo: 'c/3', erro: '429' }, { modelo: 'd/4', aplicados: ['x'], falham: ['lista'] },
  ];
  assert.deepStrictEqual(testeSuspeito(h), { nome: 'lista', ias: 3 });
  assert.strictEqual(testeSuspeito(h.slice(0, 3)), null, 'só 2 IAs: não é suspeito ainda');
  assert.strictEqual(testeSuspeito([{ modelo: 'a', aplicados: [], falham: [] }]), null);
});

test('executar: falha com 3 IAs presas no mesmo teste devolve testeSuspeito', async () => {
  const raiz = cenario();
  const r = await executar({ contrato: c(), raiz, memoria: false, porModelo: 1,
    modelos: [{ provider: 'a', model: '1' }, { provider: 'b', model: '2' }, { provider: 'c', model: '3' }],
    router: { chat: async () => ({ text: ARQ(9), stop_reason: 'stop' }) },
    rodarTeste: async () => ({ ok: false, saida: 'x', completo: '✖ impossivel (1ms)\nℹ pass 0\nℹ fail 1' }) });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.testeSuspeito, { nome: 'impossivel', ias: 3 });
});

// Melhoria 14b: regressão só reprova teste que PASSAVA antes (teste de tarefa futura que passa a carregar não conta).
test('regressão: teste futuro que passa a rodar e falhar NÃO reprova; teste que passava e quebrou reprova', async () => {
  const saida = (passam, falham, carga) => ({ ok: !falham.length && !carga, saida: 'x', completo: [...passam.map(n => `✔ ${n} (1ms)`), ...falham.map(n => `✖ ${n} (1ms)`), ...(carga ? [`✖ ${carga} (1ms)`] : [])].join('\n') + `\nℹ pass ${passam.length}\nℹ fail ${falham.length + (carga ? 1 : 0)}` });
  for (const [quebraVelho, esperado] of [[false, true], [true, false]]) {
    const raiz = cenario();
    let chamadas = 0;
    const r = await executar({ contrato: c(), raiz, memoria: false, porModelo: 1, modelos: [{ provider: 'a', model: '1' }],
      router: { chat: async () => ({ text: ARQ(1), stop_reason: 'stop' }) },
      rodarTeste: rodarTeste(raiz),
      regressao: async () => (chamadas++ === 0 ? saida(['velho'], [], 'tests/futuro.test.js') : saida(quebraVelho ? [] : ['velho'], quebraVelho ? ['velho', 'futuro 1'] : ['futuro 1', 'futuro 2'])) });
    assert.strictEqual(r.ok, esperado, quebraVelho ? 'quebrou o que passava' : 'só testes futuros falhando');
  }
});

// Melhoria 18: IA recusa por tamanho (413) → repete uma vez com o pedido enxuto (sem exemplos e sem referências).
test('413 por tamanho: repete enxuto na mesma IA, sem gastar tentativa', async () => {
  const raiz = cenario();
  fs.writeFileSync(path.join(raiz, 'src/ref.js'), '// REFERENCIA-GRANDE\n');
  const pedidos = [];
  const contrato = lerContrato('Faça usando `src/ref.js`\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`');
  const r = await executar({ contrato, raiz, memoria: false, porModelo: 1, modelos: [{ provider: 'groq', model: 'q' }],
    router: { chat: async (m, p) => { pedidos.push(p.messages[0].content); if (pedidos.length === 1) { const e = new Error('groq 413 — Request too large for model'); throw e; } return { text: ARQ(1), stop_reason: 'stop' }; } },
    rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.tentativas, 1);
  assert.match(pedidos[0], /REFERENCIA-GRANDE/);
  assert.doesNotMatch(pedidos[1], /REFERENCIA-GRANDE/);
});

// Melhoria 19: SEARCH vazio = arquivo inteiro (visto na #82 do ZeloMe).
test('SEARCH vazio com arquivo inteiro no REPLACE cria o arquivo (antes era descartado em silêncio)', async () => {
  const raiz = cenario();
  const resposta = 'ARQUIVO: src/a.js\n<<<<<<< SEARCH\n\n=======\nmodule.exports = 1;\n>>>>>>> REPLACE\n';
  const r = await executar({ contrato: c(), raiz, memoria: false, porModelo: 1, modelos: [{ provider: 'a', model: '1' }],
    router: { chat: async () => ({ text: resposta, stop_reason: 'stop' }) }, rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.match(ler(raiz), /module.exports = 1;/);
  const { parseEditBlocks } = require('../../nexia-ai/orchestrator/edit-blocks');
  const b = parseEditBlocks('ARQUIVO: web/x.html\n<<<<<<< SEARCH\n=======\n<p>oi</p>\n>>>>>>> REPLACE\nARQUIVO: web/y.js\n<<<<<<< SEARCH\nvelho\n=======\nnovo\n>>>>>>> REPLACE');
  assert.deepStrictEqual(b.files, [{ path: 'web/x.html', content: '<p>oi</p>\n' }]);
  assert.deepStrictEqual(b.edits.map(e => e.path), ['web/y.js']);
});
