'use strict';
// Redesign: aba Benefícios (plano, tela 7). Quanto valem seus pontos (milheiro editável), o que vence em 30/60/90 dias,
// os programas e os cartões com anuidade e pontos por real. Nunca pede senha de programa.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  const dmy = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : 'sem vencimento');
  const COR = { 30: '#FF5A5F', 60: '#F5A623', 90: '#5B8DFF' };
  MB.telas.beneficios = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('beneficios');
    const r = await MB.api('beneficios_resumo');
    const n = (v) => Number(v || 0).toLocaleString('pt-BR');
    el.innerHTML = `<div class="kh">
      <section class="card kh-larga" style="background:linear-gradient(140deg,#17255A 0%,#121B33 65%)"><div class="sub">Seus pontos valem cerca de</div>
        <div style="font-size:32px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums">${r.valor_estimado > 0 ? H.brl(r.valor_estimado) : '<span class="kh-zero">—</span>'}</div>
        <div class="sub">${n(r.total_pontos)} pontos · estimativa com o milheiro que você define</div>
        ${r.vencendo.length ? r.vencendo.slice(0, 3).map((p) => `<div class="kh-ag"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COR[p.faixa]};margin-right:6px"></span>${n(p.saldo)} pts ${H.esc(p.programa)} vencem em ${p.dias} dia(s)</span></div>`).join('') + '<div class="sub" style="margin-top:6px">Use, transfira ou resgate antes de vencer.</div>' : ''}
      </section>
      <section class="card"><b>✈️ Programas</b>${r.programas.length ? r.programas.map((p) => `<div class="kh-ag"><span>${H.esc(p.programa)}<br><span class="sub">${p.validade ? 'vence ' + dmy(p.validade) : 'sem vencimento'} · milheiro ${H.brl(p.valor_milheiro)}</span></span><span style="text-align:right"><b>${n(p.saldo)}</b><br><span class="sub">${H.brl(p.valor)}</span> <button class="btn sec mini" type="button" data-mil="${H.esc(p.id)}" aria-label="Editar">✏️</button></span></div>`).join('')
        : '<p class="sub" style="margin:6px 0 0">Nenhum programa ainda. Mande o print do app (Smiles, Latam Pass, Livelo, pontos do cartão).</p>'}
        <button class="btn sec" type="button" data-ir="pontos">Ver milhas e pontos</button></section>
      <section class="card"><b>💳 Cartões e benefícios</b>${r.cartoes.length ? r.cartoes.map((k) => `<div class="kh-ag"><span>${H.esc(k.nome)}<br><span class="sub">${k.pontos_por_real ? String(k.pontos_por_real).replace('.', ',') + ' pt por real' : 'pontos por real não informado'}${k.cashback_pct ? ' · cashback ' + String(k.cashback_pct).replace('.', ',') + '%' : ''}</span></span><span class="${k.anuidade > 0 ? 'kh-out' : 'kh-zero'}">${k.anuidade > 0 ? 'anuidade ' + H.brl(k.anuidade) : 'sem anuidade'}</span></div>`).join('')
        : '<p class="sub" style="margin:6px 0 0">Nenhum cartão cadastrado.</p>'}
        <button class="btn sec" type="button" data-ir="cartoes">Ver cartões</button></section>
      ${H.lista([
        ['viagens', '🧳', 'Viagens', 'Planejar com milhas'],
        ['economizar', '💡', 'Economizar', 'Onde dá para gastar menos'],
        ['impostos', '🧾', 'Impostos', 'IR, IPVA, IPTU'],
      ])}
      <p class="sub kh-larga" style="text-align:center">${H.esc(r.aviso)}</p>
    </div>`;
    H.ligar(el);
    el.querySelectorAll('[data-mil]').forEach((b) => { b.onclick = () => {
      const p = r.programas.find((x) => x.id === b.dataset.mil);
      U.formulario('Editar ' + p.programa, [{ nome: 'saldo', rotulo: 'Saldo de pontos', tipo: 'number', valor: p.saldo }, { nome: 'valor_milheiro', rotulo: 'Valor do milheiro (R$ por 1.000 pontos)', tipo: 'number', valor: p.valor_milheiro }, { nome: 'validade', rotulo: 'Vencimento', tipo: 'date', valor: p.validade || '' }],
        (d) => MB.api('pontos_salvar', { id: p.id, programa: p.programa, saldo: Number(d.saldo), valor_milheiro: Number(d.valor_milheiro), validade: d.validade || '' }));
    }; });
  };
})();
