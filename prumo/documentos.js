'use strict';
// Kernex Finance: aba Documentos. Envia fotos/prints, mostra o que a IA leu, deixa corrigir e só então grava.
// Nada duvidoso vira lançamento sem a pessoa confirmar.
(function () {
  const MB = window.MB;
  const carregarPdf = () => MB.pdf ? Promise.resolve(MB.pdf) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/pdf.js'; s.onload = () => ok(MB.pdf); s.onerror = falha; document.body.appendChild(s); });
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const TIPO = { despesa: 'Gasto', receita: 'Entrada', transferencia_propria: 'Transferência própria', pagamento_fatura: 'Pagamento de fatura' };
  const DOC = { fatura: 'Fatura de cartão', extrato: 'Extrato', comprovante: 'Comprovante', nota: 'Nota fiscal', boleto: 'Boleto', recibo: 'Recibo', conta: 'Conta de consumo', corretora: 'Extrato de corretora', milhas: 'Extrato de milhas', outro: 'Documento' };

  MB.telas.documentos = async (el) => {
    const { brl, esc, reduzir, ok, aba } = await carregarUi();
    aba('documentos');
    const hoje = new Date();
    const mes = hoje.toISOString().slice(0, 7);
    const rec = await MB.api('lanc_listar', { mes });
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">📄 Enviar documento</h3>
        <div class="fraco">Fatura, extrato, comprovante Pix, nota, boleto ou recibo: foto, print ou PDF (até 5 páginas por vez).</div>
        <input type="file" id="kf-arq" accept="image/*,application/pdf,.pdf" multiple style="margin-top:10px">
        <button class="btn" id="kf-ler" type="button" style="margin-top:10px">Ler documento</button></div>
      <div id="kf-res"></div>
      <div class="card"><div class="fraco">Lançamentos de ${mes.slice(5)}/${mes.slice(0, 4)} · entradas ${brl(rec.receitas)} · gastos ${brl(rec.despesas)}</div>
        ${rec.lancamentos.map((l) => `<div class="item"><div><div class="n">${esc(l.descricao)}${l.parcela ? ` <span class="fraco">${l.parcela}/${l.parcelas_total || '?'}</span>` : ''}</div><div class="fraco">${l.data.slice(8, 10)}/${l.data.slice(5, 7)} · ${esc(TIPO[l.tipo] || l.tipo)}${l.instituicao ? ' · ' + esc(l.instituicao) : ''}</div></div><div><span class="v ${l.tipo === 'receita' ? 'verde' : ''}">${brl(l.valor)}</span> <button class="btn perigo mini" data-apagar="${esc(l.id)}" type="button" aria-label="Apagar">✕</button></div></div>`).join('') || '<p class="fraco">Nenhum lançamento neste mês ainda.</p>'}</div>`;
    el.querySelectorAll('[data-apagar]').forEach((b) => { b.onclick = async () => { if (!confirm('Apagar este lançamento?')) return; await MB.api('lanc_apagar', { id: b.dataset.apagar }); MB.abrirAba('documentos'); }; });

    const res = el.querySelector('#kf-res');
    el.querySelector('#kf-ler').onclick = async (ev) => {
      const arqs = [...el.querySelector('#kf-arq').files];
      if (!arqs.length) { res.innerHTML = '<div class="aviso-c">Escolha pelo menos uma foto, print ou PDF.</div>'; return; }
      if (arqs.length > 5) { res.innerHTML = '<div class="aviso-c">Envie no máximo 5 arquivos por vez.</div>'; return; }
      const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Lendo… pode levar até 2 minutos';
      res.innerHTML = '';
      try {
        const pdf = await carregarPdf();
        const { imagens, cortou } = await pdf.paraImagens(arqs, reduzir);
        const r = await MB.api('doc_ler', { imagens });
        mostrarLeitura(r);
        if (cortou) res.insertAdjacentHTML('afterbegin', '<div class="aviso-c">Li as 5 primeiras páginas. Para o resto, mande de novo só as outras páginas.</div>');
      } catch (e) {
        res.innerHTML = `<div class="aviso-c">${esc(e && e.message || 'Não consegui ler agora.')} Tente de novo com uma foto mais nítida.</div>`;
      } finally { btn.disabled = false; btn.textContent = 'Ler documento'; }
    };

    function mostrarLeitura(r) {
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
          MB.abrirAba('documentos');
        } catch { g.disabled = false; }
      };
    }
  };
})();
