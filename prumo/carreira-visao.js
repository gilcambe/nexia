'use strict';
// Kernex Finance: peças da aba Carreira e renda (funções puras, sem DOM). A aba é prumo/carreira.js.
(function () {
  const MB = window.MB = window.MB || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brl = (v) => { const n = Math.round(Number(v || 0) * 100) / 100; const [i, d] = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '-R$ ' : 'R$ ') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const lis = (l) => (l && l.length ? `<ul style="margin:4px 0 8px 18px;padding:0">${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fraco">—</p>');
  const num = (v) => String(v).replace('.', ',');

  function perfil(r) {
    const p = r.perfil || {};
    const linha = (rot, v) => `<div class="item"><span>${rot}</span><span class="v">${v ? esc(v) : '—'}</span></div>`;
    return `<div class="card" id="car-perfil"><div class="item" style="padding-top:0"><b>Seu perfil</b><button class="btn sec mini" id="car-editar" type="button">${p.cargo ? 'Editar' : 'Preencher'}</button></div>
      ${linha('Cargo', p.cargo)}${linha('Área', p.area)}${linha('Cidade', p.cidade)}${linha('Anos de experiência', p.anos_experiencia === null || p.anos_experiencia === undefined ? '' : String(p.anos_experiencia))}
      <div class="item"><span>Salário atual</span><span class="v">${r.salario_atual ? brl(r.salario_atual) : '—'}</span></div>
      ${r.salario_atual ? '' : '<p class="fraco">Informe seu salário base na aba Salário.</p>'}</div>`;
  }
  function plano(r) {
    const p = r.plano;
    const botao = (t) => `<button class="btn" id="car-plano" type="button">${t}</button>`;
    if (!p) return `<div class="card" id="car-plano-card"><b>Plano de ação</b><p class="fraco">A IA grátis sugere próximo cargo, cursos, quanto pedir de aumento e renda extra.</p>${botao('🤖 Gerar plano de ação (IA grátis)')}</div>`;
    const pct = p.aumento && p.aumento.pedir_pct !== null && p.aumento.pedir_pct !== undefined ? p.aumento.pedir_pct : null;
    return `<div class="card" id="car-plano-card"><b>Plano de ação</b> <span class="fraco">(sugestão, não é garantia)</span>
      <div class="fraco">Próximo cargo</div><div>${esc(p.proximo_cargo || '—')}</div>
      <div class="fraco">Certificações</div>${lis(p.certificacoes)}
      <div class="fraco">Aumento a pedir</div><div>${pct === null ? '—' : `cerca de ${num(pct)}%${r.salario_atual ? ' (≈ ' + brl(r.salario_atual * pct / 100) + ' a mais por mês)' : ''}`}</div>
      ${p.aumento && p.aumento.argumento ? `<div class="fraco">${esc(p.aumento.argumento)}</div>` : ''}
      <div class="fraco" style="margin-top:8px">Ideias de renda extra</div>${lis(p.renda_extra)}
      <div class="fraco">${esc(p.aviso || r.aviso || '')}</div>${botao('🔄 Gerar o plano de novo')}</div>`;
  }
  function patrimonio(r) {
    const pt = r.patrimonio || {}; const i = pt.independencia;
    const corpo = i
      ? `<div class="item"><span>Para viver de renda (gasto de ${brl(i.gasto_mensal)}/mês)</span><span class="v">${brl(i.alvo)}</span></div><div class="item"><span>Ainda falta</span><span class="v">${brl(i.falta)}</span></div>
         <p>${i.anos === null ? esc(i.nota || '') : `No ritmo de hoje, faltam cerca de <b>${num(i.anos)} anos</b> (estimativa).`}</p>`
      : `<p class="fraco">${esc(pt.motivo || '')}</p>`;
    return `<div class="card" id="car-patrimonio"><b>Meta de patrimônio</b><div class="item"><span>Investimentos hoje</span><span class="v">${brl(pt.investimentos)}</span></div>${corpo}</div>`;
  }
  function alavancar(r) {
    const a = r.alavancar || {};
    if (!a.cenarios || !a.cenarios.length) return `<div class="card" id="car-alavancar"><b>Alavancar</b><p class="fraco">${esc(a.texto || '')}</p></div>`;
    return `<div class="card" id="car-alavancar"><b>Alavancar: se você investir a sobra</b><p class="fraco">Sobra do mês ${brl(a.sobra)}, rendendo ${num(a.taxa_ano)}% ao ano (estimativa).</p>
      ${a.cenarios.map((x) => `<div class="item"><span>${x.anos} ${x.anos === 1 ? 'ano' : 'anos'}</span><span class="v">${brl(x.rendimento_total)}</span></div><div class="fraco">Você guarda ${brl(x.guardado)} e os juros somam ${brl(x.juros)}.</div>`).join('')}
      <div class="item"><span>Rendimento por ano</span><span class="v"><button class="btn sec mini" id="car-taxa" type="button">${num(a.taxa_ano)}% (mudar)</button></span></div><p class="fraco">${esc(a.texto)}</p></div>`;
  }
  const visao = (r) => perfil(r) + plano(r) + patrimonio(r) + alavancar(r);
  MB.carreiraVisao = { esc, brl, perfil, plano, patrimonio, alavancar, visao };
})();
