// Kernex Finance: aba Início (painel). Todos os números vêm do motor no servidor; aqui só mostramos.
'use strict';
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };
  const COR = { perigo: '#ef4444', aviso: '#f59e0b' };
  MB.telas.inicio = async (el) => {
    await iniciar('inicio');
    const p = await MB.api('painel');
    const nota = p.saude.nota;
    const corNota = nota === null ? '#8ea3cc' : nota >= 70 ? '#22c55e' : nota >= 40 ? '#f59e0b' : '#ef4444';
    const kpi = (t, v, extra) => `<div class="card" style="flex:1;min-width:140px;margin:0"><div class="fraco">${t}</div><div style="font-size:20px;font-weight:700">${v}</div>${extra ? `<div class="fraco">${extra}</div>` : ''}</div>`;
    el.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg,#143a8f,#0f1a33)"><div class="fraco">Patrimônio líquido</div><div class="grande">${brl(p.patrimonio_liquido)}</div>
        <div class="fraco">Possui ${brl(p.ativos)} · deve ${brl(p.passivos)}</div></div>
      <div class="linha" style="margin-bottom:12px">${kpi('Receita do mês', brl(p.renda_mes))}${kpi('Gasto do mês', brl(p.despesas_mes))}${kpi('Sobra', brl(p.sobra_mes))}</div>
      <div class="linha" style="margin-bottom:12px">${kpi('Saldo disponível', brl(p.saldo_disponivel), 'sem limite de crédito')}${kpi('Investimentos', brl(p.investimentos))}${kpi('Milhas (estimado)', brl(p.milhas_estimado))}</div>
      <div class="card"><div class="item" style="border:0;padding:0"><div><div class="fraco">Saúde financeira</div><div class="grande" style="color:${corNota}">${nota === null ? '—' : nota + '/100'}</div></div>
        <div class="fraco" style="text-align:right">Reserva: ${p.meses_reserva === null ? 'sem dados' : p.meses_reserva + ' meses'}</div></div>
        ${nota !== null ? barra(nota, corNota) : ''}
        ${p.saude.indicadores.map((i) => `<div class="item"><span>${esc(i.nome)}</span><span class="v">${i.nota}</span></div>`).join('')}
        ${p.saude.aviso ? `<div class="fraco" style="margin-top:6px">${esc(p.saude.aviso)}</div>` : ''}
        ${p.saude.lacunas.length ? `<div class="fraco">Faltam dados: ${p.saude.lacunas.map(esc).join(', ')}.</div>` : ''}</div>
      ${p.alertas.map((a) => `<div class="aviso-c" style="border-color:${COR[a.nivel] || '#f59e0b'}">${esc(a.texto)}</div>`).join('')}
      ${p.proximos.length ? `<div class="card"><div class="fraco">Próximos vencimentos</div>${p.proximos.map((x) => `<div class="item"><span>${x.tipo === 'fatura' ? '💳' : '🧾'} ${esc(x.nome)}</span><span class="v">${x.em_dias < 0 ? 'atrasado' : x.em_dias === 0 ? 'hoje' : 'em ' + x.em_dias + ' d'}</span></div>`).join('')}</div>` : ''}
      ${Object.keys(p.por_categoria).length ? `<div class="card"><div class="fraco">Gastos por categoria</div>${Object.entries(p.por_categoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(k)}</span><span>${brl(v)}</span></div>${barra(p.despesas_mes ? (v / p.despesas_mes) * 100 : 0)}</div>`).join('')}</div>` : ''}
      ${p.lacunas.map((t) => `<div class="card fraco">💡 ${esc(t)}</div>`).join('')}
      <div class="linha"><button class="btn" id="doc">📄 Enviar documento</button><button class="btn sec" id="ia">🧭 Falar com o consultor</button></div>`;
    el.querySelector('#doc').onclick = () => MB.abrirAba('documentos');
    el.querySelector('#ia').onclick = () => MB.abrirAba('consultor');
  };
})();
