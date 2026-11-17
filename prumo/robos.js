'use strict';
// Kernex Finance: aba Robôs (parte 2b de 3). Robôs de investimento com aviso por cotação ao vivo.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  const TIPOS = {
    preco_abaixo: 'Preço caiu abaixo de',
    preco_acima: 'Preço subiu acima de',
    queda_dia: 'Caiu no dia mais de',
    dy_minimo: 'Dividendos (12 meses) acima de',
    rebalancear: 'Carteira fora da meta em mais de',
    concentracao: 'Um tipo passou de'
  };

  function n2(v) {
    if (v == null) return '';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pct(v) {
    if (v == null) return '';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
  }

  function descrever(robo) {
    if (!robo || !robo.tipo) return 'Robô sem tipo';
    const t = TIPOS[robo.tipo];
    if (!t) return 'Robô sem tipo';
    const tk = robo.ticker ? robo.ticker + ' ' : '';
    switch (robo.tipo) {
      case 'preco_abaixo': return `Avisar quando ${tk}ficar abaixo de R$ ${n2(robo.valor)}`;
      case 'preco_acima': return `Avisar quando ${tk}ficar acima de R$ ${n2(robo.valor)}`;
      case 'queda_dia': return `Avisar quando ${tk}cair mais de ${pct(robo.pct)} no dia`;
      case 'dy_minimo': return `Avisar quando ${tk}pagar mais de ${pct(robo.pct)} em 12 meses`;
      case 'rebalancear': return `Avisar quando a carteira sair da meta em mais de ${pct(robo.desvio_pct)}`;
      case 'concentracao': return `Avisar quando um tipo de investimento passar de ${pct(robo.pct)} da carteira`;
      default: return 'Robô sem tipo';
    }
  }

  MB.robos = { TIPOS, descrever };

  MB.telas.robos = async (el) => {
    const { esc, aba } = await carregarUi();
    aba('robos');

    let lista = [];
    try {
      const r = await MB.api('robos_listar');
      lista = (r && r.robos) || [];
    } catch (e) {
      lista = [];
    }
    const disparos = [];
    try {
      const r = await MB.api('robos_listar');
      const d = (r && r.disparos) || [];
      disparos.push(...d);
    } catch { /* ok */ }

    el.innerHTML = `
      <div class="card"><p style="margin:0 0 8px">${esc('O robô confere seus investimentos com a cotação ao vivo e avisa. Quem compra ou vende é você.')}</p></div>
      <div class="card"><h3 style="margin:0 0 8px">Seus robôs</h3><div id="rb-lista">${lista.length ? lista.map((r) => `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--borda);padding:6px 0"><span>${esc(descrever(r))}</span><button class="btn sec" type="button" data-apagar="${esc(r.id)}" style="padding:4px 10px;font-size:13px">Apagar</button></div>`).join('') : '<p style="color:var(--fraco);margin:0">Nenhum robô ainda.</p>'}</div></div>
      <div class="card"><h3 style="margin:0 0 8px">Novo robô</h3>
        <form id="rb-form">
          <label>Tipo</label><select id="rb-tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select>
          <label>Ticker</label><input id="rb-ticker" type="text" placeholder="PETR4">
          <label>Valor</label><input id="rb-num" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">
          <button class="btn" type="submit">Salvar</button>
        </form>
      </div>
      <div class="card"><button class="btn sec" type="button" id="rb-checar" style="padding:10px">Conferir agora</button><div id="rb-checar-msg" style="margin-top:8px;color:var(--fraco);font-size:14px"></div></div>
      <div class="card"><h3 style="margin:0 0 8px">Últimos avisos</h3><div id="rb-disparos">${disparos.length ? disparos.map((d) => `<div class="fraco" style="padding:4px 0">${esc(d.tipo || '')} ${esc(d.texto || '')}</div>`).join('') : '<p style="color:var(--fraco);margin:0">Sem avisos ainda.</p>'}</div></div>`;

    const tipoSel = el.querySelector('#rb-tipo');
    const tickerInp = el.querySelector('#rb-ticker');
    const numInp = el.querySelector('#rb-num');

    function atualizarCampos() {
      const t = tipoSel.value;
      const esconder = t === 'rebalancear' || t === 'concentracao';
      tickerInp.hidden = esconder;
      if (t === 'preco_abaixo' || t === 'preco_acima') {
        numInp.placeholder = 'Valor (R$)';
        tickerInp.placeholder = 'Ticker (ex.: PETR4)';
      } else if (t === 'rebalancear') {
        numInp.placeholder = 'Desvio (%)';
      } else {
        numInp.placeholder = 'Percentual (%)';
      }
    }
    tipoSel.onchange = atualizarCampos;
    atualizarCampos();

    el.querySelector('#rb-form').onsubmit = async (ev) => {
      ev.preventDefault();
      const t = tipoSel.value;
      const body = { tipo: t };
      const n = Number(numInp.value);
      if (Number.isNaN(n)) { mostrarErro('Informe um número válido.'); return; }
      if (t === 'preco_abaixo' || t === 'preco_acima') {
        body.ticker = tickerInp.value.trim().toUpperCase();
        body.valor = n;
      } else if (t === 'rebalancear') {
        body.desvio_pct = n;
      } else {
        body.ticker = tickerInp.value.trim().toUpperCase();
        body.pct = n;
      }
      try {
        await MB.api('robos_salvar', body);
        numInp.value = '';
        MB.abrirAba('robos');
      } catch (e) { mostrarErro(e.message || 'Não consegui salvar.'); }
    };

    el.querySelector('#rb-lista').onclick = async (ev) => {
      const btn = ev.target.closest('[data-apagar]');
      if (!btn) return;
      const id = btn.getAttribute('data-apagar');
      if (!confirm('Apagar este robô?')) return;
      try {
        await MB.api('robos_apagar', { id });
        MB.abrirAba('robos');
      } catch (e) { mostrarErro(e.message || 'Não consegui apagar.'); }
    };

    el.querySelector('#rb-checar').onclick = async () => {
      const msg = el.querySelector('#rb-checar-msg');
      try {
        const r = await MB.api('robos_checar');
        const d = (r && r.disparos) || [];
        const l = (r && r.lacunas) || [];
        msg.textContent = `Disparos: ${d.length}. Lacunas: ${l.length}.`;
      } catch (e) { msg.textContent = e.message || 'Não consegui conferir agora.'; }
    };

    function mostrarErro(m) {
      const ee = el.querySelector('#rb-msg');
      if (ee) { ee.textContent = m; ee.hidden = !m; }
      else alert(m);
    }
  };
})();
