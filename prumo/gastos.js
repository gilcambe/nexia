'use strict';
// Prumo: aba gastos. Usa window.MB (casca em app.js) e as peças de /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  let mesGastos = new Date().toISOString().slice(0, 7);
  MB.telas.gastos = async (el) => {
    ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi());
    MB.ui.aba('gastos');
    const [{ cartoes }, g] = await Promise.all([MB.api('cartao_listar'), MB.api('gasto_listar', { mes: mesGastos })]);
    const nomeC = Object.fromEntries(cartoes.map((c) => [c.id, c.nome]));
    const dia = new Date().getDate();
    const vencendo = cartoes.filter((c) => { const f = (c.dia_vencimento - dia + 31) % 31; return f <= 3; });
    el.innerHTML = `
      ${vencendo.map((c) => `<div class="aviso-c">💳 A fatura do <b>${esc(c.nome)}</b> vence dia ${c.dia_vencimento}.</div>`).join('')}
      <div class="card"><label style="margin-top:0">Mês</label><input type="month" id="mes" value="${mesGastos}">
        <div class="fraco" style="margin-top:10px">Total do mês</div><div class="grande">${brl(g.total)}</div></div>
      <div class="linha" style="margin-bottom:12px"><button class="btn" id="gasto"${cartoes.length ? '' : ' disabled'}>+ Gasto</button><button class="btn sec" id="cartoes">Meus cartões</button></div>
      ${cartoes.length ? `<div class="card">${cartoes.map((c) => { const usado = g.por_cartao[c.id] || 0; const pct = c.limite ? (usado / c.limite) * 100 : 0; return `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span class="n">${esc(c.nome)}</span><span>${brl(usado)} de ${brl(c.limite)}</span></div>${barra(pct, pct > 80 ? '#ef4444' : '')}<div class="fraco">Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}${c.programa_pontos ? ' · ' + esc(c.programa_pontos) : ''}</div></div>`; }).join('')}</div>` : '<div class="card fraco">Cadastre seu primeiro cartão em "Meus cartões".</div>'}
      ${Object.keys(g.por_categoria).length ? `<div class="card"><div class="fraco">Por categoria</div>${Object.entries(g.por_categoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(CATS[k] || k)}</span><span>${brl(v)}</span></div>${barra(g.total ? (v / g.total) * 100 : 0)}</div>`).join('')}</div>` : ''}
      <div class="card">${g.gastos.map((x) => `<div class="item" data-id="${x.id}"><div><div class="n">${esc(x.descricao)}${x.parcelas > 1 ? ` <span class="fraco">${x.parcela}/${x.parcelas}</span>` : ''}</div><div class="fraco">${esc(nomeC[x.cartao_id] || 'Cartão apagado')} · ${esc(CATS[x.categoria] || x.categoria)} · ${x.data.slice(8, 10)}/${x.data.slice(5, 7)}</div></div><div class="v">${brl(x.valor_mes)}</div></div>`).join('') || '<p class="fraco">Nenhum gasto neste mês.</p>'}</div>`;
    el.querySelector('#mes').onchange = (e) => { mesGastos = e.target.value || mesGastos; recarregar(); };
    const optC = (sel) => cartoes.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
    const editarGasto = (x) => formulario(x ? 'Editar gasto' : 'Novo gasto', [
      { nome: 'descricao', rotulo: 'O que comprou', valor: x && x.descricao },
      { nome: 'valor', rotulo: 'Valor total (R$)', tipo: 'number', valor: x && x.valor },
      { nome: 'parcelas', rotulo: 'Parcelas', tipo: 'number', valor: x ? x.parcelas : 1 },
      { nome: 'cartao_id', rotulo: 'Cartão', opcoes: optC(x && x.cartao_id) },
      { nome: 'categoria', rotulo: 'Categoria', opcoes: opcoes(CATS, x ? x.categoria : 'mercado') },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: x ? x.data : hoje() },
    ], (d) => MB.api('gasto_salvar', { ...d, valor: Number(d.valor), parcelas: Number(d.parcelas) || 1, id: x && x.id }), x && (() => MB.api('gasto_apagar', { id: x.id })));
    el.querySelector('#gasto').onclick = () => editarGasto(null);
    el.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editarGasto(g.gastos.find((x) => x.id === n.dataset.id)); });
    el.querySelector('#cartoes').onclick = () => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3 style="margin-top:0">Meus cartões</h3>${cartoes.map((c) => `<div class="item" data-id="${c.id}"><span>${esc(c.nome)}</span><span class="fraco">editar ›</span></div>`).join('')}<div class="linha" style="margin-top:12px"><button class="btn sec" data-x="f">Fechar</button><button class="btn" data-x="n">+ Cartão</button></div>`;
      document.body.appendChild(d);
      d.showModal();
      d.addEventListener('close', () => d.remove());
      const editarC = (c) => { d.close(); formulario(c ? 'Editar cartão' : 'Novo cartão', [
        { nome: 'nome', rotulo: 'Nome (ex.: Nubank)', valor: c && c.nome },
        { nome: 'limite', rotulo: 'Limite (R$)', tipo: 'number', valor: c && c.limite },
        { nome: 'dia_fechamento', rotulo: 'Dia que a fatura fecha', tipo: 'number', valor: c && c.dia_fechamento },
        { nome: 'dia_vencimento', rotulo: 'Dia que a fatura vence', tipo: 'number', valor: c && c.dia_vencimento },
        { nome: 'programa_pontos', rotulo: 'Programa de pontos (ex.: Livelo, Smiles)', valor: c && c.programa_pontos },
      ], (x) => MB.api('cartao_salvar', { ...x, limite: Number(x.limite), dia_fechamento: Number(x.dia_fechamento), dia_vencimento: Number(x.dia_vencimento), id: c && c.id }), c && (() => MB.api('cartao_apagar', { id: c.id }))); };
      d.querySelector('[data-x=f]').onclick = () => d.close();
      d.querySelector('[data-x=n]').onclick = () => editarC(null);
      d.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editarC(cartoes.find((c) => c.id === n.dataset.id)); });
    };
  };
})();
