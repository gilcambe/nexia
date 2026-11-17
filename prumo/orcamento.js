// Prumo: aba Salário v2 (holerite, folha de ponto, previsão). Usa window.MB e /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((resolve, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => resolve(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const carregarSalario = () => MB.salario ? Promise.resolve(MB.salario) : new Promise((resolve, falha) => { const s = document.createElement('script'); s.src = '/prumo/salario.js'; s.onload = () => resolve(MB.salario); s.onerror = falha; document.body.appendChild(s); });
  const carregarPdf = () => MB.pdf ? Promise.resolve(MB.pdf) : new Promise((resolve, falha) => { const s = document.createElement('script'); s.src = '/prumo/pdf.js'; s.onload = () => resolve(MB.pdf); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };

  let mesSel = new Date().toISOString().slice(0, 7);
  MB.telas.orcamento = async (el) => {
    await iniciar('orcamento');
    await carregarSalario();
    const pdf = await carregarPdf();
    const [r, { objetivos }] = await Promise.all([MB.api('orcamento_resumo', { mes: mesSel }), MB.api('objetivo_listar')]);
    const o = r.orcamento;
    const nomeObj = Object.fromEntries(objetivos.map((x) => [x.id, x.nome]));
    const linhaV = (rot, v, cor) => `<div class="item"><span>${rot}</span><span class="v"${cor ? ` style="color:${cor}"` : ''}>${brl(v)}</span></div>`;
    el.innerHTML = `
      ${MB.salario.cartao(await MB.api('salario_previsao', { mes: mesSel }))}
      ${r.alertas.map((a) => `<div class="aviso-c">⚠️ ${esc(CATS[a.categoria] || a.categoria)}: gastou ${brl(a.gasto)} de ${brl(a.limite)}.</div>`).join('')}
      <div class="card"><label style="margin-top:0">Mês</label><input type="month" id="mes" value="${mesSel}">
        ${r.holerite_mes ? `<p class="fraco">Salário do holerite de ${r.holerite_mes.slice(5)}/${r.holerite_mes.slice(0, 4)}</p>` : '<p class="fraco">Mande seu holerite para eu calcular a renda.</p>'}
        ${linhaV('💰 Renda (líquido)', r.renda)}${linhaV('🏠 Contas fixas', -r.fixas)}${linhaV('🎯 Guardar para objetivos', -r.guardar)}${linhaV('💳 Cartões no mês', -r.cartao)}
        <div class="fraco" style="margin-top:10px">Sobra do mês</div><div class="grande" style="color:${r.sobra >= 0 ? 'var(--verde2)' : 'var(--perigo)'}">${brl(r.sobra)}</div>
        ${r.renda ? barra(Math.min(100, ((r.fixas + r.guardar + r.cartao) / r.renda) * 100), r.sobra < 0 ? '#ef4444' : '') : ''}</div>
      <div class="linha" style="margin-bottom:12px"><button class="btn sec" id="sal-holerite">📄 Holerite (foto ou PDF)</button><button class="btn" id="sal-ponto">🕒 Folha de ponto</button><button class="btn sec" id="sal-manual">✍️ Lançar à mão</button></div>
      <input type="file" id="sal-arq" accept="image/*,application/pdf,.pdf" multiple hidden>
      <div class="card"><div class="item" style="padding-top:0"><b>Contas fixas</b><button class="btn sec mini" id="addf">+ Conta</button></div>
        ${(o.fixas || []).map((f, i) => `<div class="item" data-f="${i}"><span>${esc(f.nome)}${f.dia ? ` <span class="fraco">dia ${f.dia}</span>` : ''}</span><span class="v">${brl(f.valor)}</span></div>`).join('') || '<p class="fraco">Aluguel, luz, internet, escola…</p>'}</div>
      <div class="card"><div class="item" style="padding-top:0"><b>Guardar todo mês</b><button class="btn sec mini" id="addg"${objetivos.length ? '' : ' disabled'}>+ Objetivo</button></div>
        ${(o.guardar || []).map((g, i) => `<div class="item" data-g="${i}"><span>🎯 ${esc(nomeObj[g.objetivo_id] || 'Objetivo apagado')}</span><span class="v">${brl(g.valor)}</span></div>`).join('') || `<p class="fraco">${objetivos.length ? 'Quanto separar para cada objetivo.' : 'Crie objetivos na aba Objetivos.'}</p>`}</div>
      <div class="card"><div class="item" style="padding-top:0"><b>Limite por categoria</b><button class="btn sec mini" id="lim">Editar</button></div>
        ${Object.entries(o.limites || {}).map(([k, v]) => `<div class="item"><span>${esc(CATS[k] || k)}</span><span class="v">${brl(v)}</span></div>`).join('') || '<p class="fraco">Ex.: mercado até R$ 1.200 por mês.</p>'}</div>`;
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
    const conferir = (h, problema) => formulario('Confira o recebimento', [
      { nome: 'mes', rotulo: 'Mês', tipo: 'month', valor: h.mes || mesSel }, { nome: 'empresa', rotulo: 'Empresa', valor: h.empresa },
      { nome: 'bruto', rotulo: 'Salário bruto (R$)', tipo: 'number', valor: h.bruto }, { nome: 'liquido', rotulo: 'Salário líquido (R$)', tipo: 'number', valor: h.liquido },
    ], (d) => MB.api('pagamento_salvar', { ...h, ...d, bruto: Number(d.bruto), liquido: Number(d.liquido) }).then(() => ok('✅ Salvado.')));
    el.querySelector('#sal-manual').onclick = () => conferir({});
    const arq = el.querySelector('#sal-arq');
    const lerArquivos = async (files, tipo) => {
      el.innerHTML = '<div class="card">📄 Lendo… isso leva até 1 minuto.</div>';
      const max = tipo === 'ponto' ? files.slice(0, 5) : files.slice(0, 1);
      if (!max.length) return;
      try {
        const imagens = await Promise.all(max.map((f) => {
          if (f.type && f.type.startsWith('image/')) return reduzir(f);
          return pdf.paraImagens(f);
        }));
        const r2 = await MB.api('salario_ler', { tipo, imagens });
        const okList = (r2.lidos || []).filter((x) => x.ok);
        const falhou = (r2.lidos || []).filter((x) => !x.ok);
        for (const lido of okList) {
          if (tipo === 'ponto') {
            await MB.api('ponto_salvar', lido);
          } else {
            await conferir(lido, r2.problema);
          }
        }
        if (falhou.length) ok(`⚠️ ${falhou.length} arquivo(s) não deu para ler.`);
      } catch { return recarregar(); }
      recarregar();
    };
    el.querySelector('#sal-holerite').onclick = () => { arq.dataset.tipo = 'holerite'; arq.click(); };
    el.querySelector('#sal-ponto').onclick = () => { arq.dataset.tipo = 'ponto'; arq.click(); };
    arq.onchange = async () => {
      const files = [...arq.files];
      if (!files.length) return;
      await lerArquivos(files, arq.dataset.tipo || 'holerite');
      arq.value = '';
    };
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-acao="salario-base"]');
      if (btn) {
        formulario('Informar salário base', [
          { nome: 'salario_base', rotulo: 'Salário base (R$)', tipo: 'number', valor: '' },
        ], (d) => MB.api('salario_config', { salario_base: Number(d.salario_base) }).then(() => { ok('✅ Salário base informado.'); recarregar(); }));
      }
    });
  };
})();
