// Painel de números: lê dados-exemplo.json ({ series: [{ rotulo, valor }] }) e mostra totais + gráfico de barras em SVG.
// Sem biblioteca externa. desenharBarras(series) devolve o SVG em texto (testável fora do navegador).
(function () {
  'use strict';

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  var fmt = function (n) { return Number(n).toLocaleString('pt-BR'); };

  /** Gráfico de barras em SVG. Valores negativos ou inválidos viram 0. Lista vazia = aviso. */
  function desenharBarras(series) {
    var lista = (Array.isArray(series) ? series : []).map(function (s) { return { rotulo: esc(s && s.rotulo != null ? s.rotulo : ''), valor: num(s && s.valor) }; });
    if (!lista.length) return '<p class="vazio">Sem dados para mostrar.</p>';
    var larg = 60, folga = 16, alto = 200, base = 30;
    var maior = Math.max.apply(null, lista.map(function (s) { return s.valor; })) || 1;
    var w = lista.length * (larg + folga) + folga;
    var barras = lista.map(function (s, i) {
      var h = Math.round((s.valor / maior) * (alto - 20));
      var x = folga + i * (larg + folga), y = alto - h;
      return '<g><rect class="barra" x="' + x + '" y="' + y + '" width="' + larg + '" height="' + h + '" rx="6"><title>' + s.rotulo + ': ' + fmt(s.valor) + '</title></rect>' +
        '<text x="' + (x + larg / 2) + '" y="' + (y - 6) + '" text-anchor="middle" class="valor">' + fmt(s.valor) + '</text>' +
        '<text x="' + (x + larg / 2) + '" y="' + (alto + 20) + '" text-anchor="middle" class="rotulo">' + s.rotulo + '</text></g>';
    }).join('');
    return '<svg class="grafico" viewBox="0 0 ' + w + ' ' + (alto + base) + '" role="img" aria-label="Gráfico de barras">' + barras + '</svg>';
  }

  /** Totais para os cartões: soma, maior item e média. */
  function resumo(series) {
    var lista = Array.isArray(series) ? series : [];
    var total = lista.reduce(function (a, s) { return a + num(s && s.valor); }, 0);
    var top = lista.reduce(function (m, s) { return !m || num(s && s.valor) > num(m.valor) ? s : m; }, null);
    return { total: total, maior: top ? String(top.rotulo) : '—', media: lista.length ? Math.round(total / lista.length) : 0 };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { desenharBarras: desenharBarras, resumo: resumo };
  if (typeof document === 'undefined') return;

  var alvo = document.getElementById('painel');
  function mostrar(series) {
    var r = resumo(series);
    alvo.innerHTML = '<section class="cartoes">' +
      '<div class="cartao"><span>Total</span><b>' + fmt(r.total) + '</b></div>' +
      '<div class="cartao"><span>Maior</span><b>' + esc(r.maior) + '</b></div>' +
      '<div class="cartao"><span>Média</span><b>' + fmt(r.media) + '</b></div></section>' +
      '<section class="quadro">' + desenharBarras(series) + '</section>';
  }
  fetch('dados-exemplo.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (d) { mostrar(d && d.series); })
    .catch(function () { alvo.innerHTML = '<p class="vazio">Não consegui carregar os dados agora.</p>'; });
})();
