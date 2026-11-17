'use strict';
// Kernex Finance: Aposentadoria e FGTS. Funções PURAS (sem DOM) que desenham os cartões e montam formulários.
// A tela (aposentadoria.js) chama estas funções. Todos os valores são ESTIMATIVA e vêm do servidor.
(function () {
  const MB = window.MB = window.MB || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBr = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const anosMeses = (m) => { m = Math.max(0, Math.round(Number(m) || 0)); return `${Math.floor(m / 12)} anos e ${m % 12} meses`; };
  const n = (v) => { const x = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : 0; };
  const opt = (mapa, sel) => Object.entries(mapa).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const lista = (itens) => (itens && itens.length ? `<ul class="fraco" style="margin:6px 0 0;padding-left:18px">${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

  // ---------- INSS ----------
  function cartaoInss(inss) {
    if (!inss) return '<div class="card" id="apo-inss"><h3 style="margin:0 0 6px">INSS: quando e quanto</h3><p class="fraco">Informe seus dados ou leia o extrato do CNIS para ver as regras.</p></div>';
    const linhas = inss.regras.map((r) => {
      const melhor = r.id === inss.melhor;
      const quando = r.cumpre_em ? (r.ja_cumpre ? '<b>Você já cumpre</b>' : `Cumpre em <b>${dataBr(r.cumpre_em)}</b> (${esc(r.idade_na_data)} anos)`) : 'Não cumpre nos próximos 50 anos';
      const valor = r.beneficio != null ? `<div class="grande" style="font-size:20px">${brl(r.beneficio)} <span class="fraco">/mês (estimativa${r.limitado === 'teto' ? ', limitado ao teto' : r.limitado === 'piso' ? ', no piso' : ''})</span></div><div class="fraco">${r.coeficiente_pct}% da média${r.fator_previdenciario ? ` × fator ${String(r.fator_previdenciario).replace('.', ',')}` : ''}</div>` : '';
      return `<div class="item" data-regra="${esc(r.id)}" style="display:block;${melhor ? 'border:1px solid var(--verde2);border-radius:10px;padding:8px' : ''}">`
        + `<div><b>${esc(r.nome)}</b>${melhor ? ' <span class="chip">⭐ a melhor para você</span>' : ''}${r.id === inss.mais_cedo && !melhor ? ' <span class="chip">⏱️ a mais cedo</span>' : ''}</div>`
        + `<div>${quando}</div>${valor}<div class="fraco">${esc(r.explica)}</div></div>`;
    }).join('');
    return `<div class="card" id="apo-inss"><h3 style="margin:0 0 6px">INSS: quando e quanto</h3>${linhas}`
      + `<div class="fraco" style="margin-top:8px">Teto ${brl(inss.parametros.teto)} · piso ${brl(inss.parametros.piso)} (2026). Estimativa: ${esc(inss.aviso)}</div>`
      + `${lista(inss.avisos)}${lista(inss.suposicoes)}`
      + '<div class="fraco" style="margin-top:6px"><a href="https://meu.inss.gov.br" target="_blank" rel="noopener">Meu INSS (site oficial)</a></div></div>';
  }

  // ---------- FGTS ----------
  function cartaoFgts(f) {
    if (!f) return '<div class="card" id="apo-fgts"><h3 style="margin:0 0 6px">FGTS</h3><p class="fraco">Informe o saldo do FGTS (ou mande um print do app) para ver a projeção.</p></div>';
    const proj = f.projecao.map((p) => `<div class="item"><span>Daqui a ${p.anos} ${p.anos === 1 ? 'ano' : 'anos'}</span><span class="v">${brl(p.saldo)}</span></div>`).join('');
    const a = f.comparacao.aniversario; const r = f.comparacao.rescisao;
    const imovel = f.imovel && !f.imovel.erro
      ? `<div id="apo-imovel-res"><b>FGTS no imóvel</b><div class="item"><span>Abate do financiamento</span><span class="v">${brl(f.imovel.abate)}</span></div>`
        + `<div class="item"><span>Reduzindo o prazo</span><span class="v">${f.imovel.reduzindo_prazo.meses_a_menos} meses a menos · economiza ${brl(f.imovel.reduzindo_prazo.economia_juros)}</span></div>`
        + `<div class="item"><span>Reduzindo a parcela</span><span class="v">parcela ${brl(f.imovel.reduzindo_parcela.nova_parcela)} · economiza ${brl(f.imovel.reduzindo_parcela.economia_juros)}</span></div>${lista(f.imovel.condicoes)}</div>`
      : (f.imovel && f.imovel.erro ? `<p class="fraco">${esc(f.imovel.erro)}</p>` : '');
    return `<div class="card" id="apo-fgts"><h3 style="margin:0 0 6px">FGTS</h3>`
      + `<div class="fraco">Saldo informado</div><div class="grande">${brl(f.saldo)}</div>`
      + `<div class="fraco">Depósito de ${brl(f.deposito_mensal)} por mês${f.deposito_de === 'salario' ? ' (8% do seu salário)' : f.deposito_de === 'nenhum' ? ' (informe o salário ou o depósito)' : ''}. ${esc(f.premissa)}</div>`
      + `<div style="margin-top:8px"><b>Projeção (estimativa)</b></div>${proj}`
      + '<div style="margin-top:12px"><b>Saque-aniversário × saque-rescisão</b></div>'
      + `<div class="item"><span>Saque-aniversário: você tira por ano</span><span class="v">${brl(a.saque_este_ano)} (${a.aliquota_pct}% + ${brl(a.parcela_adicional)})</span></div>`
      + `<div class="item"><span>Se for demitido hoje (aniversário)</span><span class="v">saca ${brl(a.se_demitido_hoje.saca_agora)} · ${brl(a.se_demitido_hoje.saldo_bloqueado)} fica preso</span></div>`
      + `<div class="item"><span>Se for demitido hoje (rescisão)</span><span class="v">saca ${brl(r.se_demitido_hoje.saca_agora)}</span></div>`
      + `<div class="fraco">${esc(f.comparacao.dica)}</div><div class="fraco">${esc(f.comparacao.suposicao)}</div>${imovel}`
      + '<div class="fraco" style="margin-top:6px"><a href="https://www.fgts.gov.br" target="_blank" rel="noopener">FGTS (site oficial)</a></div></div>';
  }

  // ---------- Previdência privada ----------
  function cartaoPrev(p) {
    if (!p) return '<div class="card" id="apo-prev"><h3 style="margin:0 0 6px">Previdência privada</h3><p class="fraco">Simule PGBL × VGBL e quanto aportar. Toque em "Simular previdência".</p></div>';
    const g = p.pgbl_ou_vgbl; const t = p.tabelas;
    const quanto = p.quanto_aportar
      ? `<div style="margin-top:8px"><b>Quanto aportar</b></div><div class="item"><span>Para ter ${brl(p.quanto_aportar.renda_alvo)} por mês durante ${p.quanto_aportar.anos_receber} anos, precisa de</span><span class="v">${brl(p.quanto_aportar.capital_necessario)}</span></div><div class="item"><span>Aporte mensal necessário</span><span class="v">${brl(p.quanto_aportar.aporte_mensal)}</span></div>` : '';
    return `<div class="card" id="apo-prev"><h3 style="margin:0 0 6px">Previdência privada</h3>`
      + `<div class="item"><span>Juntando em ${p.acumulado.anos} anos</span><span class="v">${brl(p.acumulado.bruto)} (já descontada a inflação)</span></div>`
      + `<div style="margin-top:8px"><b>PGBL ou VGBL?</b> <span class="chip">${esc(g.recomendacao)}</span></div><div class="fraco">${esc(g.motivo)}</div>`
      + `<div class="item"><span>Você pode abater até (12% da renda)</span><span class="v">${brl(g.limite_dedutivel_anual)} por ano</span></div>`
      + `<div class="item"><span>Imposto que deixa de pagar (estimativa)</span><span class="v">${brl(g.economia_ir_anual)} por ano</span></div>`
      + `<div style="margin-top:8px"><b>Tabela regressiva × progressiva</b></div>`
      + `<div class="item"><span>Regressiva (${t.regressiva.aliquota_pct}%)</span><span class="v">PGBL ${brl(t.regressiva.imposto_pgbl)} · VGBL ${brl(t.regressiva.imposto_vgbl)}</span></div>`
      + `<div class="item"><span>Progressiva (tabela do IR)</span><span class="v">PGBL ${brl(t.progressiva.imposto_total_pgbl)} · VGBL ${brl(t.progressiva.imposto_total_vgbl)}</span></div>`
      + `<div class="fraco">Paga menos: PGBL na ${esc(t.menor_imposto_pgbl)}, VGBL na ${esc(t.menor_imposto_vgbl)}. ${esc(t.dica)}</div>${quanto}`
      + `${lista(p.suposicoes)}<div class="fraco">${esc(p.aviso)}</div></div>`;
  }

  // ---------- Quanto guardar ----------
  function cartaoGuardar(q) {
    if (!q) return '<div class="card" id="apo-guardar"><h3 style="margin:0 0 6px">Quanto guardar para me aposentar</h3><p class="fraco">Diga quanto quer receber por mês e eu somo INSS + FGTS + investimentos.</p></div>';
    const ind = q.independencia;
    return `<div class="card" id="apo-guardar"><h3 style="margin:0 0 6px">Quanto guardar para me aposentar</h3>`
      + `<div class="item"><span>Você quer receber</span><span class="v">${brl(q.renda_desejada)} por mês</span></div>`
      + `<div class="item"><span>INSS estimado${q.inss_regra ? ` (${esc(q.inss_regra)})` : ''}</span><span class="v">${brl(q.inss_estimado)}</span></div>`
      + `<div class="item"><span>Falta cobrir</span><span class="v">${brl(q.gap_mensal)} por mês</span></div>`
      + (q.mensagem ? `<div class="fraco">${esc(q.mensagem)}</div>` : '')
      + (ind ? `<div class="item"><span>Patrimônio necessário</span><span class="v">${brl(ind.alvo)}</span></div>`
        + `<div class="item"><span>Você tem hoje (investimentos + FGTS na data)</span><span class="v">${brl(q.investimentos_hoje + q.fgts_na_data)}</span></div>`
        + `<div class="item"><span>Falta juntar</span><span class="v">${brl(ind.falta)}</span></div>`
        + (q.aporte_mensal_necessario != null ? `<div class="item"><span>Guardar por mês até se aposentar (${esc(q.anos_ate_aposentar)} anos)</span><span class="grande" style="font-size:20px">${brl(q.aporte_mensal_necessario)}</span></div>` : '')
        + (ind.nota ? `<div class="fraco">${esc(ind.nota)}</div>` : '') : '')
      + `${lista(q.avisos)}</div>`;
  }

  // ---------- Formulários ----------
  const SEXOS = { F: 'Mulher', M: 'Homem' };
  function camposPerfil(p) {
    p = p || {};
    const a19 = Math.floor((p.tc_2019_meses || 0) / 12); const m19 = (p.tc_2019_meses || 0) % 12;
    const at = Math.floor((p.tc_total_meses || 0) / 12); const mt = (p.tc_total_meses || 0) % 12;
    return [
      { nome: 'nascimento', rotulo: 'Data de nascimento', tipo: 'date', valor: p.nascimento || '' },
      { nome: 'sexo', rotulo: 'Sexo (as regras do INSS mudam)', opcoes: opt(SEXOS, p.sexo || 'M') },
      { nome: 'tc2019_anos', rotulo: 'Contribuição até 13/11/2019: anos', tipo: 'number', valor: a19 }, { nome: 'tc2019_meses', rotulo: '… e meses', tipo: 'number', valor: m19 },
      { nome: 'total_anos', rotulo: 'Contribuição total até hoje: anos', tipo: 'number', valor: at }, { nome: 'total_meses', rotulo: '… e meses', tipo: 'number', valor: mt },
      { nome: 'media_salarial', rotulo: 'Média salarial (R$)', tipo: 'number', valor: p.media_salarial == null ? '' : p.media_salarial },
    ];
  }
  function corpoPerfil(d, extra) {
    const corpo = {
      nascimento: d.nascimento, sexo: d.sexo,
      tc_2019_meses: Math.round(n(d.tc2019_anos) * 12 + n(d.tc2019_meses)), tc_total_meses: Math.round(n(d.total_anos) * 12 + n(d.total_meses)),
    };
    if (d.media_salarial !== undefined && d.media_salarial !== '') corpo.media_salarial = Number(d.media_salarial);
    return Object.assign(corpo, extra || {});
  }
  function camposFgts(f) {
    f = f || {};
    return [
      { nome: 'saldo', rotulo: 'Saldo do FGTS (R$)', tipo: 'number', valor: f.saldo == null ? '' : f.saldo },
      { nome: 'deposito_mensal', rotulo: 'Depósito por mês (R$, deixe vazio para usar 8% do salário)', tipo: 'number', valor: f.deposito_mensal == null ? '' : f.deposito_mensal },
      { nome: 'tr_pct', rotulo: 'TR ao ano (%)', tipo: 'number', valor: f.tr_pct == null ? 0 : f.tr_pct },
      { nome: 'modalidade', rotulo: 'Modalidade de saque', opcoes: opt({ rescisao: 'Saque-rescisão', aniversario: 'Saque-aniversário' }, f.modalidade || 'rescisao') },
    ];
  }
  function corpoFgts(d) {
    const c = { saldo: Number(d.saldo) };
    if (d.deposito_mensal !== undefined && d.deposito_mensal !== '') c.deposito_mensal = Number(d.deposito_mensal);
    if (d.tr_pct !== undefined && d.tr_pct !== '') c.tr_pct = Number(d.tr_pct);
    if (d.modalidade) c.modalidade = d.modalidade;
    return c;
  }
  function camposPrev(p) {
    p = p || {};
    const v = (k, pad) => (p[k] == null ? pad : p[k]);
    return [
      { nome: 'renda_bruta_anual', rotulo: 'Renda bruta por ano (R$)', tipo: 'number', valor: v('renda_bruta_anual', '') },
      { nome: 'declaracao_completa', rotulo: 'Declaração do IR', opcoes: opt({ nao: 'Simplificada ou isento', sim: 'Completa' }, p.declaracao_completa ? 'sim' : 'nao') },
      { nome: 'aporte_mensal', rotulo: 'Aporte por mês (R$)', tipo: 'number', valor: v('aporte_mensal', 0) },
      { nome: 'saldo_atual', rotulo: 'Saldo atual da previdência (R$)', tipo: 'number', valor: v('saldo_atual', 0) },
      { nome: 'anos', rotulo: 'Faltam quantos anos para se aposentar', tipo: 'number', valor: v('anos', 20) },
      { nome: 'taxa_real_ano', rotulo: 'Rendimento real por ano (%, já sem inflação)', tipo: 'number', valor: v('taxa_real_ano', 4) },
      { nome: 'renda_alvo', rotulo: 'Quanto quer receber por mês (R$, hoje)', tipo: 'number', valor: v('renda_alvo', '') },
      { nome: 'outras_rendas_mensais', rotulo: 'Outras rendas por mês na aposentadoria (R$, ex.: INSS)', tipo: 'number', valor: v('outras_rendas_mensais', 0) },
    ];
  }
  function corpoPrev(d) {
    const c = { declaracao_completa: d.declaracao_completa === 'sim' };
    for (const k of ['renda_bruta_anual', 'aporte_mensal', 'saldo_atual', 'anos', 'taxa_real_ano', 'renda_alvo', 'outras_rendas_mensais']) if (d[k] !== undefined && d[k] !== '') c[k] = Number(d[k]);
    return c;
  }
  function camposGuardar(g) {
    g = g || {};
    const v = (k, pad) => (g[k] == null ? pad : g[k]);
    return [
      { nome: 'renda_desejada', rotulo: 'Quanto quer receber por mês (R$, valores de hoje)', tipo: 'number', valor: v('renda_desejada', '') },
      { nome: 'aporte', rotulo: 'Quanto já guarda por mês (R$)', tipo: 'number', valor: v('aporte', 0) },
      { nome: 'taxa_ano', rotulo: 'Rendimento por ano (%)', tipo: 'number', valor: v('taxa_ano', 8) },
      { nome: 'inflacao_ano', rotulo: 'Inflação por ano (%)', tipo: 'number', valor: v('inflacao_ano', 4) },
    ];
  }
  function corpoGuardar(d) {
    const c = {};
    for (const k of ['renda_desejada', 'aporte', 'taxa_ano', 'inflacao_ano']) if (d[k] !== undefined && d[k] !== '') c[k] = Number(d[k]);
    return c;
  }
  function camposImovel(i) {
    i = i || {};
    return [
      { nome: 'saldo_devedor', rotulo: 'Saldo devedor do financiamento (R$)', tipo: 'number', valor: i.saldo_devedor == null ? '' : i.saldo_devedor },
      { nome: 'prazo_meses', rotulo: 'Prazo que falta (meses)', tipo: 'number', valor: i.prazo_meses == null ? '' : i.prazo_meses },
      { nome: 'taxa_ano', rotulo: 'Juros do financiamento ao ano (%)', tipo: 'number', valor: i.taxa_ano == null ? '' : i.taxa_ano },
    ];
  }
  function corpoImovel(d) {
    return { saldo_devedor: Number(d.saldo_devedor), prazo_meses: Number(d.prazo_meses), taxa_ano: Number(d.taxa_ano || 0) };
  }

  MB.apos = { esc, brl, dataBr, anosMeses, cartaoInss, cartaoFgts, cartaoPrev, cartaoGuardar, camposPerfil, corpoPerfil, camposFgts, corpoFgts, camposPrev, corpoPrev, camposGuardar, corpoGuardar, camposImovel, corpoImovel };
})();
