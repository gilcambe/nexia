'use strict';
// Contrato: Kernex Finance — o modo privacidade (prumo/privacidade.js, botão do olho) APAGA os valores dos gráficos.
// Ele embrulha todo "R$ 123,45" num <span class="valor">; dentro de um <svg> o <span> não é desenhado: no gráfico de
// ganhos e perdas do Início só aparece o sinal ("-" / "+") e some o valor (visto na prévia).
// Pedido, em prumo/privacidade.js, na função envolver(no): se o pai do texto estiver dentro de um SVG
// (pai.namespaceURI === 'http://www.w3.org/2000/svg' ou pai.closest('svg')), NÃO crie <span> nem troque o nó: só
// ponha a classe no próprio elemento: pai.classList.add('valor') (o CSS "body.privado .valor { filter: blur }"
// também vale para <text> de SVG). Fora do SVG, continua como hoje.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigo = fs.readFileSync(path.join(__dirname, '../../prumo/privacidade.js'), 'utf8');
const SVG = 'http://www.w3.org/2000/svg';

function pai(nome, ns, dentroDeSvg) {
  const classes = new Set(); const trocas = [];
  return { nodeName: nome, namespaceURI: ns, classes, trocas,
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), toggle() {} },
    closest: (s) => (s === 'svg' && dentroDeSvg ? {} : null),
    replaceChild: (novo, velho) => trocas.push([novo, velho]) };
}
function rodar(nos) {
  const document = {
    getElementById: () => null, body: { classList: { toggle() {} } },
    createTreeWalker: () => { let i = -1; return { nextNode: () => (++i < nos.length), get currentNode() { return nos[i]; } }; },
    createDocumentFragment: () => ({ filhos: [], appendChild(x) { this.filhos.push(x); } }),
    createElement: (n) => ({ nodeName: n, className: '', textContent: '' }),
    createElementNS: (ns, n) => ({ nodeName: n, namespaceURI: ns, className: '', textContent: '', setAttribute() {} }),
    createTextNode: (t) => ({ nodeValue: t }),
  };
  const window = {};
  vm.runInNewContext(codigo, { window, document, NodeFilter: { SHOW_TEXT: 4 }, MutationObserver: function () { this.observe = () => {}; }, localStorage: { getItem: () => null, setItem() {} }, setTimeout, console });
  window.KF_privacidade.varrer({});
}

test('texto com R$ dentro de um <text> de SVG: marca o próprio <text>, sem <span>', () => {
  const p = pai('text', SVG, true);
  const no = { nodeValue: '-R$ 116,21', parentNode: p };
  rodar([no]);
  assert.equal(p.trocas.length, 0, 'não troca o nó por <span> dentro do SVG (o <span> some no desenho)');
  assert.ok(p.classes.has('valor'), 'o <text> ganha a classe "valor" (o olho continua escondendo)');
});

test('fora do SVG continua embrulhando em <span class="valor">', () => {
  const p = pai('DIV', 'http://www.w3.org/1999/xhtml', false);
  rodar([{ nodeValue: 'Saldo R$ 3.250,40 hoje', parentNode: p }]);
  assert.equal(p.trocas.length, 1);
  const frag = p.trocas[0][0];
  assert.ok(frag.filhos.some((f) => f.className === 'valor' && f.textContent === 'R$ 3.250,40'));
});
