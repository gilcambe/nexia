/* NEXIA · Bezsan — conta de viabilidade de um imóvel de leilão ("vale a pena ou não").
   Usado pela Central de Leilões (navegador) e pelos testes (Node). Sem dependências.
   Todos os valores em reais; percentuais como número (5 = 5%). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.BezsanCalculo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Pontos de partida (o usuário muda cada um na tela). Valores de mercado comuns, não regra.
  var PADRAO = {
    comissao_pct: 5,          // comissão do leiloeiro (em geral 5%; venda direta da Caixa não tem)
    itbi_pct: 3,              // ITBI (São Paulo 3%; cada cidade tem a sua alíquota)
    registro_pct: 1.5,        // escritura/carta + registro em cartório, aproximado
    outros: 1500,             // certidões, matrícula atualizada, despachante
    desocupacao_ocupado: 15000, // advogado + custas se o imóvel estiver ocupado
    prazo_meses: 12,          // da compra até a venda
    corretagem_pct: 6,        // comissão do corretor na revenda
    imposto_pct: 15,          // IR sobre ganho de capital (pessoa física)
    roi_alvo_pct: 20,         // lucro mínimo desejado sobre o capital, no período
  };

  function num(v, padrao) {
    if (typeof v === 'string') v = v.replace(/[R$\s.]/g, '').replace(',', '.');
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : (padrao || 0);
  }
  function arred(n) { return Math.round(n * 100) / 100; }

  /** Lê a entrada (aceita "R$ 1.234,56") e completa com os padrões. */
  function normalizar(e) {
    e = e || {};
    var p = function (k) { return e[k] === undefined || e[k] === '' || e[k] === null ? PADRAO[k] : num(e[k], PADRAO[k]); };
    var avaliacao = num(e.avaliacao);
    return {
      lance: num(e.lance),
      avaliacao: avaliacao,
      venda: e.venda === undefined || e.venda === '' || e.venda === null ? avaliacao : num(e.venda),
      comissao_pct: p('comissao_pct'),
      itbi_pct: p('itbi_pct'),
      registro_pct: p('registro_pct'),
      outros: p('outros'),
      debitos: num(e.debitos_iptu) + num(e.debitos_condominio) + num(e.debitos_outros),
      desocupacao: e.desocupacao === undefined || e.desocupacao === '' || e.desocupacao === null ? (e.ocupado ? PADRAO.desocupacao_ocupado : 0) : num(e.desocupacao),
      reforma: num(e.reforma),
      mensal: num(e.mensal_condominio) + num(e.mensal_iptu) + num(e.mensal_outros),
      prazo_meses: Math.max(1, Math.min(120, p('prazo_meses'))),
      corretagem_pct: p('corretagem_pct'),
      imposto_pct: p('imposto_pct'),
      roi_alvo_pct: p('roi_alvo_pct'),
      ocupado: !!e.ocupado,
      alertas: Array.isArray(e.alertas) ? e.alertas.filter(Boolean).map(String) : [],
    };
  }

  /** Conta completa. Devolve custos, lucro, retorno, lance máximo e o veredito. */
  function calcular(entrada) {
    var e = normalizar(entrada);
    var taxaSobreLance = (e.comissao_pct + e.itbi_pct + e.registro_pct) / 100;
    var comissao = e.lance * e.comissao_pct / 100;
    var itbi = e.lance * e.itbi_pct / 100;
    var registro = e.lance * e.registro_pct / 100;
    var manutencao = e.mensal * e.prazo_meses;
    var fixos = e.outros + e.debitos + e.desocupacao + e.reforma + manutencao; // não dependem do lance
    var aquisicao = e.lance + comissao + itbi + registro + e.outros + e.debitos;
    var total = e.lance * (1 + taxaSobreLance) + fixos;
    var corretagem = e.venda * e.corretagem_pct / 100;
    var receita = e.venda - corretagem;
    var bruto = receita - total;
    var imposto = bruto > 0 ? bruto * e.imposto_pct / 100 : 0;
    var liquido = bruto - imposto;
    var roi = total > 0 ? liquido / total : 0;
    var roiAnual = total > 0 && roi > -1 ? Math.pow(1 + roi, 12 / e.prazo_meses) - 1 : -1;
    var desconto = e.avaliacao > 0 ? 1 - e.lance / e.avaliacao : 0;

    // Lance máximo para ter o lucro mínimo desejado: (R − C)(1 − t) = alvo·C  →  C = R(1 − t)/(alvo + 1 − t)
    var t = e.imposto_pct / 100, alvo = e.roi_alvo_pct / 100;
    var custoMax = receita * (1 - t) / (alvo + 1 - t);
    var lanceMax = Math.max(0, (custoMax - fixos) / (1 + taxaSobreLance));
    // Lance em que não há lucro nem prejuízo.
    var lanceEmpate = Math.max(0, (receita - fixos) / (1 + taxaSobreLance));

    var motivos = [];
    var nivel; // 2 = vale a pena, 1 = atenção, 0 = não vale
    if (e.lance <= 0 || e.venda <= 0) { nivel = 0; motivos.push('Preencha o lance e o valor de venda.'); }
    else if (liquido <= 0) { nivel = 0; motivos.push('Dá prejuízo com estes números.'); }
    else if (roiAnual >= 0.25 && desconto >= 0.3) { nivel = 2; motivos.push('Retorno de ' + pct(roiAnual) + ' ao ano e desconto de ' + pct(desconto) + ' sobre a avaliação.'); }
    else if (roiAnual >= 0.12) { nivel = 1; motivos.push('Retorno de ' + pct(roiAnual) + ' ao ano' + (desconto < 0.3 ? ', com desconto de só ' + pct(desconto) + ' sobre a avaliação' : '') + '.'); }
    else { nivel = 0; motivos.push('Retorno baixo: ' + pct(roiAnual) + ' ao ano.'); }
    if (e.lance > lanceMax && e.lance > 0) motivos.push('O lance passa do máximo recomendado (' + reais(lanceMax) + ') para ' + e.roi_alvo_pct + '% de lucro.');
    if (e.ocupado) { motivos.push('Imóvel ocupado: conte com prazo e custo de desocupação.'); }
    if (e.alertas.length) motivos.push('Riscos encontrados nos documentos: ' + e.alertas.join('; ') + '.');
    if (nivel > 0 && (e.ocupado || e.alertas.length)) nivel -= 1;

    return {
      entrada: e,
      custos: {
        lance: arred(e.lance), comissao: arred(comissao), itbi: arred(itbi), registro: arred(registro), outros: arred(e.outros),
        debitos: arred(e.debitos), desocupacao: arred(e.desocupacao), reforma: arred(e.reforma), manutencao: arred(manutencao),
        aquisicao: arred(aquisicao), total: arred(total),
      },
      venda: { valor: arred(e.venda), corretagem: arred(corretagem), receita: arred(receita) },
      resultado: {
        lucro_bruto: arred(bruto), imposto: arred(imposto), lucro_liquido: arred(liquido),
        roi: roi, roi_anual: roiAnual, desconto: desconto,
        lance_maximo: arred(lanceMax), lance_empate: arred(lanceEmpate),
      },
      veredito: { nivel: nivel, texto: ['Não vale a pena', 'Atenção: só com cuidado', 'Vale a pena'][nivel], motivos: motivos },
    };
  }

  function pct(x) { return (Math.round(x * 1000) / 10).toLocaleString('pt-BR') + '%'; }
  function reais(x) { var n = Math.round(x); return (n < 0 ? '- ' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR'); }

  return { PADRAO: PADRAO, calcular: calcular, normalizar: normalizar, pct: pct, reais: reais };
});
