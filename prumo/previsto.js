'use strict';
// Kernex Finance: dinheiro PREVISTO (data futura). Só conta como recebido/pago depois que cair.
// Botões "✅ Caiu" / "✅ Paguei" confirmam antes; "Ainda não caiu" adia a data. O servidor decide; aqui só desenha.
(function () {
  const MB = window.MB = window.MB || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brl = (v) => {
    const n = Number(v) || 0;
    const [i, d] = Math.abs(n).toFixed(2).split('.');
    return `${n < 0 ? '-' : ''}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
  };
  const dm = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[2]}/${m[1]}` : ''; };

  /** Uma linha de item previsto. item = { tipo:'receber'|'pagar', nome, data, valor, colecao, id }. */
  function linha(x) {
    const receber = x.tipo !== 'pagar';
    const botoes = x.colecao && x.id
      ? `<div class="linha" style="margin:4px 0 8px"><button type="button" class="btn mini" data-prv="confirmar" data-colecao="${esc(x.colecao)}" data-id="${esc(x.id)}">${receber ? '✅ Caiu' : '✅ Paguei'}</button>`
        + `<button type="button" class="btn sec mini" data-prv="adiar" data-colecao="${esc(x.colecao)}" data-id="${esc(x.id)}">${receber ? 'Ainda não caiu' : 'Ainda não paguei'}</button></div>`
      : '<div class="fraco" style="margin-bottom:6px">Estimativa pela parcela cadastrada.</div>';
    return `<div class="item"><span>${esc(x.nome)} <span class="fraco">${esc(dm(x.data))}</span></span><span class="v">${brl(x.valor)}</span></div>${botoes}`;
  }

  /** Cartão "Previsto" com a receber e a pagar (itens vêm do servidor). Vazio se não há nada previsto. */
  function cartao(itens, titulo) {
    const lista = Array.isArray(itens) ? itens : [];
    if (!lista.length) return '';
    return `<div class="card" id="prv-cartao"><b>${esc(titulo || 'Previsto')}</b><div class="fraco">Ainda não aconteceu: só conta quando cair.</div>${lista.map(linha).join('')}</div>`;
  }

  /** Liga os botões [data-prv] dentro de el. Confere se o botão existe antes de ligar. */
  function ligar(el) {
    if (!el || typeof el.querySelectorAll !== 'function') return;
    const ui = MB.ui || {};
    el.querySelectorAll('[data-prv]').forEach((b) => {
      if (!b) return;
      const corpo = () => ({ colecao: b.dataset.colecao, id: b.dataset.id });
      if (b.dataset.prv === 'confirmar') {
        b.onclick = () => MB.api('previsto_confirmar', corpo()).then(() => { if (ui.ok) ui.ok('✅ Confirmado.'); if (ui.recarregar) ui.recarregar(); });
      } else {
        b.onclick = () => ui.formulario('Para quando ficou?', [{ nome: 'data', rotulo: 'Nova data', tipo: 'date' }],
          (d) => (d && d.data ? MB.api('previsto_adiar', { ...corpo(), data: d.data }) : Promise.resolve()));
      }
    });
  }

  MB.previsto = { cartao, linha, ligar };
})();
