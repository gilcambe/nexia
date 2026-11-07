'use strict';
// Prumo: aba Milhas (pontos de cartão e milhas). Usa window.MB e /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };

  MB.telas.pontos = async (el) => {
    await iniciar('pontos');
    const [{ itens, total_estimado, vencendo }, { cartoes }] = await Promise.all([MB.api('pontos_listar'), MB.api('cartao_listar')]);
    const nomeC = Object.fromEntries(cartoes.map((c) => [c.id, c.nome]));
    const dataBr = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';
    el.innerHTML = `
      ${vencendo.map((v) => `<div class="aviso-c">✈️ ${v.saldo.toLocaleString('pt-BR')} pontos da ${esc(v.programa)} vencem em ${v.dias} dia(s) (${dataBr(v.validade)}).</div>`).join('')}
      <div class="card"><div class="fraco">Valor estimado dos seus pontos</div><div class="grande">${brl(total_estimado)}</div>
        <p class="fraco">Estimativa pelo valor do milheiro que você informar (padrão R$ 20 por 1.000 pontos).</p></div>
      <button class="btn" id="novo" style="margin-bottom:12px">+ Programa de pontos</button>
      <div class="card">${itens.map((p) => { const venc = vencendo.find((v) => v.id === p.id); return `<div class="item" data-id="${p.id}"><div><div class="n">${esc(p.programa)}</div><div class="fraco">${p.cartao_id && nomeC[p.cartao_id] ? esc(nomeC[p.cartao_id]) + ' · ' : ''}${p.validade ? `<span style="${venc ? 'color:var(--perigo)' : ''}">vence ${dataBr(p.validade)}</span>` : 'sem validade informada'}</div></div><div class="v">${p.saldo.toLocaleString('pt-BR')} pts</div></div>`; }).join('') || '<p class="fraco">Cadastre Livelo, Smiles, LATAM Pass, TudoAzul, Esfera…</p>'}</div>`;
    const editar = (p) => formulario(p ? 'Editar pontos' : 'Novo programa', [
      { nome: 'programa', rotulo: 'Programa (ex.: Livelo)', valor: p && p.programa },
      { nome: 'saldo', rotulo: 'Saldo de pontos', tipo: 'number', valor: p && p.saldo },
      { nome: 'validade', rotulo: 'Validade dos pontos mais antigos', tipo: 'date', valor: p && p.validade },
      { nome: 'cartao_id', rotulo: 'Cartão que gera os pontos', opcoes: '<option value="">Nenhum</option>' + cartoes.map((c) => `<option value="${c.id}"${p && p.cartao_id === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('') },
      { nome: 'valor_milheiro', rotulo: 'Quanto vale 1.000 pontos (R$)', tipo: 'number', valor: p ? p.valor_milheiro : 20 },
    ], (d) => MB.api('pontos_salvar', { ...d, saldo: Math.round(Number(d.saldo) || 0), id: p && p.id }), p && (() => MB.api('pontos_apagar', { id: p.id })));
    el.querySelector('#novo').onclick = () => editar(null);
    const mv = await MB.api('milhas_visao');
    const pctB = (n) => String(n).replace('.', ',');
    el.insertAdjacentHTML('beforeend', `
      <div class="card"><h3 style="margin:0 0 6px">📊 Custo e valor por milheiro</h3>${mv.programas.map((x) => `<div class="item"><div><div class="n">${esc(x.programa)}</div><div class="fraco">${x.custo_milheiro !== null ? 'Custo médio pago: ' + brl(x.custo_milheiro) + ' o milheiro' : 'Sem compras registradas'}${x.a_vencer_30d ? ` · <b class="verm">${x.a_vencer_30d.toLocaleString('pt-BR')} vencem em até 30 dias</b>` : ''}</div></div><div class="v">${brl(x.valor_estimado)}</div></div>`).join('') || '<div class="fraco">Cadastre um programa acima.</div>'}
        ${mv.lacunas.map((l) => `<div class="fraco">ℹ️ ${esc(l)}</div>`).join('')}
        <button class="btn sec" id="nova-compra" type="button" style="margin-top:8px">+ Compra de milhas</button></div>
      <div class="card"><h3 style="margin:0 0 6px">✈️ O resgate compensa?</h3>
        <label>Programa</label><input id="rg-prog" placeholder="Smiles">
        <label>Milhas pedidas</label><input id="rg-mi" type="number" inputmode="numeric">
        <label>Preço da passagem em dinheiro (R$)</label><input id="rg-pr" type="number" step="0.01" inputmode="decimal">
        <label>Taxas pagas no resgate (R$)</label><input id="rg-tx" type="number" step="0.01" inputmode="decimal" placeholder="0">
        <button class="btn" id="rg-ir" type="button" style="margin-top:10px">Calcular</button><div id="rg-res"></div></div>
      <div class="card"><h3 style="margin:0 0 6px">💳 Qual cartão rende mais?</h3>
        <label>Gasto por mês no cartão (R$)</label><input id="ci-g" type="number" step="0.01" inputmode="decimal">
        <button class="btn" id="ci-ir" type="button" style="margin-top:10px">Comparar</button><div id="ci-res"></div></div>
      <div class="card"><h3 style="margin:0 0 6px">🏷️ Promoções (que você registrou, com fonte)</h3>${mv.promocoes.map((x) => `<div class="item"><div><div class="n">${esc(x.titulo)}</div><div class="fraco">até ${dataBr(x.validade)} · fonte: ${esc(x.fonte)}${x.bonus_pct ? ' · bônus ' + pctB(x.bonus_pct) + '%' : ''}</div></div></div>`).join('') || '<div class="fraco">Nenhuma promoção vigente. Eu não invento promoções: registre uma com a fonte.</div>'}
        <button class="btn sec" id="nova-promo" type="button" style="margin-top:8px">+ Promoção</button></div>
      <div class="fraco" style="margin:8px 0">${esc(mv.aviso)}</div>`);
    el.querySelector('#nova-compra').onclick = () => formulario('Compra de milhas', [
      { nome: 'programa', rotulo: 'Programa' }, { nome: 'milhas', rotulo: 'Milhas compradas', tipo: 'number' }, { nome: 'preco', rotulo: 'Quanto você pagou (R$)', tipo: 'number' }, { nome: 'data', rotulo: 'Data (AAAA-MM-DD, opcional)' },
    ], async (f) => { const o = { programa: f.programa, milhas: Number(f.milhas), preco: Number(f.preco) }; if (f.data) o.data = f.data; await MB.api('milhas_compra_salvar', o); MB.ui.ok('Compra salva.'); }, null);
    el.querySelector('#nova-promo').onclick = () => formulario('Nova promoção', [
      { nome: 'titulo', rotulo: 'Promoção' }, { nome: 'programa', rotulo: 'Programa (opcional)' }, { nome: 'fonte', rotulo: 'Fonte (site, e-mail)' }, { nome: 'validade', rotulo: 'Vale até (AAAA-MM-DD)' }, { nome: 'bonus_pct', rotulo: 'Bônus % (opcional)', tipo: 'number' },
    ], async (f) => { const o = { ...f }; if (f.bonus_pct === '') delete o.bonus_pct; await MB.api('milhas_promo_salvar', o); MB.ui.ok('Promoção salva.'); }, null);
    el.querySelector('#rg-ir').onclick = async () => {
      const res = el.querySelector('#rg-res');
      try {
        const r = await MB.api('milhas_resgate', { programa: el.querySelector('#rg-prog').value, milhas: el.querySelector('#rg-mi').value, preco_dinheiro: el.querySelector('#rg-pr').value, taxas: el.querySelector('#rg-tx').value });
        res.innerHTML = `<div class="card" style="margin-top:8px"><div class="n">Você usa cada milheiro a ${brl(r.valor_milheiro_resgate)}</div><div class="fraco">${r.compensa === null ? 'Não tenho com o que comparar: registre compras ou o valor do milheiro do programa.' : (r.compensa ? '✅ Compensa' : '🔴 Não compensa') + ` (referência: ${brl(r.referencia)}, ${esc(r.referencia_tipo)})`}</div><div class="fraco">${esc(r.aviso)}</div></div>`;
      } catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui calcular.')}</div>`; }
    };
    el.querySelector('#ci-ir').onclick = async () => {
      const res = el.querySelector('#ci-res');
      try {
        const r = await MB.api('milhas_cartao_ideal', { gasto_mensal: el.querySelector('#ci-g').value });
        res.innerHTML = `<div style="margin-top:8px">${r.ranking.map((x, i) => `<div class="item"><div><div class="n">${i === 0 ? '⭐ ' : ''}${esc(x.nome)}</div><div class="fraco">retorno ${pctB(x.retorno_pct)}%${x.parcial ? ' (parcial: falta o valor do milheiro)' : ''} · anuidade ${brl(x.anuidade)}</div></div><div class="v">${brl(x.liquido_anual)}/ano</div></div>`).join('') || '<div class="fraco">Nenhum cartão com pontos por real ou cashback cadastrados.</div>'}${r.sem_dados.map((x) => `<div class="fraco">${esc(x.nome)}: falta ${esc(x.falta)}.</div>`).join('')}</div>`;
      } catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui comparar.')}</div>`; }
    };
    el.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editar(itens.find((x) => x.id === n.dataset.id)); });
  };
})();
