(function () {
  'use strict';
  const MB = window.MB;
  const PADRAO = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'HGLG11', 'BOVA11', 'IVVB11'];
  const CHAVE_LS = 'kf-mercado';

  function carregarUi() {
    return MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = '/prumo/ui.js';
      s.onload = () => ok(MB.ui);
      s.onerror = falha;
      document.body.appendChild(s);
    });
  }

  function lerLista() {
    try {
      const bruto = localStorage.getItem(CHAVE_LS);
      if (!bruto) return null;
      const lista = JSON.parse(bruto);
      return Array.isArray(lista) ? lista : null;
    } catch { return null; }
  }

  function gravarLista(lista) {
    try { localStorage.setItem(CHAVE_LS, JSON.stringify(lista)); } catch { /* sem armazenamento */ }
  }

  function brl(v) {
    if (v == null) return 'R$ --';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escTexto(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Item 2: função pura que devolve o HTML dos cartões.
  MB.mercado = MB.mercado || {};
  MB.mercado.cartoes = function (lista, porTicker) {
    porTicker = porTicker || {};
    const esc = (MB.ui && MB.ui.esc) || escTexto;
    return (lista || []).map((t) => {
      const tk = esc(t);
      const c = porTicker[t];
      const preco = c ? brl(c.preco) : 'R$ --';
      let varHtml = '--';
      let varStyle = '';
      if (c && c.variacao_dia_pct != null) {
        const sinal = c.variacao_dia_pct >= 0 ? '+' : '';
        varHtml = (sinal + Number(c.variacao_dia_pct).toFixed(2) + '%').replace('.', ',');
        varStyle = c.variacao_dia_pct >= 0 ? 'style="color:var(--ganho)"' : 'style="color:var(--perda)"';
      }
      return `
        <div class="mk-card" data-ticker="${tk}">
          <div class="mk-titulo">${tk}</div>
          <div class="mk-preco">${esc(preco)}</div>
          <div class="mk-var" ${varStyle}>${esc(varHtml)}</div>
          <button type="button" data-remover="${tk}" aria-label="Tirar ${tk} da lista">Remover</button>
        </div>`;
    }).join('');
  };

  function injetarEstilo() {
    if (document.getElementById('mk-estilo')) return;
    const style = document.createElement('style');
    style.id = 'mk-estilo';
    style.textContent = `
#mk-lista { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mk-card { background: var(--cartao); border: 1px solid var(--borda); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.mk-preco { font-size: 1.25rem; font-weight: 700; }
`;
    document.head.appendChild(style);
  }

  MB.telas.mercado = async (el) => {
    const { esc, aba } = await carregarUi();
    aba('mercado');
    injetarEstilo();

    el.innerHTML = `
      <div class="mk-cabeca">
        <input id="mk-busca" type="search" placeholder="Buscar ativo (PETR4, VALE3…)">
        <div id="mk-resultado" class="mk-resultado"></div>
      </div>
      <div id="mk-lista"></div>
    `;

    const input = el.querySelector('#mk-busca');
    const resultado = el.querySelector('#mk-resultado');
    const listaEl = el.querySelector('#mk-lista');

    let timer = null;
    let lista = lerLista();
    if (!lista || lista.length === 0) { lista = [...PADRAO]; gravarLista(lista); }

    function desenhar() {
      listaEl.innerHTML = MB.mercado.cartoes(lista, {});
    }

    // Desenha JÁ antes de esperar a cotação (item 3).
    desenhar();

    async function atualizar() {
      if (!lista.length) return;
      let r;
      try { r = await MB.api('mercado_cotar', { tickers: lista.join(',') }); } catch { return; }
      const cotacoes = (r && r.cotacoes) || [];
      const porTk = {};
      for (const c of cotacoes) porTk[c.ticker] = c;
      // Redesenha com os preços (item 3).
      listaEl.innerHTML = MB.mercado.cartoes(lista, porTk);
    }

    function iniciar() {
      if (timer) clearInterval(timer);
      atualizar();
      timer = setInterval(atualizar, 30000);
    }

    iniciar();

    // Item 4: remover por delegação em #mk-lista.
    listaEl.onclick = (e) => {
      const btn = e.target.closest('[data-remover]');
      if (!btn) return;
      const t = btn.getAttribute('data-remover');
      if (!t) return;
      lista = lista.filter((x) => x !== t);
      gravarLista(lista);
      desenhar();
    };

    let digitando = null;
    input.oninput = () => {
      const q = input.value.trim();
      if (digitando) clearTimeout(digitando);
      if (!q) { resultado.innerHTML = ''; return; }
      digitando = setTimeout(async () => {
        let r;
        try { r = await MB.api('mercado_buscar', { q }); } catch { return; }
        const ativos = (r && r.ativos) || [];
        resultado.innerHTML = '';
        for (const a of ativos) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'mk-resultado-item';
          b.textContent = (a.ticker || '') + ' — ' + esc(a.nome || '');
          b.onclick = () => {
            const tk = String(a.ticker || '').toUpperCase();
            if (!tk || lista.includes(tk)) return;
            lista.push(tk);
            gravarLista(lista);
            resultado.innerHTML = '';
            input.value = '';
            desenhar();
          };
          resultado.appendChild(b);
        }
      }, 400);
    };

    return () => { if (timer) clearInterval(timer); };
  };
})();
