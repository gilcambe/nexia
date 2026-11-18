'use strict';
// Prumo: funções puras da aba Salário (sem DOM). Usadas por /prumo/orcamento.js.
(function () {
  const MB = window.MB = window.MB || {};
  const NOMES = { adiantamento: 'Adiantamento', mensal: 'Salário do mês', decimo_terceiro_1: '13º (1ª parcela)', decimo_terceiro_2: '13º (2ª parcela)', ferias: 'Férias', plr: 'PLR', outro: 'Outro' };
  const nomeTipo = (t) => NOMES[t] || NOMES.outro;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brl = (v) => {
    const n = Number(v) || 0;
    const [i, d] = Math.abs(n).toFixed(2).split('.');
    return `${n < 0 ? '-' : ''}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
  };
  const dm = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[2]}/${m[1]}` : ''; };
  const linha = (rot, val, extra) => `<div class="item"><span>${rot}</span><span class="v"${extra || ''}>${val}</span></div>`;

  function cartao(r) {
    const m = /^(\d{4})-(\d{2})/.exec(String(r.mes || ''));
    const rec = r.recebidos || [];
    let h = `<div class="card" id="sal-cartao"><b>Recebimentos de ${m ? `${m[2]}/${m[1]}` : esc(r.mes)}</b>`;
    h += rec.length
      ? rec.map((x) => `<div class="item" data-pag="${esc(x.id || '')}" style="cursor:pointer"><span>${esc(nomeTipo(x.tipo))} <span class="fraco">${esc(dm(x.data_pagamento))} ✏️</span></span><span class="v">${brl(x.liquido)}</span></div>`).join('') + linha('<b>Total recebido</b>', brl(r.total_recebido))
      : '<p class="fraco">Nenhum recebimento lançado neste mês.</p>';
    const pt = r.ponto;
    if (pt) {
      const hh = (v) => { const n = Number(v) || 0; const H = Math.floor(n); const M = Math.round((n - H) * 60); return `${H}:${String(M).padStart(2, '0')}`; };
      const partes = [['HE 50%', pt.he50], ['HE 75%', pt.he75], ['HE 100%', pt.he100], ['Noturno', pt.noturnas], ['Sobreaviso', pt.sobreaviso], ['Faltas', pt.faltas]].filter(([, v]) => Number(v) > 0).map(([n, v]) => `${n} ${hh(v)}`);
      h += `<div class="item" data-ponto="1" style="cursor:pointer"><span>🕒 Folha de ponto <span class="fraco">${esc(partes.join(' · ') || 'sem horas extras')} ✏️</span></span></div>`;
    }
    const p = r.previsao;
    if (p) {
      h += `<div id="sal-previsao"><div class="fraco" style="margin-top:10px">Previsão do fechamento</div><div class="grande">${brl(p.a_receber)}</div>`
        + (p.linhas || []).filter((l) => Number(l.valor) !== 0).map((l) => linha(esc(l.nome), brl(l.valor))).join('')
        + `<p class="fraco">${esc(p.aviso)}</p><button type="button" class="btn sec mini" data-acao="salario-ajustes">⚙️ Ajustes da folha</button></div>`;
    } else {
      h += `<p class="fraco">${esc(r.motivo)}</p>`;
      if (/sal[aá]rio base/i.test(String(r.motivo || ''))) h += '<button type="button" class="btn sec" data-acao="salario-base">Informar salário base</button>';
    }
    // Data futura: fica à parte, não entra no total recebido.
    const prev = (r.a_receber || []).map((x) => ({ tipo: 'receber', nome: nomeTipo(x.tipo), data: x.data_pagamento, valor: x.liquido, colecao: 'pagamentos', id: x.id }));
    if (prev.length && MB.previsto) h += '</div>' + MB.previsto.cartao(prev, 'A receber (ainda não caiu)');
    else return h + '</div>';
    return h;
  }

  function camposRecebimento(p, mesSel) {
    p = p || {};
    return [
      { nome: 'tipo', rotulo: 'Tipo', opcoes: Object.keys(NOMES).map((k) => `<option value="${k}"${p.tipo === k ? ' selected' : ''}>${esc(NOMES[k])}</option>`).join('') },
      { nome: 'data_pagamento', rotulo: 'Data do pagamento', tipo: 'date', valor: p.data_pagamento },
      { nome: 'mes', rotulo: 'Mês', tipo: 'month', valor: p.mes || mesSel },
      { nome: 'empresa', rotulo: 'Empresa', valor: p.empresa },
      { nome: 'bruto', rotulo: 'Salário bruto (R$)', tipo: 'number', valor: p.bruto },
      { nome: 'liquido', rotulo: 'Valor líquido (R$)', tipo: 'number', valor: p.liquido },
    ];
  }

  function corpoPagamento(p, d) {
    const { ok, erro, lido, ...base } = { ...(p || {}), ...(d || {}) };
    return { ...base, bruto: Number(base.bruto), liquido: Number(base.liquido) };
  }

  MB.salario = { NOMES, nomeTipo, cartao, camposRecebimento, corpoPagamento };
})();
