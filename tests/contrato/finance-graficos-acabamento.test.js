'use strict';
// Contrato: Kernex Finance — ACABAMENTO dos gráficos do Início (visto na prévia depois da #3917):
//  - linha do patrimônio: o SVG fica ENORME (viewBox estreito esticado em 100% da largura) e a linha sai pela borda de
//    cima (y = 0 no maior valor, sem margem);
//  - barras de ganhos/perdas: barras em pé com os nomes embaixo se atropelando ("BOVA11MXRF11") e sem o valor em R$.
// Pedido, em prumo/graficos.js (mantendo as regras do contrato finance-inicio-graficos):
//  linha(pontos): <svg viewBox="0 0 320 140" width="100%" height="140" ...>; todos os pontos com 8 <= x <= 312 e
//    8 <= y <= 132 (margem de 8); x espalhado do 1º ao último ponto (1º em x=8, último em x=312).
//  barras(itens): BARRAS DEITADAS, uma linha por ativo, 30 de altura por linha: viewBox="0 0 320 (30 * n)";
//    na linha i (0, 1, 2...): o nome em <text x="0" y="(30*i + 19)" ...> à esquerda; a barra <rect> começa em x=70 e
//    tem largura proporcional ao valor absoluto (maior = 170); o valor em R$ em outro <text> com
//    text-anchor="end" x="320" no mesmo y, escrito "+R$ 95,31" (ganho) ou "-R$ 116,21" (perda), com vírgula.
//    Nada passa de x=320.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function carregar() {
  const window = { MB: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../prumo/graficos.js'), 'utf8'), { window, console });
  return window.MB.graficos;
}
const num = (s, a) => Number(((new RegExp(' ' + a + '="([-0-9.]+)"')).exec(s) || [])[1]);

test('linha: tamanho fixo 320x140 e todos os pontos dentro da margem de 8', () => {
  const g = carregar();
  const s = g.linha([{ rotulo: 'a', valor: 39000 }, { rotulo: 'b', valor: 40500 }, { rotulo: 'c', valor: 39800 }, { rotulo: 'd', valor: 48230 }]);
  assert.match(s, /viewBox="0 0 320 140"/);
  assert.match(s, /height="140"/);
  const pts = /points="([^"]+)"/.exec(s)[1].trim().split(/\s+/).map((p) => p.split(',').map(Number));
  assert.equal(pts.length, 4);
  for (const [x, y] of pts) { assert.ok(x >= 8 && x <= 312, `x ${x} dentro`); assert.ok(y >= 8 && y <= 132, `y ${y} dentro (sem sair pela borda)`); }
  assert.equal(pts[0][0], 8); assert.equal(pts[3][0], 312);
  assert.equal(Math.min(...pts.map((p) => p[1])), 8, 'o maior valor encosta na margem de cima, não na borda');
});

test('barras: deitadas, uma linha por ativo, nome à esquerda e valor em R$ à direita', () => {
  const g = carregar();
  const s = g.barras([{ rotulo: 'VALE3', valor: -116.21 }, { rotulo: 'PETR4', valor: 95.31 }, { rotulo: 'BOVA11', valor: 31.01 }, { rotulo: 'MXRF11', valor: -25.81 }]);
  assert.match(s, /viewBox="0 0 320 120"/, '30 de altura por linha (4 ativos = 120)');
  const textos = [...s.matchAll(/<text\b[^>]*>[^<]*<\/text>/g)].map((m) => m[0]);
  const nomes = textos.filter((t) => !/R\$/.test(t)); const valores = textos.filter((t) => /R\$/.test(t));
  assert.equal(nomes.length, 4); assert.equal(valores.length, 4);
  nomes.forEach((t, i) => { assert.equal(num(t, 'x'), 0, 'nome encostado à esquerda'); assert.equal(num(t, 'y'), 30 * i + 19, `nome da linha ${i}`); });
  valores.forEach((t, i) => { assert.equal(num(t, 'x'), 320); assert.match(t, /text-anchor="end"/); assert.equal(num(t, 'y'), 30 * i + 19); });
  assert.match(valores[0], />-R\$ 116,21</); assert.match(valores[1], />\+R\$ 95,31</);
  const rects = [...s.matchAll(/<rect\b[^>]*data-sinal[^>]*>/g)].map((m) => m[0]);
  assert.equal(rects.length, 4);
  for (const r of rects) { assert.equal(num(r, 'x'), 70, 'barra começa em x=70'); assert.ok(num(r, 'x') + num(r, 'width') <= 320); }
  assert.equal(num(rects[0], 'width'), 170, 'o maior valor absoluto tem 170 de largura');
  assert.ok(num(rects[1], 'width') < 170 && num(rects[1], 'width') > num(rects[2], 'width'));
});
