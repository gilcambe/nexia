'use strict';
// Kernex Finance: aba Metas. Marcos do patrimônio, reserva de emergência, cofres por objetivo,
// simulador com inflação/imposto e independência financeira. Cálculo no servidor (motor); premissas são suas.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.metas = async (el) => {
    const { brl, esc, formulario, barra, aba } = await carregarUi();
    aba('metas');
    const v = await MB.api('meta_visao');
    const pct = (n) => String(n).replace('.', ',');
    const r = v.reserva;
    el.innerHTML = `
      <div class="card"><div class="fraco">Patrimônio líquido</div><div class="grande">${brl(v.patrimonio.liquido)}</div>
        ${v.marcos.map((m) => `<div class="fraco" style="margin-top:6px">${m.atingido ? '✅' : '🎯'} ${brl(m.marco)} · ${pct(m.pct)}%</div>${barra(m.pct, '')}`).join('')}</div>
      <div class="card"><h3 style="margin:0 0 6px">🛟 Reserva de emergência</h3>${r.lacuna ? `<div class="fraco">ℹ️ ${esc(r.lacuna)}</div>` : `<div class="fraco">Meta de 6 meses: ${brl(r.meta_6_meses)} (despesa média ${brl(r.despesa_media)}). Nas contas: ${brl(r.em_contas)} = ${pct(r.meses_cobertos)} mês(es) cobertos.</div>`}</div>
      <div class="card"><h3 style="margin:0 0 6px">🔒 Cofres por objetivo</h3>${v.objetivos.map((o) => `<div class="item" data-id="${esc(o.id)}"><div><div class="n">${esc(o.nome)}</div><div class="fraco">${brl(o.atual)} de ${brl(o.meta)} · ${pct(o.percentual)}% (cofre ${brl(o.cofre)} + carteira ${brl(o.da_carteira)})${o.sem_aporte ? ' · sem aporte mensal definido' : o.meses_para_meta === null ? ' · não chega com esse aporte' : ` · ${o.meses_para_meta} mês(es) no ritmo atual`}</div></div><div class="v">Guardar</div></div>`).join('') || '<div class="fraco">Crie objetivos na aba Objetivos para ter um cofre para cada um.</div>'}</div>
      <div class="card"><h3 style="margin:0 0 6px">🔮 Patrimônio futuro</h3>
        <div class="fraco">Valor real = já descontando imposto sobre o rendimento e inflação.</div>
        <label>Valor inicial (R$)</label><input id="ms-ini" type="number" step="0.01" inputmode="decimal">
        <label>Aporte por mês (R$)</label><input id="ms-ap" type="number" step="0.01" inputmode="decimal">
        <label>Rendimento por ano (%)</label><input id="ms-tx" type="number" step="0.01" inputmode="decimal">
        <label>Inflação por ano (%)</label><input id="ms-in" type="number" step="0.01" inputmode="decimal">
        <label>Imposto sobre o rendimento (%)</label><input id="ms-im" type="number" step="0.01" inputmode="decimal">
        <label>Prazo (anos)</label><input id="ms-an" type="number" inputmode="numeric">
        <button class="btn" id="ms-ir" type="button" style="margin-top:10px">Simular</button><div id="ms-res"></div></div>
      <div class="card"><h3 style="margin:0 0 6px">🏝️ Independência financeira</h3>
        <label>Gasto por mês que quer sustentar (R$)</label><input id="fi-g" type="number" step="0.01" inputmode="decimal">
        <label>Quanto já tem (R$)</label><input id="fi-at" type="number" step="0.01" inputmode="decimal">
        <label>Aporte por mês (R$)</label><input id="fi-ap" type="number" step="0.01" inputmode="decimal">
        <label>Rendimento por ano (%)</label><input id="fi-tx" type="number" step="0.01" inputmode="decimal">
        <label>Inflação por ano (%)</label><input id="fi-in" type="number" step="0.01" inputmode="decimal">
        <button class="btn" id="fi-ir" type="button" style="margin-top:10px">Calcular</button><div id="fi-res"></div></div>
      <div class="fraco" style="margin:8px 0">${esc(v.aviso)}</div>`;
    const val = (id) => el.querySelector(id).value;
    el.querySelectorAll('.item[data-id]').forEach((i) => {
      i.onclick = () => formulario('Mexer no cofre', [{ nome: 'valor', rotulo: 'Valor (R$, negativo = retirar)', tipo: 'number' }, { nome: 'nota', rotulo: 'Nota (opcional)' }],
        async (f) => { await MB.api('cofre_mover', { objetivo_id: i.dataset.id, valor: Number(f.valor), nota: f.nota }); MB.ui.ok('Cofre atualizado.'); }, null);
    });
    el.querySelector('#ms-ir').onclick = async () => {
      const res = el.querySelector('#ms-res');
      try {
        const s = await MB.api('meta_simular', { inicial: val('#ms-ini'), aporte: val('#ms-ap'), taxa_ano: val('#ms-tx'), inflacao_ano: val('#ms-in'), imposto_pct: val('#ms-im'), anos: val('#ms-an') });
        res.innerHTML = `<div class="card" style="margin-top:8px"><div class="n">Valor real: ${brl(s.real)}</div><div class="fraco">Você coloca ${brl(s.investido)} · bruto ${brl(s.bruto)} · imposto ${brl(s.imposto)} · líquido ${brl(s.liquido)}</div><div class="fraco">${esc(s.aviso)}</div></div>`;
      } catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui simular.')}</div>`; }
    };
    el.querySelector('#fi-ir').onclick = async () => {
      const res = el.querySelector('#fi-res');
      try {
        const f = await MB.api('meta_independencia', { gasto_mensal: val('#fi-g'), atual: val('#fi-at'), aporte: val('#fi-ap'), taxa_ano: val('#fi-tx'), inflacao_ano: val('#fi-in') });
        res.innerHTML = `<div class="card" style="margin-top:8px"><div class="n">Patrimônio-alvo: ${brl(f.alvo)}</div><div class="fraco">Retirando ${pct(f.retirada_pct)}% ao ano. Faltam ${brl(f.falta)}. ${f.meses === null ? esc(f.nota) : f.meses === 0 ? '✅ Você já chegou.' : `Prazo estimado: ${pct(f.anos)} anos.`}</div><div class="fraco">${esc(f.aviso)}</div></div>`;
      } catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui calcular.')}</div>`; }
    };
  };
})();
