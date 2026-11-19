'use strict';
// Kernex Finance: aba Documentos. Envia fotos/prints, mostra o que a IA leu, deixa corrigir e só então grava.
// Nada duvidoso vira lançamento sem a pessoa confirmar.
(function () {
  const MB = window.MB;
  const carregarPdf = () => MB.pdf ? Promise.resolve(MB.pdf) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/pdf.js'; s.onload = () => ok(MB.pdf); s.onerror = falha; document.body.appendChild(s); });
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const carregarPrevisto = () => Promise.resolve(MB.previsto || null); // previsto.js vem no index.html; sem ele a tela segue sem a parte de previstos
  const TIPO = { despesa: 'Gasto', receita: 'Entrada', transferencia_propria: 'Transferência própria', pagamento_fatura: 'Pagamento de fatura' };
  const DOC = { fatura: 'Fatura de cartão', extrato: 'Extrato', comprovante: 'Comprovante', nota: 'Nota fiscal', boleto: 'Boleto', recibo: 'Recibo', conta: 'Conta de consumo', corretora: 'Extrato de corretora', milhas: 'Extrato de milhas', outro: 'Documento' };

  // Mostra o que foi lido e grava só o que a pessoa marcar. Usado por Documentos e pela fatura na aba Cartões.
  function mostrarLeituraEm(res, r, ui, depois) {
    const { brl, esc, ok } = ui;
    const linhas = [
      ...r.prontos.map((l) => ({ ...l, _conf: true, _incluir: true })),
      ...r.conferir.map((l) => ({ ...l, _conf: false, _incluir: false })),
    ];
    const linha = (l, i) => `<div class="item" data-i="${i}" style="align-items:flex-start"><label style="display:flex;gap:8px;align-items:flex-start;flex:1;margin:0"><input type="checkbox" data-inc ${l._incluir ? 'checked' : ''} style="width:22px;min-height:22px;margin-top:4px"><span style="flex:1"><span class="n">${esc(l.descricao || l.estabelecimento || '(sem descrição)')}</span><br><span class="fraco">${esc(l.data || 'sem data')} · ${esc(TIPO[l.tipo] || l.tipo || 'tipo?')}${l.motivo ? ' · <b class="verm">' + esc(l.motivo) + '</b>' : ''}</span></span></label><input data-val inputmode="decimal" value="${esc(l.valor == null ? '' : l.valor)}" style="width:110px;min-height:40px" aria-label="Valor"></div>`;
    res.innerHTML = `<div class="card"><h3 style="margin:0 0 4px">${esc(DOC[r.documento] || 'Documento')} lido</h3>
      <div class="fraco">${r.imagens_lidas} de ${r.imagens_total} imagem(ns) lida(s)${r.ja_lancados ? ` · ${r.ja_lancados} já estavam lançados e foram ignorados` : ''}</div>
      <div class="fraco" style="margin-top:6px">Prontos somam: entradas ${brl(r.receitas)} · gastos ${brl(r.despesas)}</div>
      ${r.conferir.length ? `<div class="aviso-c" style="margin-top:10px">⚠️ ${r.conferir.length} item(ns) precisam da sua conferência. Eles NÃO entram na conta até você marcar.</div>` : ''}
      <div id="kf-linhas">${linhas.length ? linhas.map(linha).join('') : '<p class="fraco">Não encontrei lançamentos neste documento.</p>'}</div>
      ${linhas.length ? '<button class="btn" id="kf-grava" type="button" style="margin-top:12px">Confirmar e gravar marcados</button>' : ''}</div>`;
    const g = res.querySelector('#kf-grava');
    if (!g) return;
    g.onclick = async () => {
      const marcados = [...res.querySelectorAll('.item[data-i]')].filter((d) => d.querySelector('[data-inc]').checked).map((d) => {
        const l = linhas[Number(d.dataset.i)];
        const { _conf, _incluir, motivo, ...limpo } = l;
        return { ...limpo, valor: d.querySelector('[data-val]').value, ...(l._conf ? {} : { forcar: true }) };
      });
      if (!marcados.length) { ok('Nenhum item marcado.'); return; }
      g.disabled = true;
      try {
        const out = await MB.api('doc_confirmar', { lancamentos: marcados });
        ok(`${out.gravados} lançamento(s) gravado(s)${out.ja_existiam ? ` · ${out.ja_existiam} já existiam` : ''}${out.rejeitados.length ? ` · ${out.rejeitados.length} recusado(s)` : ''}`);
        depois();
      } catch { g.disabled = false; }
    };
  }

  async function lerArquivos(arqs) {
    const { reduzir } = await carregarUi();
    const pdf = await carregarPdf();
    const { imagens, cortou } = await pdf.paraImagens(arqs, reduzir);
    return { r: await MB.api('doc_ler', { imagens }), cortou };
  }
  MB.docLeitura = { mostrar: mostrarLeituraEm, ler: lerArquivos };

  MB.telas.documentos = async (el) => {
    const { brl, esc, reduzir, ok, aba } = await carregarUi();
    aba('documentos');
    const hoje = new Date();
    const mes = hoje.toISOString().slice(0, 7);
    const rec = await MB.api('lanc_listar', { mes });
    const pv = await carregarPrevisto();
    const futuros = rec.lancamentos.filter((l) => l.status === 'previsto'); // data futura: não entra nos totais
    const passados = rec.lancamentos.filter((l) => l.status !== 'previsto');
    const itensPrev = futuros.map((l) => ({ tipo: l.tipo === 'receita' ? 'receber' : 'pagar', nome: l.descricao, data: l.data, valor: l.valor, colecao: 'lancamentos', id: l.id }));
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">📄 Enviar documento</h3>
        <div class="fraco">Fatura, extrato, comprovante Pix, nota, boleto ou recibo: foto, print ou PDF (até 5 páginas por vez). Extrato do banco também em arquivo .ofx ou .csv (sem senha de banco).</div>
        <input type="file" id="kf-arq" accept="image/*" multiple style="margin-top:10px">
        <button class="btn sec mini" id="kf-pdf" type="button" style="margin-top:6px">📄 Escolher PDF</button>
        <button class="btn sec mini" id="kf-ext-btn" type="button" style="margin-top:6px">🏦 Escolher extrato (.ofx/.csv)</button>
        <input type="file" id="kf-ext" accept=".ofx,.csv" multiple hidden>
        <button class="btn" id="kf-ler" type="button" style="margin-top:10px">Ler documento</button></div>
      <div id="kf-res"></div>
      ${pv ? pv.cartao(itensPrev, 'Previsto (ainda não aconteceu)') : ''}
      <div class="card"><div class="fraco">Lançamentos de ${mes.slice(5)}/${mes.slice(0, 4)} · entradas ${brl(rec.receitas)} · gastos ${brl(rec.despesas)}${rec.a_receber || rec.a_pagar ? ' · a receber ' + brl(rec.a_receber) + ' · a pagar ' + brl(rec.a_pagar) : ''}</div>
        ${passados.map((l) => `<div class="item"><div><div class="n">${esc(l.descricao)}${l.parcela ? ` <span class="fraco">${l.parcela}/${l.parcelas_total || '?'}</span>` : ''}</div><div class="fraco">${l.data.slice(8, 10)}/${l.data.slice(5, 7)} · ${esc(TIPO[l.tipo] || l.tipo)}${l.instituicao ? ' · ' + esc(l.instituicao) : ''}</div></div><div><span class="v ${l.tipo === 'receita' ? 'verde' : ''}">${brl(l.valor)}</span> <button class="btn perigo mini" data-apagar="${esc(l.id)}" type="button" aria-label="Apagar">✕</button></div></div>`).join('') || '<p class="fraco">Nenhum lançamento neste mês ainda.</p>'}</div>`;
    if (pv) pv.ligar(el);
    el.querySelectorAll('[data-apagar]').forEach((b) => { b.onclick = async () => { if (!confirm('Apagar este lançamento?')) return; await MB.api('lanc_apagar', { id: b.dataset.apagar }); MB.abrirAba('documentos'); }; });

    const res = el.querySelector('#kf-res');
    const kfPdf = el.querySelector('#kf-pdf');
    if (kfPdf) kfPdf.onclick = () => { const a = el.querySelector('#kf-arq'); a.accept = 'application/pdf,.pdf'; a.value = ''; a.click(); };
    const kfExt = el.querySelector('#kf-ext'); const kfExtBtn = el.querySelector('#kf-ext-btn');
    if (kfExtBtn && kfExt) {
      kfExtBtn.onclick = () => { kfExt.value = ''; kfExt.click(); };
      kfExt.onchange = () => { if ((kfExt.files || []).length) el.querySelector('#kf-ler').click(); };
    }
    const kfArq = el.querySelector('#kf-arq');
    if (kfArq) kfArq.onchange = (ev) => { const fs = [...((ev && ev.target && ev.target.files) || kfArq.files || [])]; if (fs.length) el.querySelector('#kf-ler').onclick(null, fs); }; // escolher já lê
    el.querySelector('#kf-ler').onclick = async (ev, forcados) => {
      const arqs = forcados || [...el.querySelector('#kf-arq').files, ...((kfExt && kfExt.files) || [])];
      el.querySelector('#kf-arq').accept = 'image/*';
      if (!arqs.length) { res.innerHTML = '<div class="aviso-c">Escolha pelo menos uma foto, print ou PDF.</div>'; return; }
      if (arqs.length > 5) { res.innerHTML = '<div class="aviso-c">Envie no máximo 5 arquivos por vez.</div>'; return; }
      const btn = (ev && ev.currentTarget) || el.querySelector('#kf-ler'); btn.disabled = true; btn.textContent = 'Lendo… pode levar até 2 minutos';
      res.innerHTML = '';
      try {
        // Fase 4 (#4013 / #3953): extrato .ofx/.csv vai como texto, sem passar pelo leitor de PDF/imagem.
        const ehExtrato = (a) => /.(ofx|csv)$/i.test(String(a.name || ''));
        const extratos = arqs.filter(ehExtrato);
        if (extratos.length) {
          if (extratos.length !== arqs.length) throw new Error('Mande o extrato (.ofx/.csv) separado das fotos e PDFs.');
          const junto = { documento: 'extrato', imagens_lidas: 0, imagens_total: extratos.length, prontos: [], conferir: [], ja_lancados: 0, receitas: 0, despesas: 0 };
          for (const a of extratos) {
            const r = await MB.api('extrato_ler', { nome: a.name, conteudo: await a.text() });
            junto.imagens_lidas += 1; junto.prontos.push(...(r.prontos || [])); junto.conferir.push(...(r.conferir || []));
            junto.ja_lancados += r.ja_lancados || 0; junto.receitas += r.receitas || 0; junto.despesas += r.despesas || 0;
          }
          junto.receitas = Math.round(junto.receitas * 100) / 100; junto.despesas = Math.round(junto.despesas * 100) / 100;
          mostrarLeitura(junto);
          if (kfExt) kfExt.value = ''; // não mistura com a próxima leitura
          return;
        }
        const pdf = await carregarPdf();
        const { imagens, cortou } = await pdf.paraImagens(arqs, reduzir);
        const r = await MB.api('doc_ler', { imagens });
        mostrarLeitura(r);
        if (cortou) res.insertAdjacentHTML('afterbegin', '<div class="aviso-c">Li as 5 primeiras páginas. Para o resto, mande de novo só as outras páginas.</div>');
      } catch (e) {
        res.innerHTML = `<div class="aviso-c">${esc(e && e.message || 'Não consegui ler agora.')} Tente de novo com uma foto mais nítida.</div>`;
      } finally { btn.disabled = false; btn.textContent = 'Ler documento'; }
    };

    function mostrarLeitura(r) { mostrarLeituraEm(res, r, { brl, esc, ok }, () => MB.abrirAba('documentos')); }
  };
})();
