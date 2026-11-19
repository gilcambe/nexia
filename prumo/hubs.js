'use strict';
// Redesign (fase 2): as telas Mês, Patrimônio, Benefícios e Perfil. Cada uma tem um resumo no topo e uma lista curta
// de atalhos grandes para as telas de detalhe (que continuam iguais: nada que funciona saiu).
(function () {
  const MB = window.MB;
  if (MB.hub) return;
  const st = document.createElement('style');
  st.textContent = `.kh{display:grid;gap:12px}.kh .card{margin:0;border-radius:16px;padding:16px}
.kh h2{margin:0;font-size:18px;font-weight:600}.kh .sub{color:var(--fraco);font-size:12px}
.kh-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kh-kpis .card{padding:12px}
.kh-kpis .r{font-size:12px;color:var(--fraco)}.kh-kpis .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
.kh-lista{display:grid;gap:0;padding:4px 16px!important}
.kh-it{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;background:none;border:0;border-bottom:1px solid var(--borda);color:var(--texto);font:inherit;text-align:left;cursor:pointer;padding:8px 0}
.kh-it:last-child{border:0}.kh-it i{font-style:normal;font-size:22px;width:36px;height:36px;border-radius:12px;background:#1A2547;display:grid;place-items:center;flex:none}
.kh-it b{display:block;font-size:15px;font-weight:600}.kh-it span{color:var(--fraco);font-size:12px}.kh-it::after{content:'›';margin-left:auto;color:var(--fraco);font-size:22px}
.kh-zero{color:#5D6886}.kh-in{color:#2ECC71}.kh-out{color:#F5A623}.kh-neg{color:#FF5A5F}
.kh-ag{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--borda);font-size:14px}.kh-ag:last-child{border:0}
@media(min-width:900px){.kh{grid-template-columns:1fr 1fr;align-items:start}.kh>.kh-larga{grid-column:1/-1}.kh-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}`;
  if (document.head) document.head.appendChild(st);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const val = (v, cls) => (v == null ? '<span class="kh-zero">—</span>' : Number(v) === 0 ? `<span class="kh-zero">${brl(0)}</span>` : `<span class="${cls || ''}">${brl(v)}</span>`);
  const lista = (itens) => `<section class="card kh-lista">${itens.map((x) => `<button class="kh-it" type="button" data-ir="${esc(x[0])}"><i>${x[1]}</i><div><b>${esc(x[2])}</b><span>${esc(x[3])}</span></div></button>`).join('')}</section>`;
  const ligar = (el) => el.querySelectorAll('[data-ir]').forEach((b) => { b.onclick = () => (b.dataset.ir === 'lancar' ? MB.abrirLancar() : MB.abrirAba(b.dataset.ir)); });
  const ui = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  MB.hub = { esc, brl, val, lista, ligar, ui };
})();
