// Kernex Finance: aba Documentos. Envia foto/print, mostra o que foi lido para CONFERIR e só grava depois de confirmar.
'use strict';
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };
  let pendente = null; // { novos, conferir } só na memória da página
  MB.telas.documentos = async (el) => {
    await iniciar('documentos');
    const mes = hoje().slice(0, 7);
    const [l] = await Promise.all([MB.api('lanc_listar', { mes })]);
    const linha = (x, i, grupo) => `<label class="item" style="cursor:pointer"><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-g="${grupo}" data-i="${i}" ${grupo === 'novos' ? 'checked' : ''} style="width:20px;min-height:20px"><span><span class="n">${esc(x.descricao || 'Sem descrição')}</span><br><span class="fraco">${esc(x.data || '?')} · ${esc(x.tipo || '')}${x.parcela ? ` · ${x.parcela}/${x.parcelas_total || '?'}` : ''}${x.motivo ? ' · ⚠ ' + esc(x.motivo) : ''}</span></span></span><span class="v">${x.valor === undefined || Number.isNaN(Number(x.valor)) ? '?' : brl(x.valor)}</span></label>`;
    el.innerHTML = `
      <div class="card"><b>Enviar documento</b><div class="fraco">Foto ou print de fatura, extrato, comprovante Pix, nota ou boleto (até 5 por vez, em JPG, PNG ou WEBP). PDF: tire um print das páginas.</div>
        <input type="file" id="arq" accept="image/*" multiple style="margin-top:10px"><button class="btn" id="ler" style="margin-top:10px">Ler documento</button><div id="st" class="fraco" style="margin-top:8px"></div></div>
      <div id="conf"></div>
      <div class="card"><div class="fraco">Mês ${esc(mes)}</div><div class="item" style="border:0"><span>Receitas</span><span class="v verde">${brl(l.receitas)}</span></div><div class="item" style="border:0"><span>Despesas</span><span class="v">${brl(l.despesas)}</span></div>
        <div class="fraco">Fatura paga e transferência entre suas contas não contam como receita nem despesa.</div></div>
      <div class="card">${l.lancamentos.map((x) => `<div class="item"><div><div class="n">${esc(x.descricao)}</div><div class="fraco">${esc(x.data)} · ${esc(x.tipo)}</div></div><div class="v ${x.tipo === 'receita' ? 'verde' : ''}">${brl(x.valor)}</div></div>`).join('') || '<p class="fraco">Nenhum lançamento neste mês.</p>'}</div>`;
    const desenharConferencia = () => {
      const c = el.querySelector('#conf');
      if (!pendente) { c.innerHTML = ''; return; }
      c.innerHTML = `<div class="card"><b>Conferir antes de salvar</b><div class="fraco">Nada foi gravado ainda. Desmarque o que estiver errado.</div>
        ${pendente.novos.map((x, i) => linha(x, i, 'novos')).join('') || '<p class="fraco">Nenhum lançamento novo.</p>'}
        ${pendente.conferir.length ? `<div class="fraco" style="margin-top:10px">Precisam da sua atenção (não marcados):</div>${pendente.conferir.map((x, i) => linha(x, i, 'conferir')).join('')}` : ''}
        <div class="linha" style="margin-top:12px"><button class="btn sec" id="cancelar">Descartar</button><button class="btn" id="salvar">Salvar marcados</button></div></div>`;
      c.querySelector('#cancelar').onclick = () => { pendente = null; desenharConferencia(); };
      c.querySelector('#salvar').onclick = async () => {
        const marcados = [...c.querySelectorAll('input[type=checkbox]:checked')].map((k) => pendente[k.dataset.g][Number(k.dataset.i)]).filter((x) => x && x.data && Number(x.valor) > 0);
        if (!marcados.length) { MB.ui.ok('Nada marcado.'); return; }
        const r = await MB.api('lanc_salvar_lote', { itens: marcados });
        pendente = null; MB.ui.ok(`${r.salvos} salvo(s)${r.ignorados ? `, ${r.ignorados} repetido(s) ignorado(s)` : ''}.`); recarregar();
      };
    };
    el.querySelector('#ler').onclick = async () => {
      const arqs = [...el.querySelector('#arq').files].slice(0, 5);
      const st = el.querySelector('#st');
      if (!arqs.length) { st.textContent = 'Escolha uma ou mais fotos.'; return; }
      st.textContent = 'Lendo… pode levar até 2 minutos.';
      try {
        const imagens = await Promise.all(arqs.map(reduzir));
        pendente = await MB.api('doc_enviar', { imagens });
        st.textContent = pendente.total_documento ? `Total do documento: ${brl(pendente.total_documento)} · despesas lidas: ${brl(pendente.soma_despesas_lidas)}` : '';
        desenharConferencia();
      } catch { st.textContent = 'Não deu certo. Tente uma foto mais nítida.'; }
    };
    desenharConferencia();
  };
})();
