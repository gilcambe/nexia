'use strict';
// Kernex Finance: aba Cartões. Limite comprometido, próximas faturas, qual cartão rende mais, simulador de compra,
// recorrências e cobranças para revisar. Os cálculos vêm do servidor; aqui só desenha.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const carregarDocs = () => MB.docLeitura ? Promise.resolve(MB.docLeitura) : new Promise((ok) => { const s = document.createElement('script'); s.src = '/prumo/documentos.js'; s.onload = () => ok(MB.docLeitura || null); s.onerror = () => ok(null); document.body.appendChild(s); });
  const carregarLeitura = () => MB.leitura ? Promise.resolve(MB.leitura) : new Promise((ok) => { const s = document.createElement('script'); s.src = '/prumo/leitura.js'; s.onload = () => ok(MB.leitura); s.onerror = () => ok(null); document.body.appendChild(s); });
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = (m) => MES[Number(m.slice(5)) - 1] + '/' + m.slice(2, 4);

  MB.telas.cartoes = async (el) => {
    const { brl, esc, barra, aba, formulario, ok } = await carregarUi();
    aba('cartoes');
    const [v, i] = await Promise.all([MB.api('cartao_visao'), MB.api('cartao_inteligencia')]);
    // Preencher por print/PDF da fatura: abre o formulário do cartão já preenchido; ao salvar, usa cartao_salvar (junta com o que o cartão já tinha).
    // Fatura (dono 19/11: "não tem onde inserir o print da fatura"): print/foto/PDF -> compras lidas -> confere -> grava.
    const ligarFatura = () => {
      el.insertAdjacentHTML('afterbegin', `<div class="card" id="ca-fat"><h3 style="margin:0 0 4px">🧾 Fatura do cartão</h3>
        <div class="fraco">Mande o print, foto ou PDF da fatura. Eu leio as compras, você confere e grava. Digitar continua na aba Gastos.</div>
        <button class="btn" id="ca-fat-foto" type="button" style="margin-top:8px">📷 Print ou foto da fatura</button> <button class="btn sec" id="ca-fat-pdf" type="button" style="margin-top:8px">📄 PDF da fatura</button>
        <input type="file" id="ca-fat-arq" accept="image/*" multiple hidden><div id="ca-fat-res"></div></div>`);
      const arq = el.querySelector('#ca-fat-arq'); const res = el.querySelector('#ca-fat-res');
      if (!arq || !res) return;
      const escolher = (aceita) => { arq.accept = aceita; arq.value = ''; arq.click(); };
      el.querySelector('#ca-fat-foto').onclick = () => escolher('image/*');
      el.querySelector('#ca-fat-pdf').onclick = () => escolher('application/pdf,.pdf');
      arq.onchange = async (ev) => {
        const arqs = [...((ev && ev.target && ev.target.files) || arq.files || [])];
        if (!arqs.length) return;
        if (arqs.length > 5) { res.innerHTML = '<div class="aviso-c">Envie no máximo 5 arquivos por vez.</div>'; return; }
        res.innerHTML = '<div class="fraco">Lendo a fatura… pode levar até 2 minutos.</div>';
        try {
          const docs = await carregarDocs();
          if (!docs) throw new Error('Não consegui abrir o leitor agora.');
          const { r, cortou } = await docs.ler(arqs);
          docs.mostrar(res, r, { brl, esc, ok }, () => MB.abrirAba('cartoes'));
          // Dono 19/11: forçar recarregamento das telas após a gravação.
          // O mostrarLeituraEm chama a API e quando termina chama o "depois()", que recarrega a aba.
          // Para garantir que "Cartões" apareça atualizado, passamos uma função que força o reload da visão.
          const f0 = (r.prontos || []).find((l) => l.vencimento) || (r.prontos || [])[0];
          const nomeK = f0 && (f0.instituicao || f0.conta_ou_cartao);
          if (f0 && nomeK && !v.cartoes.some((k) => String(k.nome).toLowerCase() === String(nomeK).toLowerCase())) {
            const venc = Number(String(f0.vencimento || f0.data || '').slice(8, 10)) || '';
            res.insertAdjacentHTML('afterbegin', `<button class="btn" id="ca-fat-novo" type="button" style="margin-top:8px">💳 Cadastrar o cartão ${esc(nomeK)}${venc ? ' (vence dia ' + venc + ')' : ''} e gravar a fatura</button>`);
            res.querySelector('#ca-fat-novo').onclick = () => formulario('Confira o cartão', [
              { nome: 'nome', rotulo: 'Nome do cartão', valor: nomeK },
              { nome: 'limite', rotulo: 'Limite (R$, se souber)', tipo: 'number', valor: '' },
              { nome: 'dia_fechamento', rotulo: 'Dia do fechamento (1 a 31)', tipo: 'number', valor: venc ? ((venc + 23) % 31) || 31 : '' },
              { nome: 'dia_vencimento', rotulo: 'Dia do vencimento (1 a 31)', tipo: 'number', valor: venc },
            ], (d) => MB.api('cartao_salvar', { ...d, limite: Number(d.limite || 0), dia_fechamento: Number(d.dia_fechamento), dia_vencimento: Number(d.dia_vencimento) }).then(() => MB.api('doc_confirmar', { lancamentos: r.prontos })).then((o) => ok(`✅ Cartão cadastrado e ${o.gravados} lançamento(s) da fatura gravado(s).`)), null);
          }
          if (cortou) res.insertAdjacentHTML('afterbegin', '<div class="aviso-c">Li as 5 primeiras páginas. Mande o resto em seguida.</div>');
        } catch (e) { res.innerHTML = `<div class="aviso-c">${esc(e && e.message || 'Não consegui ler agora.')} Tente de novo com uma imagem mais nítida.</div>`; }
      };
    };
    const ligarLeitura = async () => {
      const lei = await carregarLeitura();
      if (!lei) return;
      lei.botao(el, { id: 'ca-ler', rotulo: '💳 Cadastrar cartão por print', ajuda: 'Para o limite, o fechamento e o vencimento: mande o print da tela de limite do app do cartão (ou da fatura). Eu não peço senha.', acao: 'cartao_print_ler',
        aoLer: (l) => {
          const k0 = l.cartao; const ja = v.cartoes.find((x) => String(x.nome).toLowerCase() === String(k0.nome).toLowerCase());
          if (k0.fatura_atual > 0) ok(`Fatura lida: ${brl(k0.fatura_atual)} (a fatura não é salva aqui; lance as compras na aba Gastos).`);
          formulario('Confira o cartão', [
            { nome: 'nome', rotulo: 'Nome do cartão', valor: (ja && ja.nome) || k0.nome },
            { nome: 'bandeira', rotulo: 'Bandeira (opcional)', valor: k0.bandeira || (ja && ja.bandeira) },
            { nome: 'limite', rotulo: 'Limite (R$)', tipo: 'number', valor: k0.limite || (ja && ja.limite) },
            { nome: 'dia_fechamento', rotulo: 'Dia do fechamento (1 a 31)', tipo: 'number', valor: k0.dia_fechamento || (ja && ja.dia_fechamento) },
            { nome: 'dia_vencimento', rotulo: 'Dia do vencimento (1 a 31)', tipo: 'number', valor: k0.dia_vencimento || (ja && ja.dia_vencimento) },
          ], (d) => MB.api('cartao_salvar', { ...(ja || {}), ...d, limite: Number(d.limite), dia_fechamento: Number(d.dia_fechamento), dia_vencimento: Number(d.dia_vencimento), id: ja && ja.id }), null);
        } });
    };
    if (!v.cartoes.length) { el.innerHTML = '<div class="card fraco">Você ainda não tem cartão. Use "Cadastrar cartão por print" acima ou a aba Gastos, em "Meus cartões".</div>'; await ligarLeitura(); ligarFatura(); return; }
    el.innerHTML = `
      <div class="card"><div class="fraco">Limite comprometido (estimado)</div><div class="grande">${brl(v.total_comprometido)}</div>
        <div class="fraco">de ${brl(v.total_limite)} de limite · limite de cartão não é dinheiro</div></div>
      ${v.cartoes.map((k) => `<div class="card" data-cartao="${esc(k.id)}"><div class="item" style="padding:0;border:0"><span class="n">${esc(k.nome)}${k.bandeira ? ' · ' + esc(k.bandeira) : ''}</span><span>${k.vence_em_dias <= 3 ? '🟠 ' : ''}vence dia ${k.dia_vencimento} <button type="button" class="btn sec mini" data-editar-cartao="${esc(k.id)}" aria-label="Editar cartão">✏️</button> <button type="button" class="btn sec mini" data-apagar-cartao="${esc(k.id)}" aria-label="Apagar cartão">🗑️</button></span></div>
        ${barra(k.pct || 0, k.pct > 80 ? '#ef4444' : '')}
        <div class="fraco">Comprometido ${brl(k.comprometido)} · disponível ${brl(k.disponivel)}${k.pct === null ? '' : ' · ' + String(k.pct).replace('.', ',') + '%'}</div>
        <div class="fraco" style="margin-top:8px">Próximas faturas</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:70px">${(() => { const max = Math.max(1, ...k.proximas.map((p) => p.valor)); return k.proximas.map((p) => `<div style="flex:1;text-align:center;font-size:11px"><div style="height:${Math.round((p.valor / max) * 48)}px;background:var(--azul2);border-radius:4px 4px 0 0;min-height:2px"></div><span class="fraco">${nomeMes(p.mes)}</span></div>`).join(''); })()}</div>
        <div class="fraco">Este mês: ${brl(k.fatura_mes)}</div>
        ${k.anuidade_analise ? `<div class="fraco" style="margin-top:8px">💳 Anuidade ${brl(k.anuidade_analise.anuidade)}: ${k.anuidade_analise.compensa === null ? esc(k.anuidade_analise.motivo) : k.anuidade_analise.compensa ? 'compensa (retorno ' + brl(k.anuidade_analise.retorno_anual) + ' por ano no seu ritmo de gasto)' : 'não compensa no seu ritmo de gasto (retorno ' + brl(k.anuidade_analise.retorno_anual) + ')'}</div>` : ''}</div>`).join('')}
      <div class="card"><h3 style="margin:0 0 6px">🏆 Qual cartão rende mais?</h3>
        ${v.melhor.ranking.map((r, n) => `<div class="item"><span class="n">${n + 1}. ${esc(r.nome)}</span><span>${String(r.retorno.pct).replace('.', ',')}% de volta${r.retorno.parcial ? ' (só cashback)' : ''}</span></div>`).join('') || '<p class="fraco">Informe pontos por real e o valor do milheiro (ou cashback) nos cartões para comparar.</p>'}
        ${v.melhor.sem_dados.length ? `<div class="fraco">Sem dados para comparar: ${v.melhor.sem_dados.map((x) => esc(x.nome)).join(', ')}.</div>` : ''}</div>
      <div class="card"><h3 style="margin:0 0 6px">🧮 Simular compra</h3>
        <label>Cartão</label><select id="sim-cartao">${v.cartoes.map((k) => `<option value="${esc(k.id)}">${esc(k.nome)}</option>`).join('')}</select>
        <label>Valor total (R$)</label><input id="sim-valor" type="number" step="0.01" inputmode="decimal">
        <label>Parcelas</label><input id="sim-parc" type="number" value="1" min="1" max="48">
        <button class="btn" id="sim-ir" type="button" style="margin-top:10px">Simular</button><div id="sim-res"></div></div>
      ${i.recorrentes.length ? `<div class="card"><h3 style="margin:0 0 6px">🔁 Compras recorrentes</h3>${i.recorrentes.map((r) => `<div class="item"><span class="n">${esc(r.estabelecimento)}</span><span>${brl(r.valor_medio)} · ${r.meses} meses</span></div>`).join('')}</div>` : ''}
      ${i.suspeitas.length ? `<div class="card"><h3 style="margin:0 0 6px">🔎 Cobranças para revisar</h3><div class="fraco">Não é acusação: só valem uma olhada.</div>${i.suspeitas.map((s) => `<div class="item"><div><div class="n">${esc(s.lancamento.descricao)}</div><div class="fraco">${esc(s.motivo)} · ${s.lancamento.data.slice(8, 10)}/${s.lancamento.data.slice(5, 7)}</div></div><span class="v">${brl(s.lancamento.valor)}</span></div>`).join('')}</div>` : ''}
      <div class="fraco" style="margin-top:8px">${esc(v.aviso)}</div>`;
    await ligarLeitura(); ligarFatura(); // fatura fica no topo
    el.querySelectorAll('[data-editar-cartao]').forEach((b) => { b.onclick = () => { // dono 19/11: editar o cartão
      const k = v.cartoes.find((x) => x.id === b.dataset.editarCartao); if (!k) return;
      formulario('Editar cartão', [
        { nome: 'nome', rotulo: 'Nome do cartão', valor: k.nome },
        { nome: 'limite', rotulo: 'Limite (R$)', tipo: 'number', valor: k.limite },
        { nome: 'dia_fechamento', rotulo: 'Dia do fechamento (1 a 31)', tipo: 'number', valor: k.dia_fechamento },
        { nome: 'dia_vencimento', rotulo: 'Dia do vencimento (1 a 31)', tipo: 'number', valor: k.dia_vencimento },
      ], (d) => MB.api('cartao_salvar', { ...k, ...d, id: k.id, limite: Number(d.limite || 0), dia_fechamento: Number(d.dia_fechamento), dia_vencimento: Number(d.dia_vencimento) }), () => MB.api('cartao_apagar', { id: k.id }));
    }; });
    el.querySelectorAll('[data-apagar-cartao]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Apagar este cartão? As compras lançadas continuam.')) return;
      try { await MB.api('cartao_apagar', { id: b.dataset.apagarCartao }); ok('🗑️ Cartão apagado.'); MB.abrirAba('cartoes'); } catch { /* erro já mostrado */ }
    }; });
    el.querySelector('#sim-ir').onclick = async () => {
      const res = el.querySelector('#sim-res');
      const valor = Number(el.querySelector('#sim-valor').value);
      if (!(valor > 0)) { res.innerHTML = '<div class="aviso-c" style="margin-top:10px">Digite o valor da compra.</div>'; return; }
      try {
        const r = await MB.api('cartao_simular', { cartao_id: el.querySelector('#sim-cartao').value, valor, parcelas: Number(el.querySelector('#sim-parc').value) || 1 });
        res.innerHTML = `<div class="card" style="margin-top:10px;border-color:${r.cabe ? 'var(--verde)' : 'var(--perigo)'}"><div class="n">${r.cabe ? '✅ Cabe no limite' : '🔴 Não cabe no limite'}</div>
          <div class="fraco">Disponível: ${brl(r.disponivel_antes)} → ${brl(r.disponivel_depois)}${r.pct_depois === null ? '' : ' (' + String(r.pct_depois).replace('.', ',') + '% comprometido)'}</div>
          ${r.faturas.map((f) => `<div class="item"><span>${nomeMes(f.mes)}</span><span>${brl(f.valor_antes)} → <b>${brl(f.valor_antes + f.parcela_nova)}</b></span></div>`).join('')}</div>`;
      } catch { /* erro já mostrado */ }
    };
  };
})();
