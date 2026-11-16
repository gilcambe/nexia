'use strict';
// Melhoria 15 do Cortex: memória (lições + exemplos aprovados) e parada no erro repetido.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const memoria = require('../../nexia-ai/contrato/memoria');
const { executar, lerContrato } = require('../../nexia-ai/contrato/executor');

const F = '```';
function pastaTemp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'mem-')); }
function contrato(pedido, arq = 'src/a.js') { return lerContrato(`${pedido}\nArquivos: \`${arq}\`\nTeste: \`node --test tests/a.test.js\``); }

test('o caderno de lições do repositório existe e cabe no limite', () => {
  const t = memoria.licoes();
  assert.ok(t.length > 200, 'licoes.md vazio');
  assert.ok(t.length <= memoria.LICOES_MAX + 10);
  assert.match(t, /atalho/);
});

test('gravarExemplo + buscarExemplos: acha o parecido, ignora o diferente e o próprio número', () => {
  const pasta = pastaTemp();
  memoria.gravarExemplo({ numero: '10', contrato: contrato('Criar rota de chat do condomínio com moderação'), modelo: 'x/y', tentativas: 1, diff: '+ chat' }, { pasta });
  memoria.gravarExemplo({ numero: '11', contrato: contrato('Gerar relatório de vendas mensal', 'lib/vendas.js'), modelo: 'x/y', tentativas: 2, diff: '+ vendas' }, { pasta });
  const achados = memoria.buscarExemplos(contrato('Ajustar a moderação do chat do condomínio'), { pasta });
  assert.deepStrictEqual(achados.map(e => e.numero), ['10']);
  assert.deepStrictEqual(memoria.buscarExemplos(contrato('Ajustar a moderação do chat do condomínio'), { pasta, excluir: '10' }), []);
  assert.match(memoria.textoExemplos(achados), /EXEMPLO APROVADO \(tarefa #10/);
});

test('gravarExemplo não guarda diff com cara de segredo nem diff vazio', () => {
  const pasta = pastaTemp();
  const c = contrato('qualquer coisa');
  assert.strictEqual(memoria.gravarExemplo({ numero: '1', contrato: c, diff: '+ const k = "ghp_' + 'a'.repeat(30) + '"' }, { pasta }), null);
  assert.strictEqual(memoria.gravarExemplo({ numero: '2', contrato: c, diff: '  ' }, { pasta }), null);
  assert.ok(memoria.gravarExemplo({ numero: '3', contrato: c, diff: '+ ok' }, { pasta }));
});

function cenario() {
  const raiz = pastaTemp();
  fs.mkdirSync(path.join(raiz, 'tests'));
  fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), 'module.exports = 0;\n');
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const falhou = nomes => ({ ok: false, saida: 'erro', completo: nomes.map(n => `✖ ${n} (1ms)`).join('\n') + `\nℹ pass 0\nℹ fail ${nomes.length}` });

test('executor põe as lições no sistema e o exemplo parecido no pedido', async () => {
  const raiz = cenario(), pasta = pastaTemp();
  fs.writeFileSync(path.join(pasta, 'licoes.md'), 'LICAO-SECRETA-123: use os módulos prontos.');
  memoria.gravarExemplo({ numero: '7', contrato: contrato('Somar pontos do placar do jogo'), modelo: 'x/y', tentativas: 1, diff: '+ DIFF-DO-EXEMPLO' }, { pasta });
  const vistos = [];
  const r = await executar({
    contrato: contrato('Somar pontos do placar no jogo novo'), raiz, memoria: { pasta }, numero: '99', porModelo: 1,
    modelos: [{ provider: 'f', model: 'm' }],
    router: { chat: async (m, p) => { vistos.push(p); return { text: `ARQUIVO: src/a.js\n${F}js\nmodule.exports = 1;\n${F}`, stop_reason: 'stop' }; } },
    rodarTeste: async () => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8').includes('1') ? { ok: true, saida: 'ok' } : falhou(['soma']),
  });
  assert.strictEqual(r.ok, true);
  assert.match(vistos[0].system, /LIÇÕES DO CORTEX[\s\S]*LICAO-SECRETA-123/);
  assert.match(vistos[0].messages[0].content, /EXEMPLO APROVADO \(tarefa #7[\s\S]*DIFF-DO-EXEMPLO/);
});

test('memoria:false desliga lições e exemplos', async () => {
  const raiz = cenario(), vistos = [];
  await executar({
    contrato: contrato('qualquer'), raiz, memoria: false, porModelo: 1, modelos: [{ provider: 'f', model: 'm' }],
    router: { chat: async (m, p) => { vistos.push(p); return { text: `ARQUIVO: src/a.js\n${F}js\nmodule.exports = 1;\n${F}`, stop_reason: 'stop' }; } },
    rodarTeste: async () => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8').includes('1') ? { ok: true, saida: 'ok' } : falhou(['x']),
  });
  assert.doesNotMatch(vistos[0].system, /LIÇÕES DO CORTEX/);
  assert.doesNotMatch(vistos[0].messages[0].content, /EXEMPLO APROVADO/);
});

test('mesmo erro 2x seguidas na mesma IA: passa para o próximo degrau sem gastar a 3ª tentativa', async () => {
  const raiz = cenario(), chamadas = [];
  const r = await executar({
    contrato: contrato('qualquer'), raiz, memoria: false, porModelo: 3, extrasMax: 0,
    modelos: [{ provider: 'f', model: 'presa' }, { provider: 'f', model: 'boa' }],
    router: { chat: async m => { chamadas.push(m.model); return { text: `ARQUIVO: src/a.js\n${F}js\nmodule.exports = ${m.model === 'boa' ? 2 : 0} + 0;\n${F}`, stop_reason: 'stop' }; } },
    rodarTeste: async () => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8').includes('2') ? { ok: true, saida: 'ok' } : falhou(['igual']),
  });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(chamadas, ['presa', 'presa', 'boa']);
});

test('versões da mesma peça: só a mais nova serve de exemplo', () => {
  const pasta = pastaTemp();
  memoria.gravarExemplo({ numero: '20', contrato: contrato('Detector de emergência por palavras'), diff: '+ versão velha' }, { pasta });
  memoria.gravarExemplo({ numero: '31', contrato: contrato('Detector de emergência por palavras e contexto'), diff: '+ versão nova' }, { pasta });
  assert.deepStrictEqual(memoria.buscarExemplos(contrato('Ajustar o detector de emergência'), { pasta }).map(e => e.numero), ['31']);
});
