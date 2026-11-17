'use strict';
// Contrato: Kernex Finance — tela Robôs mostra o que aconteceu (1ª entrega, #3912). Visto na prévia:
//  - "Conferir agora" mostra só "Disparos: 1. Lacunas: 1." (sem dizer QUAL robô disparou nem o porquê);
//  - "Últimos avisos" mostra o código cru do tipo ("preco_abaixo PETR4 está ...").
// Pedido, em prumo/robos.js:
//  1) duas funções PURAS em MB.robos (junto de TIPOS e descrever):
//     - resultado({ disparos, lacunas }) -> HTML: sem disparos e sem lacunas: "Nenhum robô disparou agora.";
//       cada disparo num <div class="rb-disparo">🔔 TEXTO</div> (texto do disparo, escapado); cada lacuna num
//       <div class="rb-lacuna fraco">ℹ️ TEXTO</div>; com disparos, começa com "<b>N robô(s) disparou(aram)</b>"
//       (1 -> "1 robô disparou", 2+ -> "N robôs dispararam").
//     - historico(disparos) -> HTML: cada item "<div class="rb-hist"><span class="fraco">DD/MM HH:MM</span> TEXTO</div>"
//       (data/hora de "em" no fuso de Brasília; texto do disparo, escapado; NUNCA o código do tipo); vazio ->
//       "<p class="fraco">Nenhum aviso ainda.</p>".
//  2) o botão #rb-checar escreve MB.robos.resultado(r) em #rb-checar-msg (innerHTML) e o card "Últimos avisos" usa
//     MB.robos.historico(disparos).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigo = fs.readFileSync(path.join(__dirname, '../../prumo/robos.js'), 'utf8');
function carregar() {
  const window = { MB: { telas: {} } };
  vm.runInNewContext(codigo, { window, MB: window.MB, document: {}, console });
  return window.MB.robos;
}

test('resultado(): diz quais robôs dispararam e por quê', () => {
  const { resultado } = carregar();
  assert.equal(typeof resultado, 'function', 'MB.robos.resultado');
  assert.match(resultado({ disparos: [], lacunas: [] }), /Nenhum robô disparou agora\./);
  const um = resultado({ disparos: [{ texto: 'VALE3 caiu 3,4% hoje' }], lacunas: ['Sem cotação para XPTO11'] });
  assert.match(um, /<b>1 robô disparou<\/b>/);
  assert.match(um, /class="rb-disparo"[^>]*>🔔 VALE3 caiu 3,4% hoje</);
  assert.match(um, /class="rb-lacuna fraco"[^>]*>ℹ️ Sem cotação para XPTO11</);
  assert.match(resultado({ disparos: [{ texto: 'a' }, { texto: 'b' }], lacunas: [] }), /<b>2 robôs dispararam<\/b>/);
  assert.doesNotMatch(resultado({ disparos: [{ texto: '<img src=x>' }], lacunas: [] }), /<img/, 'escapado');
});

test('historico(): data/hora de Brasília e o texto, nunca o código do tipo', () => {
  const { historico } = carregar();
  assert.equal(typeof historico, 'function', 'MB.robos.historico');
  assert.match(historico([]), /<p class="fraco">Nenhum aviso ainda\.<\/p>/);
  const h = historico([{ tipo: 'preco_abaixo', ticker: 'PETR4', texto: 'PETR4 está abaixo de R$ 35,00', em: '2026-11-17T15:05:00.000Z' }]);
  assert.match(h, /class="rb-hist"/);
  assert.match(h, /17\/11 12:05/, 'hora de Brasília (UTC-3)');
  assert.match(h, /PETR4 está abaixo de R\$ 35,00/);
  assert.doesNotMatch(h, /preco_abaixo/, 'sem o código do tipo');
});

test('a tela usa as duas funções', () => {
  assert.match(codigo, /rb-checar-msg[\s\S]{0,300}innerHTML\s*=\s*(MB\.robos\.)?resultado\(|innerHTML\s*=\s*(MB\.robos\.)?resultado\([\s\S]{0,40}/);
  assert.match(codigo, /(MB\.robos\.)?historico\(\s*disparos/);
});
