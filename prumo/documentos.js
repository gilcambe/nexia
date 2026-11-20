'use strict';
// Kernex Finance: aba Documentos. Envia fotos/prints, mostra o que a IA leu, deixa corrigir e só então grava.
// Nada duvidoso vira lançamento sem a pessoa confirmar.
(function () {
  const MB = window.MB;
  const carregarPdf = () => MB.pdf ? Promise.resolve(MB.pdf) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/pdf.js'; s.onload = () => ok(MB.pdf); s.onerror = falha; document.body.appendChild(s); });
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const carregarPrevisto = () => Promise.resolve(MB.previsto || null); // previsto.js vem no index.html; sem ele a tela segue sem a parte de previstos
  const CAT = { alimentacao: 'Alimentação', moradia: 'Moradia', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', renda: 'Renda', outros: 'Outros' };
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
      ${(() => { const ds = linhas.map((l) => String(l.data || '').slice(0, 10)).filter((d) => /^\d{4}-/.test(d)).sort(); const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); return `<div class="aviso-c" style="margin-top:8px;background:#14203F;border-color:#2F6BFF;color:var(--texto)">${ds.length ? `Período: ${dm(ds[0])} a ${dm(ds[ds.length - 1])}<br>` : ''}🆕 ${r.prontos.length} novo(s) · 🔁 ${r.ja_lancados || 0} já estavam no app (não entram de novo) · ⚠️ ${r.conferir.length} para conferir</div>`; })()}
      ${r.conferir.length ? `<div class="aviso-c" style="margin-top:10px">⚠️ ${r.conferir.length} item(ns) precisam da sua conferência. Eles NÃO entram na conta até você marcar.</div>` : ''}
      <div id="kf-linhas">${linhas.length ? linhas.map(linha).join('') : '<p class="fraco">Não encontrei lançamentos neste documento.</p>'}</div>
      ${linhas.length ? '<button class="btn" id="kf-grava" type="button" style="margin-top:12px">Confirmar e gravar marcados</button>' : ''}</div>`;
    // Dono 19-20/11: a fatura lida vira conta a pagar no vencimento (total da fatura), não só as compras.
    // Dono 20/11: duas faturas (dois cartões) numa leitura; o servidor já grava cada uma que tem vencimento.
    const fats = Array.isArray(r.faturas) ? r.faturas : [];
    if (fats.length) {
      // Sem vencimento lido: a pessoa digita a data aqui mesmo e grava (dono 20/11: "cadastrei, mas aparece zerado").
      res.insertAdjacentHTML('afterbegin', `<div class="card" id="kf-fat-total" style="border-color:#2F6BFF">${fats.map((x, i) => { const d = x.vencimento ? x.vencimento.slice(8, 10) + '/' + x.vencimento.slice(5, 7) : ''; return x.gravada ? `<div><b>✅ Fatura ${esc(x.instituicao || '')}: ${brl(x.total)}, vence ${d}.</b></div>` : `<div data-fi="${i}" style="margin:6px 0"><b>💳 Fatura ${esc(x.instituicao || '')}: ${brl(x.total)}</b><div class="fraco">Não li o vencimento. Qual o dia?</div><input type="date" data-fv style="margin:4px 0"> <button class="btn" type="button" data-fg>Gravar no A pagar</button></div>`; }).join('')}<div class="fraco">A fatura entra no A pagar e no mês do vencimento. Confira as compras abaixo.</div></div>`);
      res.querySelectorAll('[data-fi]').forEach((box) => { box.querySelector('[data-fg]').onclick = async (ev) => {
        const x = fats[Number(box.dataset.fi)]; const v = box.querySelector('[data-fv]').value;
        if (!v) { ok('Escolha o dia do vencimento.'); return; }
        ev.currentTarget.disabled = true;
        try { await MB.api('fatura_gravar', { nome: x.instituicao || 'Cartão', valor: x.total, vencimento: v }); box.innerHTML = `<b>✅ Fatura ${esc(x.instituicao || '')}: ${brl(x.total)}, vence ${v.slice(8, 10)}/${v.slice(5, 7)}.</b>`; } catch { ev.currentTarget.disabled = false; }
      }; });
    } else if (r.fatura && r.fatura.total > 0) {
      const fv = r.fatura; const dmv = fv.vencimento ? fv.vencimento.slice(8, 10) + '/' + fv.vencimento.slice(5, 7) : '';
      res.insertAdjacentHTML('afterbegin', `<div class="card" id="kf-fat-total" style="border-color:#2F6BFF"><b>💳 Fatura ${esc(fv.instituicao || '')}: ${brl(fv.total)}${dmv ? ', vence ' + dmv : ''}</b><div class="fraco">Grave o total para ele aparecer no "A pagar" e em "Próximos meses".</div><button class="btn" type="button" id="kf-fat-gravar" style="margin-top:8px">Gravar a fatura no A pagar</button></div>`);
      res.querySelector('#kf-fat-gravar').onclick = async (ev) => { // grava direto (o formulário recarregaria a tela e perderia a lista de compras)
        if (!fv.vencimento) { ok('Não li o vencimento: use "Lançar fatura" na aba Mês.'); return; }
        const bt = ev.currentTarget; bt.disabled = true;
        try { await MB.api('fatura_gravar', { nome: fv.instituicao || 'Cartão', valor: fv.total, vencimento: fv.vencimento }); const c = res.querySelector('#kf-fat-total'); if (c) c.innerHTML = `<b>✅ Fatura de ${brl(fv.total)} gravada no A pagar (vence ${dmv}).</b><div class="fraco">Agora confira as compras abaixo.</div>`; } catch { bt.disabled = false; }
      };
    }
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
        <input type="file" id="kf-arq" accept="image/*" multiple hidden>
        <button class="btn" id="kf-foto" type="button" style="margin-top:10px">📷 Print ou foto</button>
        <button class="btn sec" id="kf-pdf" type="button" style="margin-top:6px">📄 PDF</button>
        <button class="btn sec" id="kf-ext-btn" type="button" style="margin-top:6px">🏦 Extrato do banco em arquivo (.ofx/.csv)</button>
        <input type="file" id="kf-ext" accept=".ofx,.csv" multiple hidden>
        <div class="fraco" style="margin-top:6px">Escolheu o arquivo, eu já começo a ler. Depois você confere e grava.</div>
        <button class="btn sec mini" id="kf-ler" type="button" style="margin-top:6px" hidden>Ler de novo</button></div>
      <div id="kf-res"></div>
      ${pv ? pv.cartao(itensPrev, 'Previsto (ainda não aconteceu)') : ''}
      <div class="card"><div class="fraco">Lançamentos de ${mes.slice(5)}/${mes.slice(0, 4)} · entradas ${brl(rec.receitas)} · gastos ${brl(rec.despesas)}${rec.a_receber || rec.a_pagar ? ' · a receber ' + brl(rec.a_receber) + ' · a pagar ' + brl(rec.a_pagar) : ''}</div>
        ${passados.map((l) => `<div class="item"><div><div class="n">${esc(l.descricao)}${l.parcela ? ` <span class="fraco">${l.parcela}/${l.parcelas_total || '?'}</span>` : ''}</div><div class="fraco">${l.data.slice(8, 10)}/${l.data.slice(5, 7)} · ${esc(TIPO[l.tipo] || l.tipo)}${l.instituicao ? ' · ' + esc(l.instituicao) : ''}</div></div><div><span class="v ${l.tipo === 'receita' ? 'verde' : ''}">${brl(l.valor)}</span> <button class="btn sec mini" data-editar="${esc(l.id)}" type="button" aria-label="Editar">✏️</button> <button class="btn perigo mini" data-apagar="${esc(l.id)}" type="button" aria-label="Apagar">✕</button></div></div>`).join('') || '<p class="fraco">Nenhum lançamento neste mês ainda.</p>'}</div>`;
    if (pv) pv.ligar(el);
    // Dono 19/11: editar qualquer lançamento (o formulário também tem Apagar).
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => {
      const l = rec.lancamentos.find((x) => x.id === b.dataset.editar); if (!l) return;
      MB.ui.formulario('Editar lançamento', [
        { nome: 'descricao', rotulo: 'Descrição', valor: l.descricao },
        { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', valor: l.valor },
        { nome: 'data', rotulo: 'Data', tipo: 'date', valor: l.data },
        { nome: 'tipo', rotulo: 'Tipo', opcoes: Object.entries(TIPO).map(([k, v]) => `<option value="${k}"${k === l.tipo ? ' selected' : ''}>${esc(v)}</option>`).join('') },
        { nome: 'categoria', rotulo: 'Categoria (eu aprendo e uso nas próximas vezes)', opcoes: Object.entries(CAT).map(([k, v]) => `<option value="${k}"${k === l.categoria ? ' selected' : ''}>${esc(v)}</option>`).join('') },
      ], (d) => MB.api('lanc_editar', { id: l.id, ...d, valor: Number(d.valor) }).then(() => ok('✅ Lançamento salvo.')), () => MB.api('lanc_apagar', { id: l.id }));
    }; });
    el.querySelectorAll('[data-apagar]').forEach((b) => { b.onclick = async () => { if (!confirm('Apagar este lançamento?')) return; await MB.api('lanc_apagar', { id: b.dataset.apagar }); MB.abrirAba('documentos'); }; });

    const res = el.querySelector('#kf-res');
    const kfPdf = el.querySelector('#kf-pdf');
    const kfFoto = el.querySelector('#kf-foto');
    if (kfFoto) kfFoto.onclick = () => { const a = el.querySelector('#kf-arq'); a.accept = 'image/*'; a.value = ''; a.click(); };
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
      res.innerHTML = '<div class="aviso-c">⏳ Lendo seu documento… pode levar até 2 minutos. Não feche a tela.</div>';
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
      } finally { btn.disabled = false; btn.textContent = 'Ler de novo'; btn.hidden = false; }
    };

    function mostrarLeitura(r) { mostrarLeituraEm(res, r, { brl, esc, ok }, () => MB.abrirAba('documentos')); }
  };
})();
