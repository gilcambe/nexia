'use strict';
// Kernex Finance: aba Viagens. Dinheiro x milhas, alerta "dá para emitir" e links oficiais de busca.
(function () {
  const MB = window.MB;
  const carregarScript = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.viagens = async (el) => {
    const { brl, esc, formulario } = await carregarScript('ui', '/prumo/ui.js');
    MB.ui.aba('viagens');
    const mm = await carregarScript('milhas', '/prumo/milhas.js');
    const [{ viagens }, { itens }] = await Promise.all([MB.api('viagem_listar'), MB.api('pontos_listar')]);
    const dataBr = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';
    const milh = (n) => Number(n).toLocaleString('pt-BR');
    const cartao = (v) => {
      const a = mm.analisarViagem(v, itens);
      return `<div class="card" data-viagem="${esc(v.id)}"><div class="n">${esc(v.origem)} → ${esc(v.destino)}</div>
        <div class="fraco">${dataBr(v.data_ida)}${v.data_volta ? ' a ' + dataBr(v.data_volta) : ''}${v.programa ? ' · ' + esc(v.programa) : ''}</div>
        <div class="fraco">Dinheiro: ${brl(v.preco_dinheiro)} · Milhas: ${milh(v.milhas)} + taxas ${brl(v.taxas)}</div>
        <div class="n" style="margin-top:6px">${a.compensa ? '✅ Compensa usar milhas' : '🔴 Compensa pagar em dinheiro'}</div>
        <div class="fraco">As milhas valem ${brl(a.custo_milhas)} (milheiro de ${brl(a.referencia)}, ${esc(a.referencia_origem)}) + taxas = ${brl(a.custo_total_milhas)}. ${a.compensa ? 'Economia' : 'Diferença a favor do dinheiro'}: <b>${brl(Math.abs(a.economia))}</b>. Estimativa.</div>
        <div class="${a.emitir ? '' : 'fraco'}" style="margin-top:6px">${a.emitir ? '✈️ ' : '⏳ '}${esc(a.aviso_emitir)}</div>
        <div class="linha" style="flex-wrap:wrap;gap:6px;margin-top:8px">${mm.linksViagem(v).map((l) => `<a class="btn sec mini" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.nome)}</a>`).join('')}</div>
        <button class="btn perigo mini" data-editar="${esc(v.id)}" type="button" style="margin-top:8px">Editar / apagar</button></div>`;
    };
    el.innerHTML = `<button class="btn" id="vg-novo" type="button" style="margin-bottom:12px">+ Viagem desejada</button>
      ${viagens.map(cartao).join('') || '<div class="card"><p class="fraco">Cadastre uma viagem com o preço em dinheiro e as milhas que você viu. Eu digo o que compensa e se você já tem milhas para emitir.</p></div>'}
      <div class="fraco">Os links abrem só sites oficiais. Preços e milhas mudam: confira no site antes de decidir. Não é recomendação financeira.</div>`;
    const campos = (v) => [
      { nome: 'origem', rotulo: 'Saindo de (cidade ou aeroporto)', valor: v && v.origem },
      { nome: 'destino', rotulo: 'Indo para', valor: v && v.destino },
      { nome: 'data_ida', rotulo: 'Data de ida', tipo: 'date', valor: v && v.data_ida },
      { nome: 'data_volta', rotulo: 'Data de volta (opcional)', tipo: 'date', valor: v && v.data_volta },
      { nome: 'programa', rotulo: 'Programa das milhas (Smiles, LATAM Pass, Azul Fidelidade…)', valor: v && v.programa },
      { nome: 'preco_dinheiro', rotulo: 'Preço em dinheiro que você viu (R$)', tipo: 'number', valor: v && v.preco_dinheiro },
      { nome: 'milhas', rotulo: 'Milhas pedidas', tipo: 'number', valor: v && v.milhas },
      { nome: 'taxas', rotulo: 'Taxas em dinheiro no resgate (R$)', tipo: 'number', valor: v ? v.taxas : 0 },
    ];
    const abrir = (v) => formulario(v ? 'Editar viagem' : 'Nova viagem', campos(v),
      (d) => MB.api('viagem_salvar', { ...d, id: v && v.id, preco_dinheiro: Number(d.preco_dinheiro), milhas: Math.round(Number(d.milhas)), taxas: Number(d.taxas) || 0 }),
      v && (() => MB.api('viagem_apagar', { id: v.id })));
    el.querySelector('#vg-novo').onclick = () => abrir(null);
    el.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => abrir(viagens.find((x) => x.id === b.dataset.editar)); });
  };
})();
