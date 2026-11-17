'use strict';
// Kernex Finance: botão comum "preencher por print ou arquivo". Foto e PDF viram imagens (MB.pdf.paraImagens),
// o servidor lê cada uma com a IA grátis e a tela abre o formulário JÁ preenchido para a pessoa conferir antes de salvar.
(function () {
  const MB = window.MB = window.MB || {};
  const carregar = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = falha; document.body.appendChild(s); });

  /**
   * Põe no topo de `el` um cartão com o botão. `opcoes`: { id, rotulo, ajuda, acao, aoLer(lido) }.
   * `aoLer` roda uma vez para cada imagem lida com sucesso (normalmente abre o formulário de conferência).
   */
  function botao(el, opcoes) {
    const id = opcoes.id;
    el.insertAdjacentHTML('afterbegin', `<div class="card"><button class="btn" id="${id}" type="button">${opcoes.rotulo || '📷 Preencher por print ou arquivo'}</button>
      <input type="file" id="${id}-arq" accept="image/*,application/pdf,.pdf" multiple hidden>
      <p class="fraco">${opcoes.ajuda || 'Mande um print, foto ou PDF. Eu não peço senha.'}</p><div id="${id}-res"></div></div>`);
    const bt = el.querySelector('#' + id); const arq = el.querySelector(`#${id}-arq`); const res = el.querySelector(`#${id}-res`);
    if (!bt || !arq) return; // botão que não foi desenhado não ganha onclick
    bt.onclick = () => arq.click();
    arq.onchange = async (ev) => {
      const arqs = [...((ev && ev.target && ev.target.files) || arq.files || [])];
      if (!arqs.length) return;
      if (arqs.length > 5) { res.innerHTML = '<div class="aviso-c">Envie no máximo 5 arquivos por vez.</div>'; return; }
      res.innerHTML = '<div class="fraco">Lendo… pode levar um pouco.</div>';
      try {
        const pdf = await carregar('pdf', '/prumo/pdf.js');
        const { imagens } = await pdf.paraImagens(arqs, MB.ui.reduzir);
        const { lidos } = await MB.api(opcoes.acao, { imagens });
        res.innerHTML = '';
        const falhas = lidos.filter((l) => !l.ok).length;
        if (falhas) MB.ui.ok(`${falhas} arquivo(s) não deu para ler. Tente de novo com uma imagem mais nítida ou digite os valores.`);
        lidos.filter((l) => l.ok).forEach((l) => opcoes.aoLer(l));
      } catch (e) { res.innerHTML = `<div class="aviso-c">${MB.ui.esc(e && e.message || 'Não consegui ler agora.')}</div>`; }
    };
  }

  MB.leitura = { botao };
})();
