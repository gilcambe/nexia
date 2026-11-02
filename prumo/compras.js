'use strict';
// Prumo: aba compras. Usa window.MB (casca em app.js) e as peças de /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  let listaAberta = null;
  let vigia = null;
  MB.telas.compras = async (el) => {
    ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi());
    MB.ui.aba('compras');
    const { listas } = await MB.api('lista_listar');
    vigiarLembretes(listas);
    const l = listaAberta && listas.find((x) => x.id === listaAberta);
    if (l) return abrirLista(el, l);
    listaAberta = null;
    el.innerHTML = `
      <div class="linha" style="margin-bottom:12px"><button class="btn" id="nova">+ Nova lista</button>${'Notification' in window && Notification.permission !== 'granted' ? '<button class="btn sec" id="avisos">🔔 Ativar avisos</button>' : ''}</div>
      ${listas.map((x) => `<div class="card" data-id="${x.id}"><div class="item" style="padding:0;border:0"><span class="n">${esc(x.nome)}</span><span class="fraco">${x.faltam ? `faltam ${x.faltam}` : '✅ completa'}</span></div>
        <div class="fraco">${x.itens.length} itens${x.total_estimado ? ' · ' + brl(x.total_estimado) : ''}${x.lembrete ? ' · 🔔 ' + new Date(x.lembrete).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</div></div>`).join('') || '<p class="fraco">Crie sua lista do mercado, farmácia, feira…</p>'}`;
    el.querySelector('#nova').onclick = () => formulario('Nova lista', [
      { nome: 'nome', rotulo: 'Nome (ex.: Mercado do mês)' },
      { nome: 'lembrete', rotulo: 'Me avisar em (opcional)', tipo: 'datetime-local' },
    ], (d) => MB.api('lista_salvar', { nome: d.nome, lembrete: d.lembrete ? new Date(d.lembrete).toISOString() : '', itens: [] }));
    const av = el.querySelector('#avisos');
    if (av) av.onclick = async () => { await Notification.requestPermission(); recarregar(); };
    el.querySelectorAll('.card[data-id]').forEach((n) => { n.onclick = () => { listaAberta = n.dataset.id; recarregar(); }; });
  };

  function abrirLista(el, l) {
    const salvarLista = (itens, extra) => MB.api('lista_salvar', { id: l.id, nome: l.nome, lembrete: l.lembrete || '', itens, ...(extra || {}) });
    el.innerHTML = `<button class="btn sec mini" id="volta">‹ Listas</button>
      <div class="card"><div class="item" style="padding:0 0 8px"><span class="n" style="font-size:20px">${esc(l.nome)}</span><span class="fraco">faltam ${l.faltam}</span></div>
        ${l.itens.map((i, n) => `<label class="item" style="margin:0;color:var(--txt)"><span><input type="checkbox" data-n="${n}" ${i.comprado ? 'checked' : ''} style="width:auto;min-height:0;margin-right:8px"><span style="${i.comprado ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(i.nome)}</span></span><span class="fraco">${i.qtd}${esc(i.unidade ? ' ' + i.unidade : '')}</span></label>`).join('') || '<p class="fraco">Lista vazia.</p>'}
        <form id="add" class="linha" style="margin-top:10px"><input name="nome" placeholder="Item (ex.: Arroz)" style="flex:3"><input name="qtd" type="number" value="1" min="1" style="flex:1"><button class="btn mini">+</button></form></div>
      <div class="linha"><button class="btn sec" id="limpar">Limpar comprados</button><button class="btn sec" id="zap">Mandar no WhatsApp</button><button class="btn perigo" id="apagar">Apagar lista</button></div>`;
    el.querySelector('#volta').onclick = () => { listaAberta = null; recarregar(); };
    el.querySelectorAll('input[data-n]').forEach((c) => { c.onchange = async () => { await MB.api('lista_marcar', { id: l.id, indice: Number(c.dataset.n), comprado: c.checked }); recarregar(); }; });
    el.querySelector('#add').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      if (!d.nome.trim()) return;
      await salvarLista([...l.itens, { nome: d.nome, qtd: Number(d.qtd) || 1, comprado: false }]);
      recarregar();
    };
    el.querySelector('#limpar').onclick = async () => { await salvarLista(l.itens.filter((i) => !i.comprado)); recarregar(); };
    el.querySelector('#apagar').onclick = async () => { if (confirm('Apagar esta lista?')) { await MB.api('lista_apagar', { id: l.id }); listaAberta = null; recarregar(); } };
    el.querySelector('#zap').onclick = () => {
      const t = `🛒 ${l.nome}\n` + l.itens.filter((i) => !i.comprado).map((i) => `- ${i.nome} (${i.qtd}${i.unidade ? ' ' + i.unidade : ''})`).join('\n');
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
    };
  }

  // Com o app aberto, avisa (notificação do navegador) quando o lembrete de uma lista chega.
  function vigiarLembretes(listas) {
    if (vigia) clearInterval(vigia);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const avisadas = new Set();
    vigia = setInterval(() => {
      const agora = Date.now();
      listas.forEach((l) => {
        if (l.lembrete && l.faltam && !avisadas.has(l.id) && Date.parse(l.lembrete) <= agora && agora - Date.parse(l.lembrete) < 120000) {
          avisadas.add(l.id);
          try { new Notification('Prumo: ' + l.nome, { body: `Faltam ${l.faltam} itens na sua lista.`, icon: '/prumo/icone.svg' }); } catch { /* sem notificação */ }
        }
      });
    }, 60000);
  }
})();
