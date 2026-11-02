'use strict';
// Prumo: telas (Carteira, Objetivos, Gastos, Compras). Usa window.MB de /prumo/app.js.
(function () {
  const MB = window.MB;
  const { brl, esc } = MB;
  const TIPOS = { renda_fixa: 'Renda fixa', acoes: 'Ações', fiis: 'FIIs', fundos: 'Fundos', tesouro: 'Tesouro', cripto: 'Cripto', previdencia: 'Previdência', fgts: 'FGTS', poupanca: 'Poupança', conta: 'Conta', outro: 'Outro' };
  const CATS = { mercado: 'Mercado', casa: 'Casa', transporte: 'Transporte', saude: 'Saúde', lazer: 'Lazer', educacao: 'Educação', restaurante: 'Restaurante', assinaturas: 'Assinaturas', outros: 'Outros' };
  const hoje = () => new Date().toISOString().slice(0, 10);
  const opcoes = (mapa, sel) => Object.entries(mapa).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const barra = (pct, cor) => `<div class="barra"><i style="width:${Math.max(0, Math.min(100, pct))}%;${cor ? 'background:' + cor : ''}"></i></div>`;

  // Janela simples com formulário. campos: [{ nome, rotulo, tipo, valor, opcoes }]
  function formulario(titulo, campos, aoSalvar, aoApagar) {
    const d = document.createElement('dialog');
    d.innerHTML = `<h3 style="margin-top:0">${esc(titulo)}</h3><form method="dialog">${campos.map((c) => `<label>${esc(c.rotulo)}</label>${
      c.opcoes ? `<select name="${c.nome}">${c.opcoes}</select>` : `<input name="${c.nome}" type="${c.tipo || 'text'}" ${c.tipo === 'number' ? 'step="0.01" inputmode="decimal"' : ''} value="${esc(c.valor == null ? '' : c.valor)}">`
    }`).join('')}<div class="linha" style="margin-top:16px">${aoApagar ? '<button type="button" class="btn perigo" data-x="apagar">Apagar</button>' : ''}<button type="button" class="btn sec" data-x="fechar">Cancelar</button><button class="btn" data-x="salvar">Salvar</button></div></form>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-x=fechar]').onclick = () => d.close();
    if (aoApagar) d.querySelector('[data-x=apagar]').onclick = async () => { if (confirm('Apagar mesmo?')) { await aoApagar(); d.close(); MB.recarregar(); } };
    d.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target).entries());
      try { await aoSalvar(dados); d.close(); MB.recarregar(); } catch { /* erro já mostrado */ }
    };
  }

  // Reduz o print para no máximo 1600 px de largura (JPEG 0.8) antes de mandar.
  function reduzir(arquivo) {
    return new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => {
        const esc2 = Math.min(1, 1600 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * esc2);
        c.height = Math.round(img.height * esc2);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = falha;
      img.src = URL.createObjectURL(arquivo);
    });
  }

  // ───────── Carteira ─────────
  MB.telas.carteira = async (el) => {
    const [{ itens, total, por_tipo }, { objetivos }] = await Promise.all([MB.api('carteira_listar'), MB.api('objetivo_listar')]);
    const nomeObj = Object.fromEntries(objetivos.map((o) => [o.id, o.nome]));
    const optObj = (sel) => `<option value="">Sem objetivo</option>` + objetivos.map((o) => `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
    const bancos = {};
    itens.forEach((i) => { const b = i.banco || 'Sem banco'; bancos[b] = (bancos[b] || 0) + i.valor; });
    const tipos = Object.entries(por_tipo).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      <div class="card"><div class="fraco">Patrimônio total</div><div class="grande">${brl(total)}</div>
        ${tipos.map(([t, v]) => `<div style="margin-top:8px"><div class="item" style="padding:0;border:0"><span>${esc(TIPOS[t] || t)}</span><span>${brl(v)}</span></div>${barra(total ? (v / total) * 100 : 0)}</div>`).join('')}
      </div>
      <div class="linha" style="margin-bottom:12px"><button class="btn sec" id="add">✍️ Preencher</button><button class="btn" id="print">📷 Só mandar os prints</button></div>
      <input type="file" id="arq" accept="image/*" multiple hidden>
      ${Object.keys(bancos).length > 1 ? `<div class="card"><div class="fraco">Por banco</div>${Object.entries(bancos).map(([b, v]) => `<div class="item"><span>${esc(b)}</span><span class="v">${brl(v)}</span></div>`).join('')}</div>` : ''}
      <div class="card">${itens.length ? itens.map((i) => `<div class="item" data-id="${i.id}"><div><div class="n">${esc(i.nome)}</div><div class="fraco">${esc(i.banco || '')} · ${esc(TIPOS[i.tipo] || i.tipo)}${i.objetivo_id && nomeObj[i.objetivo_id] ? ' · 🎯 ' + esc(nomeObj[i.objetivo_id]) : ''} · ${esc(i.data_valor || '')}</div></div><div class="v">${brl(i.valor)}</div></div>`).join('') : '<p class="fraco">Nada ainda. Toque em "Só mandar os prints" e mande os prints do app do banco, da previdência e do FGTS, ou preencha à mão.</p>'}</div>`;

    const editar = (i) => formulario(i ? 'Editar investimento' : 'Novo investimento', [
      { nome: 'nome', rotulo: 'Nome (ex.: CDB Inter 2028)', valor: i && i.nome },
      { nome: 'banco', rotulo: 'Banco ou corretora', valor: i && i.banco },
      { nome: 'tipo', rotulo: 'Tipo', opcoes: opcoes(TIPOS, i ? i.tipo : 'renda_fixa') },
      { nome: 'valor', rotulo: 'Saldo atual (R$)', tipo: 'number', valor: i && i.valor },
      { nome: 'data_valor', rotulo: 'Data do saldo', tipo: 'date', valor: (i && i.data_valor) || hoje() },
      { nome: 'vencimento', rotulo: 'Vencimento (se tiver)', tipo: 'date', valor: i && i.vencimento },
      { nome: 'taxa', rotulo: 'Rentabilidade (ex.: 110% CDI)', valor: i && i.taxa },
      { nome: 'objetivo_id', rotulo: 'Objetivo', opcoes: optObj(i && i.objetivo_id) },
    ], (d) => MB.api('carteira_salvar', { ...d, valor: Number(d.valor), id: i && i.id }), i && (() => MB.api('carteira_apagar', { id: i.id })));

    el.querySelector('#add').onclick = () => editar(null);
    el.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editar(itens.find((x) => x.id === n.dataset.id)); });
    const arq = el.querySelector('#arq');
    el.querySelector('#print').onclick = () => arq.click();
    arq.onchange = async () => {
      const files = [...arq.files].slice(0, 5);
      if (!files.length) return;
      if (arq.files.length > 5) MB.erro('Mandei só os 5 primeiros prints.');
      el.innerHTML = '<div class="card">📷 Lendo seus prints… isso leva até 1 minuto.</div>';
      let lidos;
      try { lidos = await MB.api('ler_print', { imagens: await Promise.all(files.map(reduzir)) }); } catch { return MB.recarregar(); }
      conferir(el, lidos, optObj);
    };
  };

  function conferir(el, { itens, descartados }, optObj) {
    if (!itens.length) { el.innerHTML = '<div class="card">Não achei valores nesses prints. Tente um print mais nítido ou preencha à mão.</div><button class="btn sec" id="volta">Voltar</button>'; el.querySelector('#volta').onclick = MB.recarregar; return; }
    el.innerHTML = `<div class="card"><b>Confira antes de salvar</b><p class="fraco">Corrija o que estiver errado e desmarque o que não quer salvar. Nada foi salvo ainda.</p>
      ${itens.map((i, n) => `<div class="card" data-n="${n}" style="background:#0e1a14">
        <label><input type="checkbox" checked style="width:auto;min-height:0"> Salvar este</label>
        <label>Nome</label><input data-k="nome" value="${esc(i.nome)}">
        <label>Banco</label><input data-k="banco" value="${esc(i.banco)}">
        <label>Tipo</label><select data-k="tipo">${opcoes(TIPOS, i.tipo)}</select>
        <label>Saldo (R$)</label><input data-k="valor" type="number" step="0.01" value="${i.valor}">
        <label>Objetivo</label><select data-k="objetivo_id">${optObj('')}</select></div>`).join('')}
      ${descartados && descartados.length ? `<p class="fraco">${descartados.length} item(ns) sem valor legível foram ignorados.</p>` : ''}
      <div class="linha"><button class="btn sec" id="cancelar">Cancelar</button><button class="btn" id="salvar">Salvar selecionados</button></div></div>`;
    el.querySelector('#cancelar').onclick = MB.recarregar;
    el.querySelector('#salvar').onclick = async () => {
      const escolhidos = [...el.querySelectorAll('[data-n]')].filter((c) => c.querySelector('input[type=checkbox]').checked).map((c) => {
        const base = { ...itens[Number(c.dataset.n)] };
        c.querySelectorAll('[data-k]').forEach((f) => { base[f.dataset.k] = f.dataset.k === 'valor' ? Number(f.value) : f.value; });
        return base;
      });
      if (!escolhidos.length) return MB.recarregar();
      try { const r = await MB.api('carteira_salvar_varios', { itens: escolhidos }); MB.erro(`✅ ${r.salvos} investimento(s) salvos/atualizados.`, true); } catch { return; }
      MB.recarregar();
    };
  }

  // ───────── Objetivos ─────────
  MB.telas.objetivos = async (el) => {
    const [{ objetivos }, hist] = await Promise.all([MB.api('objetivo_listar'), MB.api('historico_listar')]);
    const v = hist.variacao;
    el.innerHTML = `
      <div class="card"><div class="fraco">Evolução do patrimônio</div>${grafico(hist.pontos)}
        ${v ? `<p>Seu patrimônio ${v.valor >= 0 ? '<b class="verde">subiu' : '<b class="verm">caiu'} ${brl(Math.abs(v.valor))}${v.percentual != null ? ` (${Math.abs(v.percentual)}%)` : ''}</b> desde o mês passado.</p>` : '<p class="fraco">O gráfico cresce a cada mês em que você atualiza a carteira.</p>'}</div>
      <button class="btn" id="novo" style="width:100%;margin-bottom:12px">🎯 Novo objetivo</button>
      ${objetivos.map((o) => `<div class="card" data-id="${o.id}"><div class="item" style="padding:0;border:0"><span class="n">${esc(o.nome)}</span><span class="fraco">até ${esc(o.prazo.slice(5, 7) + '/' + o.prazo.slice(0, 4))}</span></div>
        <div style="margin-top:6px">${brl(o.atual)} de ${brl(o.meta)} · <b>${o.percentual}%</b></div>${barra(o.percentual, o.cor || '')}
        <div class="fraco" style="margin-top:6px">${o.falta > 0 ? `Faltam ${brl(o.falta)} · guarde ${brl(o.por_mes)} por mês para chegar no prazo` : '✅ Meta alcançada!'}</div></div>`).join('') || '<p class="fraco">Crie seus objetivos (aposentadoria, reserva, carro, imóvel…) e ligue cada investimento a um deles na aba Carteira.</p>'}
      <p class="fraco">As contas aqui são estimativas para organizar seus planos; não são recomendação oficial de investimento.</p>`;
    const editar = (o, nomeSugerido) => formulario(o ? 'Editar objetivo' : 'Novo objetivo', [
      { nome: 'nome', rotulo: 'Nome', valor: o ? o.nome : nomeSugerido || '' },
      { nome: 'meta', rotulo: 'Meta (R$)', tipo: 'number', valor: o && o.meta },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'month', valor: o && o.prazo },
      { nome: 'aporte_mensal', rotulo: 'Quanto pretende guardar por mês (R$)', tipo: 'number', valor: o && o.aporte_mensal },
      { nome: 'perfil', rotulo: 'Perfil para este objetivo', opcoes: opcoes({ conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' }, o ? o.perfil : 'moderado') },
    ], (d) => MB.api('objetivo_salvar', { ...d, id: o && o.id }), o && (() => MB.api('objetivo_apagar', { id: o.id })));
    el.querySelector('#novo').onclick = () => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3 style="margin-top:0">Qual objetivo?</h3>${['Aposentadoria', 'Reserva de emergência', 'Carro', 'Imóvel', 'Viagem', 'Estudos dos filhos', 'Outro'].map((n) => `<span class="chip">${n}</span>`).join('')}`;
      document.body.appendChild(d);
      d.showModal();
      d.addEventListener('close', () => d.remove());
      d.querySelectorAll('.chip').forEach((c) => { c.onclick = () => { d.close(); editar(null, c.textContent === 'Outro' ? '' : c.textContent); }; });
    };
    el.querySelectorAll('.card[data-id]').forEach((n) => { n.onclick = () => editar(objetivos.find((x) => x.id === n.dataset.id)); });
  };

  function grafico(pontos) {
    if (!pontos.length) return '<p class="fraco">Sem histórico ainda.</p>';
    const W = 320, H = 120, max = Math.max(...pontos.map((p) => p.total)) || 1, min = Math.min(...pontos.map((p) => p.total));
    const base = min === max ? 0 : min * 0.95;
    const xy = pontos.map((p, i) => [pontos.length === 1 ? W / 2 : (i / (pontos.length - 1)) * (W - 20) + 10, H - 20 - ((p.total - base) / (max - base || 1)) * (H - 40)]);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Evolução do patrimônio">
      <polyline fill="none" stroke="#22c55e" stroke-width="3" points="${xy.map((p) => p.join(',')).join(' ')}"/>
      ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#22c55e"><title>${pontos[i].mes}: ${brl(pontos[i].total)}</title></circle>`).join('')}
      <text x="10" y="${H - 4}" fill="#9bb3a5" font-size="11">${pontos[0].mes.slice(5)}/${pontos[0].mes.slice(2, 4)}</text>
      <text x="${W - 10}" y="${H - 4}" fill="#9bb3a5" font-size="11" text-anchor="end">${brl(pontos[pontos.length - 1].total)}</text></svg>`;
  }

  // ───────── Gastos de cartão ─────────
  let mesGastos = hoje().slice(0, 7);
  MB.telas.gastos = async (el) => {
    const [{ cartoes }, g] = await Promise.all([MB.api('cartao_listar'), MB.api('gasto_listar', { mes: mesGastos })]);
    const nomeC = Object.fromEntries(cartoes.map((c) => [c.id, c.nome]));
    const dia = new Date().getDate();
    const vencendo = cartoes.filter((c) => { const f = (c.dia_vencimento - dia + 31) % 31; return f <= 3; });
    el.innerHTML = `
      ${vencendo.map((c) => `<div class="aviso">💳 A fatura do <b>${esc(c.nome)}</b> vence dia ${c.dia_vencimento}.</div>`).join('')}
      <div class="card"><label style="margin-top:0">Mês</label><input type="month" id="mes" value="${mesGastos}">
        <div class="fraco" style="margin-top:10px">Total do mês</div><div class="grande">${brl(g.total)}</div></div>
      <div class="linha" style="margin-bottom:12px"><button class="btn" id="gasto"${cartoes.length ? '' : ' disabled'}>+ Gasto</button><button class="btn sec" id="cartoes">Meus cartões</button></div>
      ${cartoes.length ? `<div class="card">${cartoes.map((c) => { const usado = g.por_cartao[c.id] || 0; const pct = c.limite ? (usado / c.limite) * 100 : 0; return `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span class="n">${esc(c.nome)}</span><span>${brl(usado)} de ${brl(c.limite)}</span></div>${barra(pct, pct > 80 ? '#ef4444' : '')}<div class="fraco">Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}${c.programa_pontos ? ' · ' + esc(c.programa_pontos) : ''}</div></div>`; }).join('')}</div>` : '<div class="card fraco">Cadastre seu primeiro cartão em "Meus cartões".</div>'}
      ${Object.keys(g.por_categoria).length ? `<div class="card"><div class="fraco">Por categoria</div>${Object.entries(g.por_categoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(CATS[k] || k)}</span><span>${brl(v)}</span></div>${barra(g.total ? (v / g.total) * 100 : 0)}</div>`).join('')}</div>` : ''}
      <div class="card">${g.gastos.map((x) => `<div class="item" data-id="${x.id}"><div><div class="n">${esc(x.descricao)}${x.parcela ? ` <span class="fraco">${x.parcela}</span>` : ''}</div><div class="fraco">${esc(nomeC[x.cartao_id] || 'Cartão apagado')} · ${esc(CATS[x.categoria] || x.categoria)} · ${x.data.slice(8, 10)}/${x.data.slice(5, 7)}</div></div><div class="v">${brl(x.valor_mes)}</div></div>`).join('') || '<p class="fraco">Nenhum gasto neste mês.</p>'}</div>`;
    el.querySelector('#mes').onchange = (e) => { mesGastos = e.target.value || mesGastos; MB.recarregar(); };
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

  // ───────── Lista de compras ─────────
  let listaAberta = null;
  let vigia = null;
  MB.telas.compras = async (el) => {
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
    if (av) av.onclick = async () => { await Notification.requestPermission(); MB.recarregar(); };
    el.querySelectorAll('.card[data-id]').forEach((n) => { n.onclick = () => { listaAberta = n.dataset.id; MB.recarregar(); }; });
  };

  function abrirLista(el, l) {
    const salvarLista = (itens, extra) => MB.api('lista_salvar', { id: l.id, nome: l.nome, lembrete: l.lembrete || '', itens, ...(extra || {}) });
    el.innerHTML = `<button class="btn sec mini" id="volta">‹ Listas</button>
      <div class="card"><div class="item" style="padding:0 0 8px"><span class="n" style="font-size:20px">${esc(l.nome)}</span><span class="fraco">faltam ${l.faltam}</span></div>
        ${l.itens.map((i, n) => `<label class="item" style="margin:0;color:var(--txt)"><span><input type="checkbox" data-n="${n}" ${i.comprado ? 'checked' : ''} style="width:auto;min-height:0;margin-right:8px"><span style="${i.comprado ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(i.nome)}</span></span><span class="fraco">${i.qtd}${esc(i.unidade ? ' ' + i.unidade : '')}</span></label>`).join('') || '<p class="fraco">Lista vazia.</p>'}
        <form id="add" class="linha" style="margin-top:10px"><input name="nome" placeholder="Item (ex.: Arroz)" style="flex:3"><input name="qtd" type="number" value="1" min="1" style="flex:1"><button class="btn mini">+</button></form></div>
      <div class="linha"><button class="btn sec" id="limpar">Limpar comprados</button><button class="btn sec" id="zap">Mandar no WhatsApp</button><button class="btn perigo" id="apagar">Apagar lista</button></div>`;
    el.querySelector('#volta').onclick = () => { listaAberta = null; MB.recarregar(); };
    el.querySelectorAll('input[data-n]').forEach((c) => { c.onchange = async () => { await MB.api('lista_marcar', { id: l.id, indice: Number(c.dataset.n), comprado: c.checked }); MB.recarregar(); }; });
    el.querySelector('#add').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      if (!d.nome.trim()) return;
      await salvarLista([...l.itens, { nome: d.nome, qtd: Number(d.qtd) || 1, comprado: false }]);
      MB.recarregar();
    };
    el.querySelector('#limpar').onclick = async () => { await salvarLista(l.itens.filter((i) => !i.comprado)); MB.recarregar(); };
    el.querySelector('#apagar').onclick = async () => { if (confirm('Apagar esta lista?')) { await MB.api('lista_apagar', { id: l.id }); listaAberta = null; MB.recarregar(); } };
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
