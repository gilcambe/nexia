'use strict';
// Kernex Finance: aba Fluxo de caixa (próximos 90 dias por semana + assinaturas). Usa window.MB e /prumo/fluxo-visao.js.
(function () {
  const MB = window.MB;
  const carregarJs = (src, pronto) => pronto() ? Promise.resolve() : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.fluxo = async (el) => {
    await carregarJs('/prumo/ui.js', () => MB.ui);
    MB.ui.aba('fluxo');
    await carregarJs('/prumo/fluxo-visao.js', () => MB.fluxoVisao);
    const r = await MB.api('fluxo_visao');
    const v = MB.fluxoVisao;
    el.innerHTML = `<div class="card"><div class="fraco">Saldo de partida</div><div class="grande">${r.saldo_conhecido ? v.brl(r.saldo_inicial) : '—'}</div>
      <div class="fraco">Entra ${v.brl(r.total_entra)} · Sai ${v.brl(r.total_sai)} em 90 dias (estimativa)</div></div>
      ${v.semanas(r)}${v.assinaturas(r.assinaturas)}`;
  };
})();
