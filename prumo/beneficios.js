'use strict';
// Redesign: aba Benefícios. Milhas e pontos (com vencimento), viagens e benefícios dos cartões.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.beneficios = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('beneficios');
    const [r, p] = await Promise.all([MB.api('inicio_resumo'), MB.api('painel_resumo', {}, { silencioso: true }).catch(() => null)]);
    const av = ((p && p.alertas) || []).filter((a) => a.aba === 'beneficios');
    el.innerHTML = `<div class="kh">
      <div class="kh-larga"><h2>Benefícios</h2><div class="sub">Pontos, milhas e vantagens que valem dinheiro</div></div>
      <div class="kh-kpis kh-larga">
        <div class="card"><div class="r">Milhas e pontos (em R$)</div><div class="v">${H.val(r.milhas_estimado, 'kh-in')}</div></div>
        <div class="card"><div class="r">Cartões</div><div class="v">${(r.vencimentos || []).length ? (r.vencimentos.length + ' vencendo') : '<span class="kh-zero">—</span>'}</div></div>
      </div>
      ${av.length ? `<section class="card kh-larga"><b>⚠️ Vencendo</b>${av.map((a) => `<div class="kh-ag"><span>${H.esc(a.texto)}</span></div>`).join('')}</section>` : ''}
      ${H.lista([
        ['pontos', '✈️', 'Milhas e pontos', 'Saldo, validade e quanto valem'],
        ['viagens', '🧳', 'Viagens', 'Planejar com milhas'],
        ['cartoes', '💳', 'Benefícios dos cartões', 'Anuidade, cashback e pontos por real'],
        ['economizar', '💡', 'Economizar', 'Onde dá para gastar menos'],
        ['impostos', '🧾', 'Impostos', 'IR, IPVA, IPTU'],
      ])}
      <section class="card"><b>Valor do milheiro</b><p class="sub" style="margin:6px 0 0">O valor em reais dos pontos usa o milheiro que você define em cada programa (editável na tela Milhas e pontos). É uma estimativa.</p></section>
    </div>`;
    H.ligar(el);
  };
})();
