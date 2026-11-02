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
    el.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editar(itens.find((x) => x.id === n.dataset.id)); });
  };
})();
