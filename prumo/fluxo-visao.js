'use strict';
// Kernex Finance: peças do Fluxo de caixa (funções puras, sem DOM). A aba é prumo/fluxo.js.
(function () {
  const MB = window.MB = window.MB || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brl = (v) => { const n = Math.round(Number(v || 0) * 100) / 100; const [i, d] = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '-R$ ' : 'R$ ') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const dm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;

  function semanas(r) {
    const aviso = r.aviso ? `<div class="aviso-c" id="fluxo-aviso">⚠️ ${esc(r.aviso.texto)}</div>` : '<div class="card" id="fluxo-aviso">✅ Nos próximos 90 dias o saldo não fica negativo (estimativa).</div>';
    const nota = r.nota ? `<div class="aviso-c">${esc(r.nota)}</div>` : '';
    const semSal = r.sem_salario_base ? '<div class="aviso-c">Informe seu salário base na aba Salário para eu prever o que entra.</div>' : '';
    const linhas = (r.semanas || []).map((s) => `<div class="card fluxo-semana" data-semana="${s.numero}"><div class="item" style="padding:0;border:0"><b>Semana ${s.numero} · ${dm(s.inicio)} a ${dm(s.fim)}</b><span class="v" style="color:${s.saldo_minimo < 0 ? 'var(--perigo)' : 'var(--verde2)'}">${brl(s.saldo_fim)}</span></div>
      <div class="fraco">Entra ${brl(s.entra)} · Sai ${brl(s.sai)}${s.saldo_minimo < 0 ? ' · falta dinheiro aqui' : ''}</div>
      ${(s.itens || []).map((e) => `<div class="item"><span>${e.tipo === 'entrada' ? '⬆️' : '⬇️'} ${esc(e.nome)} <span class="fraco">${dm(e.data)}${e.estimado ? ' · estimativa' : ''}</span></span><span class="v">${e.tipo === 'entrada' ? '' : '-'}${brl(e.valor)}</span></div>`).join('')}</div>`).join('');
    return `${semSal}${nota}${aviso}${linhas}<p class="fraco">${esc(r.aviso_legal || '')}</p>`;
  }
  function assinaturas(a) {
    const itens = (a && a.itens) || [];
    if (!itens.length) return '<div class="card" id="fluxo-assinaturas"><b>Assinaturas</b><p class="fraco">Não achei gastos que se repetem todo mês. Quando houver 2 meses de lançamentos, eles aparecem aqui.</p></div>';
    return `<div class="card" id="fluxo-assinaturas"><b>Assinaturas e gastos que se repetem</b>
      <p class="fraco">Total: ${brl(a.total_mes)} por mês · <b>${brl(a.total_ano)} por ano</b></p>
      ${itens.map((x) => `<div class="item"><span>${esc(x.nome)} <span class="fraco">${x.meses} meses</span></span><span class="v">${brl(x.por_ano)}/ano</span></div><div class="fraco">Cancelar? ${esc(x.pergunta)}</div>`).join('')}</div>`;
  }
  /** Cartão do Início: "quanto ainda cai este mês" e alerta do 13º/férias. fi = fluxo_inicio do inicio_resumo. */
  function cartaoInicio(fi) {
    if (!fi) return '';
    const cai = fi.cai_este_mes === null || fi.cai_este_mes === undefined
      ? `<p class="fraco">${esc(fi.motivo || '')}</p>`
      : `<div class="fraco">Quanto ainda cai este mês (estimativa)</div><div class="n ${fi.cai_este_mes < 0 ? 'verm' : 'verde'}">${brl(fi.cai_este_mes)}</div><div class="fraco">Salário a receber ${brl(fi.previsao_salario)} − contas a vencer ${brl(fi.contas_a_vencer)}</div>`;
    const al = (fi.alertas || []).map((a) => `<div class="item"><span>💰 ${esc(a.nome)} ${a.em_dias <= 0 ? 'cai hoje' : 'cai em ' + a.em_dias + ' dia(s)'} (${dm(a.data)}) · ${brl(a.valor)}${a.estimado ? ' (estimativa)' : ''}</span></div>${a.destino && a.destino.texto ? `<div class="fraco">Sugestão: ${esc(a.destino.texto)}</div>` : ''}`).join('');
    return `<div class="card" id="kf-fluxo" style="margin-top:12px">${cai}${al}<button class="btn sec mini" id="kf-fluxo-ver" type="button" style="margin-top:8px">Ver fluxo de caixa</button></div>`;
  }
  MB.fluxoVisao = { esc, brl, semanas, assinaturas, cartaoInicio };
})();
