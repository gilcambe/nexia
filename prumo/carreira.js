'use strict';
// Kernex Finance: aba Carreira e renda. Usa window.MB, /prumo/ui.js e /prumo/carreira-visao.js.
(function () {
  const MB = window.MB;
  const carregarJs = (src, pronto) => pronto() ? Promise.resolve() : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.carreira = async (el) => {
    await carregarJs('/prumo/ui.js', () => MB.ui);
    const ui = MB.ui;
    ui.aba('carreira');
    await carregarJs('/prumo/carreira-visao.js', () => MB.carreiraVisao);
    const r = await MB.api('carreira_visao');
    el.innerHTML = MB.carreiraVisao.visao(r);
    const p = r.perfil || {};
    const campo = (nome, rotulo, valor, tipo) => ({ nome, rotulo, valor, tipo });
    const anos = p.anos_experiencia === null || p.anos_experiencia === undefined ? undefined : p.anos_experiencia;
    el.querySelector('#car-editar').onclick = () => ui.formulario('Seu perfil', [
      campo('cargo', 'Cargo', p.cargo), campo('area', 'Área (ex.: logística, TI)', p.area), campo('cidade', 'Cidade', p.cidade), campo('anos_experiencia', 'Anos de experiência', anos, 'number'),
    ], (d) => MB.api('carreira_perfil_salvar', { cargo: d.cargo, area: d.area, cidade: d.cidade, anos_experiencia: d.anos_experiencia }));
    const bp = el.querySelector('#car-plano');
    if (bp) bp.onclick = async () => {
      bp.disabled = true;
      try { await MB.api('carreira_plano', {}); ui.recarregar(); } catch { bp.disabled = false; }
    };
    const bt = el.querySelector('#car-taxa');
    if (bt) bt.onclick = () => ui.formulario('Quanto o dinheiro rende por ano (%)', [campo('taxa_ano', 'Rendimento por ano (estimativa)', p.taxa_ano, 'number')],
      (d) => MB.api('carreira_perfil_salvar', { taxa_ano: d.taxa_ano }));
  };
})();
