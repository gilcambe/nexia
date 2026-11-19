'use strict';
// Contrato: Kernex Finance — robôs de investimento, parte 2b de 3: a TELA "Robôs".
// A API (parte 2a) tem: robos_salvar, robos_listar ({ robos, disparos }), robos_apagar ({ id }), robos_checar ({ disparos, lacunas }).
// Pedido:
// 1) Novo arquivo prumo/robos.js, no padrão das outras telas (carrega /prumo/ui.js como alertas.js):
//      MB.robos = { TIPOS, descrever };  MB.telas.robos = async (el) => { ... }
//    - TIPOS: { preco_abaixo: 'Preço caiu abaixo de', preco_acima: 'Preço subiu acima de', queda_dia: 'Caiu no dia mais de',
//               dy_minimo: 'Dividendos (12 meses) acima de', rebalancear: 'Carteira fora da meta em mais de',
//               concentracao: 'Um tipo passou de' }
//    - descrever(robo) -> frase simples em português, com R$ e % no padrão brasileiro (vírgula):
//        preco_abaixo  { ticker:'PETR4', valor:35 }    -> "Avisar quando PETR4 ficar abaixo de R$ 35,00"
//        preco_acima   { ticker:'PETR4', valor:50.5 }  -> "Avisar quando PETR4 ficar acima de R$ 50,50"
//        queda_dia     { ticker:'VALE3', pct:3 }       -> "Avisar quando VALE3 cair mais de 3% no dia"
//        dy_minimo     { ticker:'MXRF11', pct:12.5 }   -> "Avisar quando MXRF11 pagar mais de 12,5% em 12 meses"
//        rebalancear   { desvio_pct:5 }                -> "Avisar quando a carteira sair da meta em mais de 5%"
//        concentracao  { pct:40 }                      -> "Avisar quando um tipo de investimento passar de 40% da carteira"
//      tipo desconhecido -> "Robô sem tipo" (nunca lança erro). Texto puro (quem desenha usa esc()).
//    - a tela mostra: um card explicando ("O robô confere seus investimentos com a cotação ao vivo e avisa. Quem
//      compra ou vende é você."); a lista dos robôs (descrever + botão Apagar com data-apagar="ID" que chama
//      robos_apagar); um formulário <form id="rb-form"> com <select id="rb-tipo"> (as 6 opções de TIPOS), ticker
//      <input id="rb-ticker">, número <input id="rb-num" type="number" inputmode="decimal"> e botão Salvar que chama
//      robos_salvar mandando o número no campo certo (valor para preço; desvio_pct para rebalancear; pct para os outros);
//      o ticker some (hidden) para rebalancear e concentracao; um botão id="rb-checar" "Conferir agora" que chama
//      robos_checar e mostra os disparos e as lacunas; e o histórico "Últimos avisos" (disparos de robos_listar).
// 2) Menu: aba data-aba="robos" com o texto "Robôs", no grupo Patrimônio (antes de Economia), com ícone <svg> de linha
//    (formas fechadas com "/>"); 'robos' em ABAS de prumo/app.js; '/prumo/robos.js' em CASCA de prumo/sw.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, 'prumo', f), 'utf8');
function carregar() {
  const window = { MB: { telas: {} } };
  vm.runInNewContext(ler('robos.js'), { window, document: {}, console, localStorage: undefined });
  assert.ok(window.MB.robos, 'robos.js define window.MB.robos = { TIPOS, descrever }');
  assert.equal(typeof window.MB.telas.robos, 'function', 'robos.js define MB.telas.robos');
  return window.MB.robos;
}

test('TIPOS: os 6 robôs com nome em português', () => {
  const { TIPOS } = carregar();
  assert.deepEqual(Object.keys(TIPOS).sort(), ['concentracao', 'dy_minimo', 'preco_abaixo', 'preco_acima', 'queda_dia', 'rebalancear']);
  for (const v of Object.values(TIPOS)) assert.ok(typeof v === 'string' && v.length > 3);
});

test('descrever: frase simples com R$ e % no padrão brasileiro', () => {
  const { descrever } = carregar();
  assert.equal(descrever({ tipo: 'preco_abaixo', ticker: 'PETR4', valor: 35 }), 'Avisar quando PETR4 ficar abaixo de R$ 35,00');
  assert.equal(descrever({ tipo: 'preco_acima', ticker: 'PETR4', valor: 50.5 }), 'Avisar quando PETR4 ficar acima de R$ 50,50');
  assert.equal(descrever({ tipo: 'queda_dia', ticker: 'VALE3', pct: 3 }), 'Avisar quando VALE3 cair mais de 3% no dia');
  assert.equal(descrever({ tipo: 'dy_minimo', ticker: 'MXRF11', pct: 12.5 }), 'Avisar quando MXRF11 pagar mais de 12,5% em 12 meses');
  assert.equal(descrever({ tipo: 'rebalancear', desvio_pct: 5 }), 'Avisar quando a carteira sair da meta em mais de 5%');
  assert.equal(descrever({ tipo: 'concentracao', pct: 40 }), 'Avisar quando um tipo de investimento passar de 40% da carteira');
  assert.equal(descrever({ tipo: 'xyz' }), 'Robô sem tipo');
  assert.equal(descrever({}), 'Robô sem tipo');
});

test('tela: lista, formulário, conferir agora e histórico, usando a API certa', () => {
  const t = ler('robos.js');
  for (const a of ['robos_listar', 'robos_salvar', 'robos_apagar', 'robos_checar']) assert.match(t, new RegExp(a), `chama ${a}`);
  for (const id of ['rb-form', 'rb-tipo', 'rb-ticker', 'rb-num', 'rb-checar']) assert.match(t, new RegExp(`id="${id}"`), `tem #${id}`);
  assert.match(t, /id="rb-num"[^>]*type="number"|type="number"[^>]*id="rb-num"/);
  assert.match(t, /data-apagar=/);
  assert.match(t, /desvio_pct/, 'manda desvio_pct no rebalancear');
  assert.match(t, /Quem\s+compra\s+ou\s+vende\s+é\s+você/);
  assert.match(t, /Últimos avisos/);
  assert.match(t, /esc\(/, 'textos passam por esc()');
  assert.match(t, /\.hidden\s*=/, 'esconde o ticker quando não precisa');
});

test('menu: aba Robôs no grupo Patrimônio; app.js e sw.js sabem dela', () => {
  const html = ler('index.html');
  const b = (/<button[^>]*data-aba="robos"[^>]*>[\s\S]*?<\/button>/.exec(html) || [''])[0];
  assert.ok(b, 'botão data-aba="robos"');
  assert.match(b, /Robôs/);
  assert.match(b, /<svg[\s\S]*<\/svg>/);
  for (const t of b.matchAll(/<(path|circle|rect|line|polyline|polygon)\b[^>]*>/g)) assert.match(t[0], /\/>$/, 'forma fechada com "/>"');
  const inv = html.indexOf('data-aba="investimentos"'); const pos = html.indexOf('data-aba="robos"'); const prox = html.indexOf('data-aba="economizar"');
  assert.ok(inv < pos && pos < prox, 'Robôs fica no grupo Patrimônio (antes de Economia)');
  assert.match(ler('app.js'), /'robos'/);
  assert.match(ler('sw.js'), /'\/prumo\/robos\.js'/);
});
