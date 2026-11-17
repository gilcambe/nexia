(function () {
  const MB = window.MB = window.MB || {};

  function escHtml(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function brl(v) {
    const sinal = v < 0 ? '-' : '+';
    const abs = Math.abs(v);
    const inteiro = Math.floor(abs).toLocaleString('pt-BR');
    const centavos = (abs % 1).toFixed(2).slice(2);
    return `${sinal}R$ ${inteiro},${centavos}`;
  }

  function linha(pontos) {
    if (!Array.isArray(pontos) || pontos.length < 2) return '';
    const ys = pontos.map((p) => Number(p.valor) || 0);
    const primeiro = ys[0];
    const ultimo = ys[ys.length - 1];
    const subindo = ultimo >= primeiro;
    const cls = subindo ? 'sobe' : 'desce';
    const cor = subindo ? 'var(--ganho)' : 'var(--perda)';
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const range = maxY - minY || 1;
    const n = pontos.length;
    const pts = ys.map((v, i) => {
      const x = i === n - 1 ? 312 : 8 + Math.round((i * 304) / (n - 1));
      const y = 8 + (maxY - v) * 124 / range;
      return `${x},${y}`;
    }).join(' ');
    const a = brl(Number(pontos[0].valor));
    const b = brl(Number(pontos[pontos.length - 1].valor));
    return `<svg viewBox="0 0 320 140" width="100%" height="140" role="img" aria-label="Patrimônio de ${a} para ${b}" xmlns="http://www.w3.org/2000/svg"><polyline class="${cls}" points="${pts}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function barras(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '';
    const n = itens.length;
    const maxAbs = Math.max(1, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
    const partes = itens.map((item, i) => {
      const v = Number(item.valor) || 0;
      const sinal = v >= 0 ? 'ganho' : 'perda';
      const cor = sinal === 'ganho' ? 'var(--ganho)' : 'var(--perda)';
      const largura = Math.min(170, (Math.abs(v) / maxAbs) * 170);
      const y = 30 * i;
      const rotulo = escHtml(item.rotulo || '');
      const valorTexto = brl(v);
      return `<text x="0" y="${y + 19}" fill="var(--texto)" font-size="12">${rotulo}</text><rect x="70" y="${y}" width="${largura}" height="24" data-sinal="${sinal}" fill="${cor}"/><text x="320" y="${y + 19}" text-anchor="end" fill="var(--texto)" font-size="12">${valorTexto}</text>`;
    }).join('');
    return `<svg viewBox="0 0 320 ${30 * n}" role="img" xmlns="http://www.w3.org/2000/svg">${partes}</svg>`;
  }

  function ganhoDoDia(item) {
    const vivo = item && item.vivo;
    if (!vivo || vivo.valor == null || vivo.variacao_dia_pct == null) return null;
    const valor = Number(vivo.valor);
    const pct = Number(vivo.variacao_dia_pct);
    if (!isFinite(valor) || !isFinite(pct) || 1 + pct / 100 === 0) return null;
    return Number((valor - valor / (1 + pct / 100)).toFixed(2));
  }

  MB.graficos = { linha, barras, ganhoDoDia };
})();
