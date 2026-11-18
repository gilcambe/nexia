'use strict';
// Prumo: aba Salário (holerite + programação do salário). Usa window.MB e /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };

  const carregarJs = (nome, src) => MB[nome] ? Promise.resolve() : new Promise((res, falha) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = falha; document.body.appendChild(s); });

  // PDF como está (data:application/pdf;base64,...), até 3 MB.
  const lerCru = (a) => new Promise((ok, falha) => {
    if (a.size > 3 * 1024 * 1024) return falha(new Error('PDF grande demais (máx. 3 MB). Tire um print da página.'));
    const r = new FileReader();
    r.onload = () => ok(String(r.result)); // o servidor reconhece o PDF pelo conteúdo
    r.onerror = () => falha(new Error('O celular não entregou o arquivo. Baixe o PDF para o aparelho e escolha de novo.'));
    r.readAsDataURL(a);
  });
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
        ${r.holerite_mes ? `<p class="fraco">Salário do holerite de ${r.holerite_mes.slice(5)}/${r.holerite_mes.slice(0, 4)}</p>` : '<p class="fraco">Mande seu holerite para eu calcular a renda.</p>'}
        ${linhaV('💰 Renda (líquido)', r.renda)}${linhaV('🏠 Contas fixas', -r.fixas)}${linhaV('🎯 Guardar para objetivos', -r.guardar)}${linhaV('💳 Cartões no mês', -r.cartao)}
        <div class="fraco" style="margin-top:10px">Sobra do mês</div><div class="grande" style="color:${r.sobra >= 0 ? 'var(--verde2)' : 'var(--perigo)'}">${brl(r.sobra)}</div>
        ${r.renda ? barra(Math.min(100, ((r.fixas + r.guardar + r.cartao) / r.renda) * 100), r.sobra < 0 ? '#ef4444' : '') : ''}</div>
      ${MB.salario.cartao(sal)}
      <div class="linha" style="margin-bottom:12px"><button class="btn" id="sal-holerite">📄 Holerite (foto ou PDF)</button><button class="btn sec" id="sal-ponto">🕒 Folha de ponto</button><button class="btn sec" id="sal-manual">✍️ Lançar à mão</button></div>
      <input type="file" id="sal-arq" accept="image/*,application/pdf,.pdf" multiple hidden>
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
    const base = el.querySelector('[data-acao="salario-base"]');
    if (base) base.onclick = () => formulario('Salário base', [{ nome: 'salario_base', rotulo: 'Salário base bruto (R$)', tipo: 'number' }],
      (d) => MB.api('salario_config', { salario_base: Number(d.salario_base) }).then(() => { ok('✅ Salário base salvo.'); recarregar(); }));
    const arq = el.querySelector('#sal-arq');
    let modo = 'holerite';
    el.querySelector('#sal-holerite').onclick = () => { modo = 'holerite'; arq.click(); };
    el.querySelector('#sal-ponto').onclick = () => { modo = 'ponto'; arq.click(); };
    arq.onchange = async () => {
      const arquivos = [...arq.files].slice(0, 5);
      if (!arquivos.length) return;
      const tipo = modo;
      el.innerHTML = `<div class="card">📄 Lendo ${tipo === 'ponto' ? 'sua folha de ponto' : 'seus holerites'}… isso leva até 1 minuto.</div>`;
      let lidos;
      try {
        // 17/11: no celular do dono o pdf.js falhava ou gerava imagem vazia ('Imagem inválida'). Holerite em PDF vai CRU
        // (o servidor lê PDF com o Gemini/Cloudflare); foto/print é reduzida. Nada vazio sai daqui.
        const imagens = await Promise.all(arquivos.map((a) => (MB.pdf.ehPdf(a) ? lerCru(a) : reduzir(a))));
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
