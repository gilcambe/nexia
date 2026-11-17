'use strict';
// Contrato: Kernex Finance — VELOCIDADE: guardar por pouco tempo as leituras da API no aparelho (dono 17/11: "O APLICATIVO
// tá muito lento... navegar etc.. tudo!"). Hoje cada troca de aba refaz todas as chamadas /api/prumo (Firestore), mesmo
// que nada tenha mudado.
// Pedido:
// 1) Novo arquivo prumo/cache-api.js (sem DOM), no padrão:
//      (function () { const MB = window.MB = window.MB || {}; MB.criarCacheApi = criarCacheApi; })();
//    criarCacheApi(apiReal, opcoes?) devolve uma função api(acao, dados) com .limpar():
//    - É LEITURA a ação que termina em _listar, _resumo, _visao, _status, _previsao, _ver ou _estado, ou que é
//      'avisos', 'relatorio_mensal', 'saude_financeira' ou 'meu_plano'. Cotações (cotacoes_vivas, mercado_cotar,
//      invest_cotacao) e todo o resto NÃO são leitura.
//    - Leitura: chave = acao + JSON.stringify(dados || {}). Se tem resposta guardada há menos de opcoes.ttlMs
//      (padrão 60000) devolve a guardada SEM chamar apiReal. Duas leituras iguais ao mesmo tempo fazem UMA chamada só.
//      Resposta com erro (promessa rejeitada) não é guardada.
//    - Qualquer outra ação: chama apiReal e, ao terminar (deu certo ou não), apaga TUDO que estava guardado (ex.:
//      gasto_salvar faz o próximo gasto_listar buscar de novo).
//    - opcoes.agora (função que devolve ms; padrão Date.now) para os testes; no máximo 60 respostas guardadas
//      (a mais antiga sai).
//    - .limpar() apaga tudo.
// 2) prumo/index.html carrega <script src="/prumo/cache-api.js"></script> ANTES de /prumo/app.js.
// 3) prumo/app.js: window.MB.api passa a ser MB.criarCacheApi(api) (a api de hoje fica por baixo) e, quando o login
//    muda (onAuthStateChanged), chama .limpar() (os dados de uma conta nunca aparecem para outra).
// 4) prumo/sw.js: '/prumo/cache-api.js' na lista CASCA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
function carregar() {
  const window = { MB: {} };
  vm.runInNewContext(ler('cache-api.js'), { window, console, setTimeout, clearTimeout });
  assert.equal(typeof window.MB.criarCacheApi, 'function', 'prumo/cache-api.js define MB.criarCacheApi');
  return window.MB.criarCacheApi;
}
function falsa() {
  const chamadas = []; let n = 0;
  const api = async (acao, dados) => { chamadas.push({ acao, dados }); if (acao === 'quebra_listar') throw new Error('falhou'); return { acao, n: ++n }; };
  return { api, chamadas };
}

test('leitura repetida não chama o servidor de novo dentro do tempo', async () => {
  const criar = carregar(); const f = falsa(); let t = 1000;
  const api = criar(f.api, { agora: () => t });
  const a = await api('gasto_listar', { mes: '2026-11' });
  const b = await api('gasto_listar', { mes: '2026-11' });
  assert.equal(f.chamadas.length, 1);
  assert.deepEqual(b, a);
  await api('gasto_listar', { mes: '2026-10' });
  assert.equal(f.chamadas.length, 2, 'dados diferentes = chave diferente');
  t += 61000;
  await api('gasto_listar', { mes: '2026-11' });
  assert.equal(f.chamadas.length, 3, 'passou de 60 s: busca de novo');
});

test('duas leituras iguais ao mesmo tempo fazem uma chamada só', async () => {
  const criar = carregar(); const f = falsa();
  const api = criar(f.api);
  const [a, b] = await Promise.all([api('inicio_resumo'), api('inicio_resumo')]);
  assert.equal(f.chamadas.length, 1);
  assert.deepEqual(a, b);
});

test('gravar apaga o guardado; erro não é guardado', async () => {
  const criar = carregar(); const f = falsa();
  const api = criar(f.api);
  await api('gasto_listar'); await api('orcamento_resumo');
  await api('gasto_salvar', { valor: 10 });
  await api('gasto_listar'); await api('orcamento_resumo');
  assert.deepEqual(f.chamadas.map((c) => c.acao), ['gasto_listar', 'orcamento_resumo', 'gasto_salvar', 'gasto_listar', 'orcamento_resumo']);
  await assert.rejects(api('quebra_listar'));
  await assert.rejects(api('quebra_listar'));
  assert.equal(f.chamadas.filter((c) => c.acao === 'quebra_listar').length, 2, 'erro não fica guardado');
});

test('cotação e ações que não são leitura sempre vão ao servidor; limpar() apaga tudo', async () => {
  const criar = carregar(); const f = falsa();
  const api = criar(f.api);
  for (const a of ['cotacoes_vivas', 'mercado_cotar', 'invest_cotacao', 'ler_print', 'consultor']) { await api(a, { x: 1 }); await api(a, { x: 1 }); }
  assert.equal(f.chamadas.length, 10);
  for (const a of ['avisos', 'relatorio_mensal', 'saude_financeira', 'meu_plano', 'milhas_visao', 'openfinance_status', 'salario_previsao', 'familia_ver', 'familia_estado']) { await api(a); await api(a); }
  assert.equal(f.chamadas.length, 19, 'cada leitura vai 1 vez só');
  api.limpar();
  await api('avisos');
  assert.equal(f.chamadas.length, 20);
});

test('app usa o cache, carrega o arquivo antes e limpa ao trocar de conta', () => {
  const html = ler('index.html');
  const iC = html.indexOf('/prumo/cache-api.js'); const iA = html.indexOf('/prumo/app.js');
  assert.ok(iC > 0 && iC < iA, 'cache-api.js antes de app.js no index.html');
  const app = ler('app.js');
  assert.match(app, /criarCacheApi\(\s*api/);
  assert.match(app, /onAuthStateChanged[\s\S]{0,600}\.limpar\(\)/, 'limpa o cache quando o login muda');
  assert.match(ler('sw.js'), /'\/prumo\/cache-api\.js'/);
});
