'use strict';
// Kernex Finance: aba Impostos. Pasta anual e relatório (CSV) para o contador. Não transmite declaração.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.impostos = async (el) => {
    const { brl, esc, aba } = await carregarUi();
    aba('impostos');
    const anoAtual = new Date().getFullYear();
    let ano = String(anoAtual); let perfil = 'pf';
    const desenhar = async () => {
      const r = await MB.api('imp_pasta', { ano, perfil });
      el.innerHTML = `
        <div class="card"><h3 style="margin:0 0 6px">🗂️ Pasta do ano</h3>
          <label>Ano</label><select id="im-ano">${[0, 1, 2, 3].map((i) => `<option value="${anoAtual - i}"${String(anoAtual - i) === ano ? ' selected' : ''}>${anoAtual - i}</option>`).join('')}</select>
          <label>Quem</label><select id="im-perfil"><option value="pf"${perfil === 'pf' ? ' selected' : ''}>Pessoa física</option><option value="pj"${perfil === 'pj' ? ' selected' : ''}>Empresa (PJ)</option></select>
          <div class="fraco" style="margin-top:8px">${r.qtd} lançamento(s) · receitas ${brl(r.receitas)} · despesas ${brl(r.despesas)}</div>
          ${r.lacunas.map((l) => `<div class="fraco">ℹ️ ${esc(l)}</div>`).join('')}</div>
        <div class="card"><h3 style="margin:0 0 6px">Por mês</h3>${r.por_mes.map((m) => `<div class="item"><div><div class="n">${esc(m.mes)}</div><div class="fraco">${m.documentos} lançamento(s)</div></div><div class="v">${brl(m.receitas - m.despesas)}</div></div>`).join('') || '<div class="fraco">Nada neste ano.</div>'}</div>
        <div class="card"><h3 style="margin:0 0 6px">Para o contador olhar</h3>${r.candidatos_dedutiveis.map((c) => `<div class="item"><div><div class="n">${esc(c.nome)}</div><div class="fraco">${c.itens} lançamento(s). Pode ou não ser dedutível: o contador decide.</div></div><div class="v">${brl(c.total)}</div></div>`).join('')}
          <button class="btn" id="im-csv" type="button" style="margin-top:8px">⬇️ Baixar relatório (CSV)</button></div>
        <div class="fraco" style="margin:8px 0">${esc(r.aviso)}</div>`;
      el.querySelector('#im-ano').onchange = (e) => { ano = e.target.value; desenhar(); };
      el.querySelector('#im-perfil').onchange = (e) => { perfil = e.target.value; desenhar(); };
      el.querySelector('#im-csv').onclick = async () => {
        const rel = await MB.api('imp_relatorio', { ano, perfil });
        const blob = new Blob(['﻿' + rel.csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = rel.nome_arquivo; document.body.appendChild(a); a.click(); a.remove();
      };
    };
    await desenhar();
  };
})();
