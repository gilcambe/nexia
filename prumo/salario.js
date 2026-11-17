// Prumo: regras puras de Salário (sem DOM).
(function () {
  'use strict';
  const MB = window.MB = window.MB || {};

  const NOMES = {
    adiantamento: 'Adiantamento',
    mensal: 'Salário do mês',
    decimo_terceiro_1: '13º (1ª parcela)',
    decimo_terceiro_2: '13º (2ª parcela)',
    ferias: 'Férias',
    plr: 'PLR',
    outro: 'Outro',
  };

  function nomeTipo(tipo) {
    return NOMES[tipo] || NOMES.outro;
  }

  function escTexto(t) {
    if (t == null) return '';
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function brl(v) {
    if (v == null) return 'R$ 0,00';
    const sinal = Number(v) < 0 ? '-' : '';
    const n = Math.abs(Number(v) || 0);
    const inteiro = Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimal = (n % 1).toFixed(2).slice(2);
    return `R$ ${sinal}${inteiro},${decimal}`;
  }

  function cartao(r) {
    const mes = (r && r.mes) ? String(r.mes) : '';
    const m = mes.split('-');
    const mesAno = m.length === 2 ? `${m[1]}/${m[0]}` : mes;
    const recebidos = Array.isArray(r && r.recebidos) ? r.recebidos : [];
    const total = r && r.total_recebido != null ? Number(r.total_recebido) : 0;
    const previsao = r && r.previsao;
    const motivo = r && r.motivo;
    const partes = [`<div class="card" id="sal-cartao">`, `<h3>Recebimentos de ${escTexto(mesAno)}</h3>`];
    if (recebidos.length === 0) {
      partes.push('<p>Nenhum recebimento lançado neste mês.</p>');
    } else {
      for (const rec of recebidos) {
        const tipo = rec && rec.tipo;
        const data = rec && rec.data_pagamento ? String(rec.data_pagamento).split('-').reverse().join('/') : '';
        partes.push(`<div class="item"><span>${escTexto(nomeTipo(tipo))} <span class="fraco">${escTexto(data)}</span></span><span class="v">${brl(rec && rec.liquido)}</span></div>`);
      }
      partes.push(`<div class="item"><span>Total recebido</span><span class="v">${brl(total)}</span></div>`);
    }
    if (previsao) {
      partes.push(`<div id="sal-previsao">`);
      partes.push(`<div class="item"><span>Previsão do fechamento</span><span class="v">${brl(previsao.a_receber)}</span></div>`);
      if (Array.isArray(previsao.linhas)) {
        for (const l of previsao.linhas) {
          if (l && l.valor != null && Number(l.valor) !== 0) {
            partes.push(`<div class="item"><span>${escTexto(l.nome)}</span><span class="v">${brl(l.valor)}</span></div>`);
          }
        }
      }
      if (previsao.aviso) partes.push(`<p class="fraco">${escTexto(previsao.aviso)}</p>`);
      partes.push('</div>');
    } else {
      if (motivo) partes.push(`<p>${escTexto(motivo)}</p>`);
      if (motivo && /salario base/i.test(String(motivo).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        partes.push('<button type="button" data-acao="salario-base">Informar salário base</button>');
      }
    }
    partes.push('</div>');
    return partes.join('');
  }

  MB.salario = { NOMES, nomeTipo, cartao };
})();
