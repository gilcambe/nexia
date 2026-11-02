'use strict';
// Prumo: aba objetivos. Usa window.MB (casca em app.js) e as peças de /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.objetivos = async (el) => {
    ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi());
    MB.ui.aba('objetivos');
    const [{ objetivos: brutos }, { meses }] = await Promise.all([MB.api('objetivo_listar'), MB.api('historico_listar')]);
    const mesHoje = new Date().toISOString().slice(0, 7);
    const faltamMeses = (prazo) => Math.max(1, (Number(prazo.slice(0, 4)) - Number(mesHoje.slice(0, 4))) * 12 + Number(prazo.slice(5, 7)) - Number(mesHoje.slice(5, 7)));
    const objetivos = brutos.map((o) => ({ ...o, por_mes: o.falta / faltamMeses(o.prazo) }));
    const ult = meses[meses.length - 1];
    const v = ult && ult.variacao != null ? { valor: ult.variacao, percentual: ult.variacao_pct } : null;
    const hist = { pontos: meses.map((m) => ({ mes: m.mes, total: m.total })) };
    el.innerHTML = `
      <div class="card"><div class="fraco">Evolução do patrimônio</div>${grafico(hist.pontos)}
        ${v ? `<p>Seu patrimônio ${v.valor >= 0 ? '<b class="verde">subiu' : '<b class="verm">caiu'} ${brl(Math.abs(v.valor))}${v.percentual != null ? ` (${Math.abs(v.percentual)}%)` : ''}</b> desde o mês passado.</p>` : '<p class="fraco">O gráfico cresce a cada mês em que você atualiza a carteira.</p>'}</div>
      <button class="btn" id="novo" style="width:100%;margin-bottom:12px">🎯 Novo objetivo</button>
      ${objetivos.map((o) => `<div class="card" data-id="${o.id}"><div class="item" style="padding:0;border:0"><span class="n">${esc(o.nome)}</span><span class="fraco">até ${esc(o.prazo.slice(5, 7) + '/' + o.prazo.slice(0, 4))}</span></div>
        <div style="margin-top:6px">${brl(o.atual)} de ${brl(o.meta)} · <b>${o.percentual}%</b></div>${barra(o.percentual, o.cor || '')}
        <div class="fraco" style="margin-top:6px">${o.falta > 0 ? `Faltam ${brl(o.falta)} · guarde ${brl(o.por_mes)} por mês para chegar no prazo` : '✅ Meta alcançada!'}</div></div>`).join('') || '<p class="fraco">Crie seus objetivos (aposentadoria, reserva, carro, imóvel…) e ligue cada investimento a um deles na aba Carteira.</p>'}
      <p class="fraco">As contas aqui são estimativas para organizar seus planos; não são recomendação oficial de investimento.</p>`;
    const editar = (o, nomeSugerido) => formulario(o ? 'Editar objetivo' : 'Novo objetivo', [
      { nome: 'nome', rotulo: 'Nome', valor: o ? o.nome : nomeSugerido || '' },
      { nome: 'meta', rotulo: 'Meta (R$)', tipo: 'number', valor: o && o.meta },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'month', valor: o && o.prazo },
      { nome: 'aporte_mensal', rotulo: 'Quanto pretende guardar por mês (R$)', tipo: 'number', valor: o && o.aporte_mensal },
      { nome: 'perfil', rotulo: 'Perfil para este objetivo', opcoes: opcoes({ conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' }, o ? o.perfil : 'moderado') },
    ], (d) => MB.api('objetivo_salvar', { ...d, id: o && o.id }), o && (() => MB.api('objetivo_apagar', { id: o.id })));
    el.querySelector('#novo').onclick = () => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3 style="margin-top:0">Qual objetivo?</h3>${['Aposentadoria', 'Reserva de emergência', 'Carro', 'Imóvel', 'Viagem', 'Estudos dos filhos', 'Outro'].map((n) => `<span class="chip">${n}</span>`).join('')}`;
      document.body.appendChild(d);
      d.showModal();
      d.addEventListener('close', () => d.remove());
      d.querySelectorAll('.chip').forEach((c) => { c.onclick = () => { d.close(); editar(null, c.textContent === 'Outro' ? '' : c.textContent); }; });
    };
    el.querySelectorAll('.card[data-id]').forEach((n) => { n.onclick = () => editar(objetivos.find((x) => x.id === n.dataset.id)); });
  };

  function grafico(pontos) {
    if (!pontos.length) return '<p class="fraco">Sem histórico ainda.</p>';
    const W = 320, H = 120, max = Math.max(...pontos.map((p) => p.total)) || 1, min = Math.min(...pontos.map((p) => p.total));
    const base = min === max ? 0 : min * 0.95;
    const xy = pontos.map((p, i) => [pontos.length === 1 ? W / 2 : (i / (pontos.length - 1)) * (W - 20) + 10, H - 20 - ((p.total - base) / (max - base || 1)) * (H - 40)]);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Evolução do patrimônio">
      <polyline fill="none" stroke="#22c55e" stroke-width="3" points="${xy.map((p) => p.join(',')).join(' ')}"/>
      ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#22c55e"><title>${pontos[i].mes}: ${brl(pontos[i].total)}</title></circle>`).join('')}
      <text x="10" y="${H - 4}" fill="#9bb3a5" font-size="11">${pontos[0].mes.slice(5)}/${pontos[0].mes.slice(2, 4)}</text>
      <text x="${W - 10}" y="${H - 4}" fill="#9bb3a5" font-size="11" text-anchor="end">${brl(pontos[pontos.length - 1].total)}</text></svg>`;
  }
})();
