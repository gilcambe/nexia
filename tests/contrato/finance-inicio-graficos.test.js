'use strict';
// Contrato: Kernex Finance — GRÁFICOS de ganho e perda na tela Início (dono 17/11: "pense em colocar gráficos de ganhos
// ou perda na página inicial... seja criativo").
// Pedido:
// 1) Novo arquivo prumo/graficos.js (sem biblioteca; SVG feito à mão), no padrão das outras telas:
//      (function () { const MB = window.MB = window.MB || {}; MB.graficos = { linha, barras, ganhoDoDia }; })();
//    - linha(pontos, op?)  pontos = [{ rotulo, valor }]. Menos de 2 pontos -> '' (vazio). Senão devolve um <svg> com
//      viewBox, role="img", aria-label (ex.: "Patrimônio de R$ 1.000,00 para R$ 1.200,00"), uma <polyline> com UM
//      ponto por valor, e a cor pelo resultado: class="sobe" (stroke="var(--ganho)") se o último >= o primeiro,
//      class="desce" (stroke="var(--perda)") se caiu.
//    - barras(itens)  itens = [{ rotulo, valor }] (valor em R$, pode ser negativo). Lista vazia -> ''. Senão um <svg>
//      role="img" com UM <rect> por item; ganho com data-sinal="ganho" fill="var(--ganho)", perda com
//      data-sinal="perda" fill="var(--perda)"; o rótulo de cada barra aparece em <text>, ESCAPADO (<, >, &, ").
//    - ganhoDoDia(item)  item da carteira ao vivo { vivo: { valor, variacao_dia_pct } }: quanto ganhou/perdeu HOJE em R$
//      = valor - valor / (1 + variacao/100), com 2 casas. Sem vivo, sem valor ou sem variação -> null.
// 2) prumo/index.html: no :root, as cores --ganho (verde, ex. #22c55e) e --perda (vermelho, ex. #ef4444).
// 3) prumo/inicio.js: carrega /prumo/graficos.js (como já carrega ui.js) e, SEM travar o resto da tela (se falhar, só
//    não mostra o card), busca MB.api('historico_listar') e MB.api('cotacoes_vivas') e desenha:
//    - card "Seu patrimônio" (id="kf-graf-patrimonio") com MB.graficos.linha dos meses (rotulo: mes, valor: total);
//    - card "Ganhos e perdas de hoje" (id="kf-graf-hoje") com MB.graficos.barras dos ativos (rotulo: ticker ou nome,
//      valor: ganhoDoDia), no máximo 8 (os maiores em valor absoluto), e o total do dia em verde (ganho) ou vermelho (perda).
// 4) prumo/sw.js: '/prumo/graficos.js' na lista CASCA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, 'prumo', f), 'utf8');
function carregar() {
  const window = { MB: {} };
  vm.runInNewContext(ler('graficos.js'), { window, console });
  assert.ok(window.MB.graficos, 'graficos.js define window.MB.graficos');
  return window.MB.graficos;
}

test('linha: vazio com menos de 2 pontos; SVG com 1 ponto por valor; cor pela direção', () => {
  const g = carregar();
  assert.equal(g.linha([]), '');
  assert.equal(g.linha([{ rotulo: '2026-10', valor: 100 }]), '');
  const sobe = g.linha([{ rotulo: '2026-09', valor: 1000 }, { rotulo: '2026-10', valor: 900 }, { rotulo: '2026-11', valor: 1200 }]);
  assert.match(sobe, /^<svg[\s\S]*<\/svg>$/);
  assert.match(sobe, /viewBox="/);
  assert.match(sobe, /role="img"/);
  assert.match(sobe, /aria-label="[^"]+"/);
  const pts = (/<polyline[^>]*points="([^"]+)"/.exec(sobe) || [])[1];
  assert.ok(pts, '<polyline points="...">');
  assert.equal(pts.trim().split(/\s+/).length, 3, 'um ponto por valor');
  for (const p of pts.trim().split(/\s+/)) assert.match(p, /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, `ponto "x,y" numérico: ${p}`);
  assert.match(sobe, /class="sobe"/);
  assert.match(sobe, /var\(--ganho\)/);
  const desce = g.linha([{ rotulo: 'a', valor: 1000 }, { rotulo: 'b', valor: 800 }]);
  assert.match(desce, /class="desce"/);
  assert.match(desce, /var\(--perda\)/);
  assert.doesNotMatch(g.linha([{ rotulo: 'a', valor: 5 }, { rotulo: 'b', valor: 5 }]), /NaN|Infinity/, 'valores iguais não quebram a escala');
});

test('barras: um <rect> por item, ganho verde e perda vermelha, rótulo escapado', () => {
  const g = carregar();
  assert.equal(g.barras([]), '');
  const s = g.barras([{ rotulo: 'PETR4', valor: 12.5 }, { rotulo: 'MXRF11', valor: -3.2 }, { rotulo: '<b>&"x', valor: 1 }]);
  assert.match(s, /^<svg[\s\S]*<\/svg>$/);
  assert.match(s, /role="img"/);
  const rects = [...s.matchAll(/<rect\b[^>]*>/g)].map((m) => m[0]).filter((r) => /data-sinal=/.test(r));
  assert.equal(rects.length, 3, 'um <rect data-sinal> por item');
  assert.match(rects[0], /data-sinal="ganho"/); assert.match(rects[0], /var\(--ganho\)/);
  assert.match(rects[1], /data-sinal="perda"/); assert.match(rects[1], /var\(--perda\)/);
  assert.match(s, /<text[^>]*>[^<]*PETR4/);
  assert.doesNotMatch(s, /<b>/, 'rótulo escapado');
  assert.match(s, /&lt;b&gt;&amp;&quot;x/);
  assert.doesNotMatch(s, /NaN|Infinity|undefined/);
});

test('ganhoDoDia: R$ ganhos/perdidos hoje a partir do valor e da variação do dia', () => {
  const g = carregar();
  assert.equal(g.ganhoDoDia({ vivo: { valor: 1100, variacao_dia_pct: 10 } }), 100);
  assert.equal(g.ganhoDoDia({ vivo: { valor: 950, variacao_dia_pct: -5 } }), -50);
  assert.equal(g.ganhoDoDia({ vivo: { valor: 840, variacao_dia_pct: -1.2 } }), -10.2);
  assert.equal(g.ganhoDoDia({ vivo: null }), null);
  assert.equal(g.ganhoDoDia({}), null);
  assert.equal(g.ganhoDoDia({ vivo: { valor: 100 } }), null);
});
