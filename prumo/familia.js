'use strict';
// Kernex Finance: aba Família. Grupo familiar (cada pessoa escolhe o que compartilha; nada por padrão)
// e módulo autônomo (pessoa física × jurídica separadas).
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.familia = async (el) => {
    const { brl, esc, formulario, aba } = await carregarUi();
    aba('familia');
    const [est, au] = await Promise.all([MB.api('familia_estado'), MB.api('autonomo_resumo', {})]);
    const ver = est.em_familia ? await MB.api('familia_ver') : null;
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">👨‍👩‍👧 Grupo familiar</h3>
        ${!est.em_familia ? `<div class="fraco">Você não está em nenhum grupo. Ninguém vê nada seu até você escolher compartilhar.</div>
          <button class="btn" id="fam-criar" type="button" style="margin-top:8px">Criar grupo</button>
          <button class="btn sec" id="fam-entrar" type="button" style="margin-top:8px">Entrar com código</button>`
        : `<div class="n">${esc(est.nome)}</div><div class="fraco">${est.membros} pessoa(s) no grupo · você é ${esc(est.papel)}</div>
          <div class="fraco" style="margin-top:8px"><b>O que você compartilha com o grupo:</b></div>
          ${Object.entries(est.secoes_disponiveis).map(([k, rot]) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-sec="${esc(k)}" ${est.compartilhando.includes(k) ? 'checked' : ''}> ${esc(rot)}</label>`).join('')}
          ${est.papel === 'dono' ? '<button class="btn sec" id="fam-convidar" type="button" style="margin-top:8px">Gerar código de convite</button><div id="fam-cod"></div>' : ''}
          <button class="btn sec" id="fam-sair" type="button" style="margin-top:8px">Sair do grupo</button>`}</div>
      ${ver ? `<div class="card"><h3 style="margin:0 0 6px">O que a família compartilhou com você</h3>${ver.membros.map((m) => `<div class="item"><div><div class="n">${esc(m.rotulo)}</div><div class="fraco">${m.dados ? [m.dados.resumo_mes ? `Mês: receitas ${brl(m.dados.resumo_mes.receitas)}, despesas ${brl(m.dados.resumo_mes.despesas)}` : '', m.dados.patrimonio ? `Patrimônio ${brl(m.dados.patrimonio.liquido)}` : '', m.dados.dividas ? `Dívidas ${brl(m.dados.dividas.total)}` : '', m.dados.metas ? `${m.dados.metas.length} objetivo(s)` : ''].filter(Boolean).map(esc).join(' · ') : esc(m.nota)}</div></div></div>`).join('') || '<div class="fraco">Só você no grupo por enquanto.</div>'}</div>` : ''}
      <div class="card"><h3 style="margin:0 0 6px">🧾 Autônomo (${esc(au.mes)})</h3>
        <div class="fraco">Pessoa física e empresa ficam separadas.</div>
        <div class="item"><div><div class="n">Empresa (PJ)</div><div class="fraco">Receitas ${brl(au.pj.receitas)} · despesas ${brl(au.pj.despesas)}</div></div><div class="v">${brl(au.pj.lucro)}</div></div>
        <div class="item"><div><div class="n">Pessoal (PF)</div><div class="fraco">Receitas ${brl(au.pf.receitas)} · despesas ${brl(au.pf.despesas)}</div></div><div class="v">${brl(au.pf.economia)}</div></div>
        <label>Alíquota do seu regime (%) para estimar o imposto</label><input id="au-al" type="number" step="0.01" inputmode="decimal" placeholder="ex.: 6">
        <button class="btn" id="au-ir" type="button" style="margin-top:8px">Estimar imposto</button><div id="au-res"></div>
        <div class="fraco" style="margin-top:6px">${esc(au.aviso)}</div>
        <div class="fraco">Para marcar um lançamento como da empresa, use a opção "pj" ao confirmar o documento ou peça ao assistente.</div></div>`;
    const acao = (nome, o) => async () => { try { await MB.api(nome, o || {}); MB.abrirAba('familia'); } catch (e) { alert(e.message || 'Não consegui.'); } };
    const criar = el.querySelector('#fam-criar'); if (criar) criar.onclick = () => formulario('Nome do grupo', [{ nome: 'nome', rotulo: 'Nome (ex.: Casa)' }], async (f) => { await MB.api('familia_criar', { nome: f.nome }); }, null);
    const entrar = el.querySelector('#fam-entrar'); if (entrar) entrar.onclick = () => formulario('Código do convite', [{ nome: 'codigo', rotulo: 'Código' }], async (f) => { await MB.api('familia_entrar', { codigo: f.codigo }); }, null);
    const sair = el.querySelector('#fam-sair'); if (sair) sair.onclick = () => { if (confirm('Sair do grupo? Você deixa de compartilhar tudo.')) acao('familia_sair')(); };
    const conv = el.querySelector('#fam-convidar'); if (conv) conv.onclick = async () => { const r = await MB.api('familia_convidar'); el.querySelector('#fam-cod').innerHTML = `<div class="card" style="margin-top:8px"><div class="grande">${esc(r.codigo)}</div><div class="fraco">${esc(r.aviso)}</div></div>`; };
    el.querySelectorAll('[data-sec]').forEach((cb) => { cb.onchange = async () => { const marcados = [...el.querySelectorAll('[data-sec]')].filter((x) => x.checked).map((x) => x.dataset.sec); await MB.api('familia_compartilhar', { secoes: marcados }); }; });
    el.querySelector('#au-ir').onclick = async () => {
      const res = el.querySelector('#au-res');
      try { const r = await MB.api('autonomo_resumo', { aliquota_pct: el.querySelector('#au-al').value }); res.innerHTML = `<div class="fraco" style="margin-top:6px">${r.pj.imposto_estimado === null ? '' : 'Imposto estimado: <b>' + brl(r.pj.imposto_estimado) + '</b>. '}${esc(r.nota_imposto)}</div>`; }
      catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui estimar.')}</div>`; }
    };
  };
})();
