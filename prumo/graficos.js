(function () {
  const MB = window.MB = window.MB || {};
  function escHtml(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    const pts = ys.map((v, i) => `${i * 24},${((maxY - v) / range) * 100}`).join(' ');
    const a = Number(pontos[0].valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const b = Number(pontos[pontos.length - 1].valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `<svg viewBox="0 0 ${(pontos.length - 1) * 24 + 24} 100" role="img" aria-label="Patrimônio de ${a} para ${b}" xmlns="http://www.w3.org/2000/svg"><polyline class="${cls}" points="${pts}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function barras(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '';
    const maxAbs = Math.max(1, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
    let x = 0;
    const partes = itens.map((item) => {
      const v = Number(item.valor) || 0;
      const sinal = v >= 0 ? 'ganho' : 'perda';
      const cor = sinal === 'ganho' ? 'var(--ganho)' : 'var(--perda)';
      const h = Math.max(1, (Math.abs(v) / maxAbs) * 55);
      const rotulo = escHtml(item.rotulo || '');
      x += 40;
      return `<rect x="${x - 34}" y="${55 - h}" width="28" height="${h}" data-sinal="${sinal}" fill="${cor}"/><text x="${x - 20}" y="82" text-anchor="middle" fill="var(--texto)" font-size="11">${rotulo}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${x + 14} 100" role="img" xmlns="http://www.w3.org/2000/svg">${partes}</svg>`;
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
