'use strict';
// Prumo: aba Salário (holerite + programação do salário). Usa window.MB e /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };

  const carregarJs = (nome, src) => MB[nome] ? Promise.resolve() : new Promise((res, falha) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = falha; document.body.appendChild(s); });

  // PDF como está (data:application/pdf;base64,...), até 3 MB.
  const viaLeitor = (a) => new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || '')); r.onerror = () => ok('');
    r.readAsDataURL(a);
  });
  const viaBytes = async (a) => {
    try {
      const b = new Uint8Array(await a.arrayBuffer()); let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return b.length ? 'data:application/pdf;base64,' + btoa(bin) : '';
    } catch { return ''; }
  };
  const lerCru = async (a) => {
    if (a.size > 3 * 1024 * 1024) throw new Error('PDF grande demais (máx. 3 MB). Tire um print da página.');
    let d = await viaLeitor(a); // o servidor reconhece o PDF pelo conteúdo
    if (d.length - d.indexOf(',') < 100) d = await viaBytes(a);
    if (d.length - d.indexOf(',') < 100) throw new Error(`O celular entregou o PDF vazio (${Math.round((a.size || 0) / 1024)} KB informados). Abra o PDF pelo app "Arquivos" (ou baixe de novo) e escolha por lá.`);
    return d;
  };
  let mesSel = new Date().toISOString().slice(0, 7);
  MB.telas.orcamento = async (el) => {
    await iniciar('orcamento');
    await Promise.all([carregarJs('salario', '/prumo/salario.js'), carregarJs('previsto', '/prumo/previsto.js'), carregarJs('pdf', '/prumo/pdf.js')]);
    const [r, { objetivos }, sal] = await Promise.all([MB.api('orcamento_resumo', { mes: mesSel }), MB.api('objetivo_listar'), MB.api('salario_previsao', { mes: mesSel })]);
    const o = r.orcamento;
    const nomeObj = Object.fromEntries(objetivos.map((x) => [x.id, x.nome]));
    const linhaV = (rot, v, cor) => `<div class="item"><span>${rot}</span><span class="v"${cor ? ` style="color:${cor}"` : ''}>${brl(v)}</span></div>`;
    el.innerHTML = `
      ${r.alertas.map((a) => `<div class="aviso-c">⚠️ ${esc(CATS[a.categoria] || a.categoria)}: gastou ${brl(a.gasto)} de ${brl(a.limite)}.</div>`).join('')}
      <div class="card"><label style="margin-top:0">Mês</label><input type="month" id="mes" value="${mesSel}">
        ${r.renda_fonte === 'salario' ? '<p class="fraco">Renda do mês: o que já caiu + o que falta receber (veja Recebimentos abaixo)</p>' : r.holerite_mes ? `<p class="fraco">Salário do holerite de ${r.holerite_mes.slice(5)}/${r.holerite_mes.slice(0, 4)}</p>` : '<p class="fraco">Mande seu holerite para eu calcular a renda.</p>'}
        ${linhaV('💰 Renda (líquido)', r.renda)}${linhaV('🏠 Contas fixas', -r.fixas)}${linhaV('🎯 Guardar para objetivos', -r.guardar)}${linhaV('💳 Cartões no mês', -r.cartao)}
        <div class="fraco" style="margin-top:10px">Sobra do mês</div><div class="grande" style="color:${r.sobra >= 0 ? 'var(--verde2)' : 'var(--perigo)'}">${brl(r.sobra)}</div>
        ${r.renda ? barra(Math.min(100, ((r.fixas + r.guardar + r.cartao) / r.renda) * 100), r.sobra < 0 ? '#ef4444' : '') : ''}</div>
      ${MB.salario.cartao(sal)}
      <div class="linha" style="margin-bottom:12px"><button class="btn" id="sal-holerite">📷 Holerite (print ou foto)</button><button class="btn sec" id="sal-holerite-pdf">📄 Holerite em PDF</button><button class="btn sec" id="sal-ponto">🕒 Folha de ponto</button><button class="btn sec" id="sal-manual">✍️ Lançar à mão</button></div>
      <input type="file" id="sal-arq" accept="image/*" multiple hidden>
      <div class="card"><div class="item" style="padding-top:0"><b>Contas fixas</b><button class="btn sec mini" id="addf">+ Conta</button></div>
        ${(o.fixas || []).map((f, i) => `<div class="item" data-f="${i}"><span>${esc(f.nome)}${f.dia ? ` <span class="fraco">dia ${f.dia}</span>` : ''}</span><span class="v">${brl(f.valor)}</span></div>`).join('') || '<p class="fraco">Aluguel, luz, internet, escola…</p>'}</div>
      <div class="card"><div class="item" style="padding-top:0"><b>Guardar todo mês</b><button class="btn sec mini" id="addg"${objetivos.length ? '' : ' disabled'}>+ Objetivo</button></div>
        ${(o.guardar || []).map((g, i) => `<div class="item" data-g="${i}"><span>🎯 ${esc(nomeObj[g.objetivo_id] || 'Objetivo apagado')}</span><span class="v">${brl(g.valor)}</span></div>`).join('') || `<p class="fraco">${objetivos.length ? 'Quanto separar para cada objetivo.' : 'Crie objetivos na aba Objetivos.'}</p>`}</div>
      <div class="card"><div class="item" style="padding-top:0"><b>Limite por categoria</b><button class="btn sec mini" id="lim">Editar</button></div>
        ${Object.entries(o.limites || {}).map(([k, v]) => `<div class="item"><span>${esc(CATS[k] || k)}</span><span class="v">${brl(v)}</span></div>`).join('') || '<p class="fraco">Ex.: mercado até R$ 1.200 por mês.</p>'}</div>`;
    if (MB.previsto) MB.previsto.ligar(el);
    el.querySelector('#mes').onchange = (e) => { mesSel = e.target.value || mesSel; recarregar(); };
    const salvarOrc = (mud) => MB.api('orcamento_salvar', { ...o, ...mud });
    const editarFixa = (i) => { const f = i == null ? null : o.fixas[i]; formulario(f ? 'Editar conta' : 'Nova conta fixa', [
      { nome: 'nome', rotulo: 'Conta (ex.: Aluguel)', valor: f && f.nome }, { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', valor: f && f.valor }, { nome: 'dia', rotulo: 'Dia de pagar', tipo: 'number', valor: f && f.dia },
    ], (d) => { const fixas = [...o.fixas]; const n = { nome: d.nome, valor: Number(d.valor), dia: Number(d.dia) || null }; if (f) fixas[i] = n; else fixas.push(n); return salvarOrc({ fixas }); },
    f && (() => salvarOrc({ fixas: o.fixas.filter((_, j) => j !== i) }))); };
    const editarGuardar = (i) => { const g = i == null ? null : o.guardar[i]; formulario('Guardar para objetivo', [
      { nome: 'objetivo_id', rotulo: 'Objetivo', opcoes: objetivos.map((x) => `<option value="${x.id}"${g && g.objetivo_id === x.id ? ' selected' : ''}>${esc(x.nome)}</option>`).join('') }, { nome: 'valor', rotulo: 'Quanto por mês (R$)', tipo: 'number', valor: g && g.valor },
    ], (d) => { const guardar = [...o.guardar]; const n = { objetivo_id: d.objetivo_id, valor: Number(d.valor) }; if (g) guardar[i] = n; else guardar.push(n); return salvarOrc({ guardar }); },
    g && (() => salvarOrc({ guardar: o.guardar.filter((_, j) => j !== i) }))); };
    el.querySelector('#addf').onclick = () => editarFixa(null);
    el.querySelectorAll('[data-f]').forEach((n) => { n.onclick = () => editarFixa(Number(n.dataset.f)); });
    el.querySelector('#addg').onclick = () => editarGuardar(null);
    el.querySelectorAll('[data-g]').forEach((n) => { n.onclick = () => editarGuardar(Number(n.dataset.g)); });
    el.querySelector('#lim').onclick = () => formulario('Limite por categoria (deixe vazio para não usar)', Object.entries(CATS).map(([k, v]) => ({ nome: k, rotulo: v, tipo: 'number', valor: (o.limites || {})[k] })),
      (d) => salvarOrc({ limites: Object.fromEntries(Object.entries(d).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }));
    const conferir = (p) => formulario('Confira o recebimento', MB.salario.camposRecebimento(p, mesSel),
      (d) => MB.api('pagamento_salvar', MB.salario.corpoPagamento(p, d)).then(() => { ok('✅ Recebimento salvo.'); recarregar(); }));
    el.querySelector('#sal-manual').onclick = () => conferir({});
    // Tocar num recebimento: editar ou apagar (tudo que sobe pode ser apagado).
    el.querySelectorAll('[data-pag]').forEach((n) => {
      const p = (sal.recebidos || []).find((x) => x.id === n.dataset.pag);
      if (!p || !p.id) return;
      n.onclick = () => formulario('Recebimento', MB.salario.camposRecebimento(p, mesSel),
        (d) => MB.api('pagamento_salvar', { ...MB.salario.corpoPagamento(p, d), id: p.id }).then(() => { ok('✅ Recebimento salvo.'); recarregar(); }),
        () => MB.api('pagamento_apagar', { id: p.id }).then(() => ok('🗑️ Recebimento apagado.')));
    });
    const base = el.querySelector('[data-acao="salario-base"]');
    if (base) base.onclick = () => formulario('Salário base', [{ nome: 'salario_base', rotulo: 'Salário base bruto (R$)', tipo: 'number' }],
      (d) => MB.api('salario_config', { salario_base: Number(d.salario_base) }).then(() => { ok('✅ Salário base salvo.'); recarregar(); }));
    const arq = el.querySelector('#sal-arq');
    let modo = 'holerite';
    // Print/foto: seletor de IMAGENS (o de documentos entregava 0 KB no Android). PDF: botão próprio.
    const escolher = (m, aceita) => { modo = m; arq.accept = aceita; arq.value = ''; arq.click(); };
    el.querySelector('#sal-holerite').onclick = () => escolher('holerite', 'image/*');
    const btPdf = el.querySelector('#sal-holerite-pdf'); if (btPdf) btPdf.onclick = () => escolher('holerite', 'application/pdf,.pdf');
    el.querySelector('#sal-ponto').onclick = () => escolher('ponto', 'image/*');
    arq.onchange = async () => {
      const arquivos = [...arq.files].slice(0, 5);
      if (!arquivos.length) return;
      const tipo = modo;
      // Lê os arquivos ANTES de mexer na tela (com o <input> ainda na página): no Android eles chegavam vazios.
      // Holerite em PDF vai CRU (o servidor lê PDF com o Gemini/Cloudflare); foto/print é reduzida. Nada vazio sai daqui.
      let imagens;
      try { imagens = await Promise.all(arquivos.map((a) => (MB.pdf.ehPdf(a) ? lerCru(a) : reduzir(a)))); } catch (e) { return ok('⚠️ ' + ((e && e.message) || 'Não consegui abrir o arquivo.')); }
      el.innerHTML = `<div class="card">📄 Lendo ${tipo === 'ponto' ? 'sua folha de ponto' : 'seus holerites'}… isso leva até 1 minuto.</div>`;
      let lidos;
      try {
        const ruim = imagens.find((d) => typeof d !== 'string' || d.length < 200 || !/^data:[^,]{0,120},/.test(d));
        if (ruim !== undefined) throw new Error('Não consegui preparar o arquivo no celular (' + (typeof ruim === 'string' ? ruim.slice(0, 40) + '… ' + ruim.length : typeof ruim) + '). Tire um print do holerite e mande a imagem.');
        ({ lidos } = await MB.api('salario_ler', { tipo, imagens }));
      } catch (e) { await recarregar(); return ok('⚠️ ' + ((e && e.message) || 'Não consegui ler agora. Tente de novo.')); }
      lidos = lidos || [];
      const boas = lidos.filter((l) => l && l.ok);
      recarregar();
      const falhas = lidos.length - boas.length;
      if (falhas) ok(`⚠️ Não deu para ler ${falhas} ${falhas === 1 ? 'arquivo' : 'arquivos'}.`);
      for (const l of boas) {
        if (tipo === 'ponto') { try { await MB.api('ponto_salvar', l.ponto); ok('✅ Folha de ponto salva.'); } catch { ok('⚠️ Não consegui salvar a folha de ponto.'); } } else conferir(l.pagamento);
      }
    };
  };
})();
