'use strict';
// Contrato: Kernex Finance — página MERCADO (dono 17/11: "coloque uma página pra eu buscar ativos e ver qual valor em
// tempo real").
// Pedido:
// 1) API, em netlify/functions/prumo-lib/cotacoes.js, dentro de agirCotacoes (antes do "if (acao !== 'cotacoes_vivas')"):
//    - 'mercado_buscar' { q }: q com 2+ letras. Busca em
//        https://query1.finance.yahoo.com/v1/finance/search?q=<q codificado>&quotesCount=10&newsCount=0
//      (com c.deps.fetch se vier, senão fetch) e devolve [200, { ativos: [{ ticker, nome }] }] só com os símbolos da B3
//      (terminam em ".SA"; ticker SEM o ".SA"; nome = longname || shortname). q curto -> [400, { error }].
//      Se a busca falhar -> [200, { ativos: [], aviso: 'texto simples' }] (não derruba a tela).
//    - 'mercado_cotar' { tickers }: lista (array ou "PETR4,VALE3"), no máximo 12, em maiúsculas, sem repetir. Código
//      válido: /^[A-Z]{4}\d{1,2}$/. Para cada válido chama cotar(ticker, { fetch, agora, env }) (a função que já existe
//      no arquivo, com cache e fontes). Devolve
//        [200, { cotacoes: [{ ticker, preco, variacao_dia_pct, fonte, data_hora, desatualizada }], invalidos: [...],
//                em_pregao: emPregao(agora) }]
//      (preco, variacao_dia_pct, fonte, data_hora e desatualizada vêm prontos do retorno de cotar).
//      Lista vazia -> [400, { error }].
// 2) Tela nova prumo/mercado.js: MB.telas.mercado = async (el) => { ...; return parar; }
//    - campo de busca <input id="mk-busca" type="search"> que chama 'mercado_buscar' enquanto digita (espera ~400 ms);
//      tocar num resultado põe o ativo na sua lista;
//    - "Sua lista" (guardada em localStorage 'kf-mercado', sempre dentro de try/catch); se vazia, começa com
//      PETR4, VALE3, ITUB4, BBAS3, MXRF11, HGLG11, BOVA11, IVVB11;
//    - cada ativo num cartão com preço em R$, variação do dia em verde (sobe) ou vermelho (cai) e a fonte/hora; botão
//      para tirar da lista;
//    - atualiza sozinho a cada 30 s (setInterval) e devolve uma função que faz clearInterval ao sair da aba.
// 3) Menu: aba nova data-aba="mercado" ("Mercado") no grupo Patrimônio, com ícone <svg> de linha
//    (fill="none" stroke="currentColor" ou pelo CSS do menu); 'mercado' em ABAS de prumo/app.js; '/prumo/mercado.js'
//    em CASCA de prumo/sw.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cot = require('../../netlify/functions/prumo-lib/cotacoes');

const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, 'prumo', f), 'utf8');
const AGORA = new Date('2026-11-17T15:00:00Z'); // terça, 12h em Brasília: pregão aberto
const resp = (j, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => j, text: async () => JSON.stringify(j) });
function ctx(fetch) {
  return { deps: { fetch, agora: () => AGORA, env: {} }, agoraIso: AGORA.toISOString() };
}
function fetchFalso(urls) {
  return async (url) => {
    urls.push(url);
    if (url.includes('/v1/finance/search')) {
      return resp({ quotes: [
        { symbol: 'PETR4.SA', longname: 'Petróleo Brasileiro S.A. - Petrobras', shortname: 'PETROBRAS PN' },
        { symbol: 'PBR', longname: 'Petrobras ADR', shortname: 'PBR' },
        { symbol: 'PETR3.SA', shortname: 'PETROBRAS ON' },
      ] });
    }
    const m = /chart\/([A-Z0-9]+)\.SA/.exec(url);
    if (m && m[1] === 'PETR4') return resp({ chart: { result: [{ meta: { regularMarketPrice: 41.5, chartPreviousClose: 40, regularMarketTime: 1795000000 } }] } });
    if (m && m[1] === 'VALE3') return resp({ chart: { result: [{ meta: { regularMarketPrice: 60, chartPreviousClose: 62.5, regularMarketTime: 1795000000 } }] } });
    return resp({}, false);
  };
}
const limpar = () => { if (cot._cache && cot._cache.clear) cot._cache.clear(); };

test('mercado_buscar: só ativos da B3, ticker sem ".SA", com nome', async () => {
  limpar(); const urls = [];
  const r = await cot.agirCotacoes('mercado_buscar', { q: 'petro bras' }, ctx(fetchFalso(urls)));
  assert.equal(r[0], 200);
  assert.deepEqual(r[1].ativos, [{ ticker: 'PETR4', nome: 'Petróleo Brasileiro S.A. - Petrobras' }, { ticker: 'PETR3', nome: 'PETROBRAS ON' }]);
  assert.ok(urls.some((u) => u.startsWith('https://query1.finance.yahoo.com/v1/finance/search?q=petro%20bras')), 'q codificado na URL');
  assert.equal((await cot.agirCotacoes('mercado_buscar', { q: 'p' }, ctx(fetchFalso([]))))[0], 400);
  const caiu = await cot.agirCotacoes('mercado_buscar', { q: 'vale' }, ctx(async () => { throw new Error('rede'); }));
  assert.equal(caiu[0], 200);
  assert.deepEqual(caiu[1].ativos, []);
  assert.equal(typeof caiu[1].aviso, 'string');
});

test('mercado_cotar: preço e variação do dia; inválidos à parte; diz se o pregão está aberto', async () => {
  limpar(); const urls = [];
  const r = await cot.agirCotacoes('mercado_cotar', { tickers: 'petr4, VALE3,PETR4,xx1,' }, ctx(fetchFalso(urls)));
  assert.equal(r[0], 200);
  assert.equal(r[1].cotacoes.length, 2, 'PETR4 e VALE3, sem repetir');
  const p = r[1].cotacoes.find((x) => x.ticker === 'PETR4');
  assert.equal(p.preco, 41.5);
  assert.equal(p.variacao_dia_pct, 3.75);
  assert.ok(p.fonte);
  const v = r[1].cotacoes.find((x) => x.ticker === 'VALE3');
  assert.equal(v.variacao_dia_pct, -4);
  assert.deepEqual(r[1].invalidos, ['XX1']);
  assert.equal(r[1].em_pregao, true);
  const muitos = Array.from({ length: 20 }, (_, i) => `ABCD${i + 1}`);
  const rm = await cot.agirCotacoes('mercado_cotar', { tickers: muitos }, ctx(fetchFalso([])));
  assert.ok(rm[1].cotacoes.length + rm[1].invalidos.length <= 12, 'no máximo 12');
  assert.equal((await cot.agirCotacoes('mercado_cotar', { tickers: [] }, ctx(fetchFalso([]))))[0], 400);
});

test('tela Mercado: busca, lista guardada, cores, atualiza a cada 30 s e para ao sair', () => {
  const m = ler('mercado.js');
  assert.match(m, /MB\.telas\.mercado\s*=/);
  assert.match(m, /id="mk-busca"/);
  assert.match(m, /type="search"/);
  assert.match(m, /mercado_buscar/);
  assert.match(m, /mercado_cotar/);
  assert.match(m, /setTimeout/, 'espera o usuário parar de digitar');
  assert.match(m, /kf-mercado/);
  assert.match(m, /try\s*\{[\s\S]{0,120}localStorage/, 'localStorage dentro de try');
  for (const t of ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'HGLG11', 'BOVA11', 'IVVB11']) assert.match(m, new RegExp(t));
  assert.match(m, /setInterval\([^)]*30000|setInterval\([^)]*30 \* 1000/, 'atualiza a cada 30 s');
  assert.match(m, /clearInterval/);
  assert.match(m, /return\s+parar|return\s+\(\)\s*=>/, 'devolve a função que para o timer');
  assert.match(m, /var\(--ganho\)|class="verde"|verde/);
  assert.match(m, /var\(--perda\)|class="verm"|verm/);
});

test('menu: aba Mercado no grupo Patrimônio; app.js e sw.js sabem dela', () => {
  const html = ler('index.html');
  const b = (/<button[^>]*data-aba="mercado"[^>]*>[\s\S]*?<\/button>/.exec(html) || [''])[0];
  assert.ok(b, 'botão data-aba="mercado" no menu');
  assert.match(b, /Mercado/);
  assert.match(b, /<svg[\s\S]*<\/svg>/);
  for (const t of b.matchAll(/<(path|circle|rect|line|polyline|polygon)\b[^>]*>/g)) assert.match(t[0], /\/>$/, 'forma fechada com "/>"');
  const inv = html.indexOf('data-aba="investimentos"'); const pos = html.indexOf('data-aba="mercado"'); const prox = html.indexOf('data-aba="economizar"');
  assert.ok(inv < pos && pos < prox, 'Mercado fica no grupo Patrimônio (antes de Economia)');
  assert.match(ler('app.js'), /'mercado'/);
  assert.match(ler('sw.js'), /'\/prumo\/mercado\.js'/);
});
