(function () {
  const PADRAO = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'HGLG11', 'BOVA11', 'IVVB11'];
  const CHAVE_LS = 'kf-mercado';

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

  MB.telas.mercado = async (el) => {
    el.innerHTML = `
      <div class="mk-cabeca">
        <input id="mk-busca" type="search" placeholder="Buscar ativo (PETR4, VALE3…)">
        <div id="mk-resultado" class="mk-resultado"></div>
      </div>
      <div class="mk-lista"></div>
    `;
    const input = el.querySelector('#mk-busca');
    const resultado = el.querySelector('#mk-resultado');
    const listaEl = el.querySelector('.mk-lista');
    let timer = null;
    let lista = lerLista();
    if (!lista || lista.length === 0) { lista = [...PADRAO]; gravarLista(lista); }

    function renderResultado(ativos) {
      resultado.innerHTML = '';
      if (!ativos || !ativos.length) return;
      for (const a of ativos) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mk-resultado-item';
        b.textContent = a.ticker + ' — ' + a.nome;
        b.onclick = () => {
          const t = String(a.ticker || '').toUpperCase();
          if (!t || lista.includes(t)) return;
          lista.push(t);
          gravarLista(lista);
          resultado.innerHTML = '';
          input.value = '';
          desenhar();
          iniciar();
        };
        resultado.appendChild(b);
      }
    }

    function desenhar() {
      listaEl.innerHTML = '';
      for (const t of lista) {
        const card = document.createElement('div');
        card.className = 'mk-card';
        card.innerHTML = `
          <div class="mk-titulo">${t}</div>
          <div class="mk-preco">--</div>
          <div class="mk-var">--</div>
          <button class="mk-remover" type="button">Remover</button>
        `;
        const remover = card.querySelector('.mk-remover');
        remover.onclick = () => {
          lista = lista.filter((x) => x !== t);
          gravarLista(lista);
          desenhar();
        };
        listaEl.appendChild(card);
      }
    }

    async function atualizar() {
      if (!lista.length) return;
      let r;
      try { r = await MB.api('mercado_cotar', { tickers: lista.join(',') }); } catch { return; }
      const cotacoes = (r && r.cotacoes) || [];
      const porTk = {};
      for (const c of cotacoes) porTk[c.ticker] = c;
      for (const card of listaEl.querySelectorAll('.mk-card')) {
        const t = card.querySelector('.mk-titulo').textContent;
        const c = porTk[t];
        const precoEl = card.querySelector('.mk-preco');
        const varEl = card.querySelector('.mk-var');
        precoEl.textContent = c ? brl(c.preco) : 'R$ --';
        if (c && c.variacao_dia_pct != null) {
          varEl.textContent = (c.variacao_dia_pct >= 0 ? '+' : '') + c.variacao_dia_pct.toFixed(2) + '%';
          varEl.style.color = c.variacao_dia_pct >= 0 ? 'var(--ganho)' : 'var(--perda)';
        } else {
          varEl.textContent = '--';
          varEl.style.color = '';
        }
      }
    }

    function iniciar() {
      if (timer) clearInterval(timer);
      atualizar();
      timer = setInterval(atualizar, 30000);
    }

    let digitando = null;
    input.oninput = () => {
      const q = input.value.trim();
      if (digitando) clearTimeout(digitando);
      if (!q) { resultado.innerHTML = ''; return; }
      digitando = setTimeout(async () => {
        let r;
        try { r = await MB.api('mercado_buscar', { q }); } catch { return; }
        renderResultado((r && r.ativos) || []);
      }, 400);
    };

    iniciar();
    return () => { if (timer) clearInterval(timer); };
  };
})();
