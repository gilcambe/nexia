/* NEXIA · Bezsan — lê a lista de imóveis da Caixa (Lista_imoveis_<UF>.csv) e filtra.
   O site da Caixa bloqueia robôs (captcha), então quem baixa a lista é a pessoa, no navegador dela;
   a Central só lê o arquivo que ela escolheu. Nada sai do aparelho. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.BezsanCaixa = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
  function urlLista(uf) {
    uf = String(uf || '').toUpperCase();
    return UFS.indexOf(uf) >= 0 ? 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_' + uf + '.csv' : null;
  }

  var semAcento = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };

  /** "160.000,00" → 160000; "44.83" → 44.83; "1.234" → 1234. */
  function numero(v) {
    var s = String(v == null ? '' : v).replace(/[R$%\s]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  var COLUNAS = {
    numero: ['n do imovel', 'no do imovel', 'n° do imovel', 'numero do imovel'],
    uf: ['uf'], cidade: ['cidade'], bairro: ['bairro'], endereco: ['endereco'],
    preco: ['preco'], avaliacao: ['valor de avaliacao'], desconto: ['desconto'], financiamento: ['financiamento'],
    descricao: ['descricao'], modalidade: ['modalidade de venda'], link: ['link de acesso'],
  };

  /** Texto do CSV → lista de imóveis. Aceita o cabeçalho em qualquer linha e colunas em qualquer ordem. */
  function lerCsv(texto) {
    var linhas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/);
    var iCab = -1, mapa = null;
    for (var i = 0; i < Math.min(linhas.length, 30); i++) {
      var cab = linhas[i].split(';').map(function (c) { return semAcento(c).replace(/[º°]/g, '').replace(/\bn\b\.?/, 'n'); });
      var m = {};
      Object.keys(COLUNAS).forEach(function (k) {
        var j = cab.findIndex(function (c) { return COLUNAS[k].some(function (nome) { return c === semAcento(nome).replace(/[º°]/g, ''); }); });
        if (j >= 0) m[k] = j;
      });
      if (m.cidade !== undefined && m.preco !== undefined && m.endereco !== undefined) { iCab = i; mapa = m; break; }
    }
    if (!mapa) return [];
    var lista = [];
    for (var k = iCab + 1; k < linhas.length; k++) {
      if (!linhas[k].trim()) continue;
      var c = linhas[k].split(';');
      var pega = function (campo) { return mapa[campo] === undefined ? '' : String(c[mapa[campo]] || '').trim(); };
      var preco = numero(pega('preco'));
      if (!preco) continue;
      var avaliacao = numero(pega('avaliacao'));
      var desconto = pega('desconto') ? numero(pega('desconto')) : (avaliacao ? Math.round((1 - preco / avaliacao) * 10000) / 100 : 0);
      var link = pega('link');
      lista.push({
        numero: pega('numero').replace(/\D/g, ''), uf: pega('uf').toUpperCase(), cidade: pega('cidade'), bairro: pega('bairro'),
        endereco: pega('endereco'), preco: preco, avaliacao: avaliacao, desconto: desconto,
        financiamento: /^s/i.test(pega('financiamento')), descricao: pega('descricao'), modalidade: pega('modalidade'),
        link: /^https:\/\/venda-imoveis\.caixa\.gov\.br\//.test(link) ? link : '',
      });
    }
    return lista;
  }

  /** filtros: { cidade, bairro, precoMax, descontoMin, modalidade, texto } */
  function filtrar(lista, f) {
    f = f || {};
    var cidade = semAcento(f.cidade), bairro = semAcento(f.bairro), modalidade = semAcento(f.modalidade), texto = semAcento(f.texto);
    var precoMax = numero(f.precoMax), descontoMin = numero(f.descontoMin);
    return (lista || []).filter(function (i) {
      if (cidade && semAcento(i.cidade).indexOf(cidade) < 0) return false;
      if (bairro && semAcento(i.bairro).indexOf(bairro) < 0) return false;
      if (modalidade && semAcento(i.modalidade).indexOf(modalidade) < 0) return false;
      if (precoMax && i.preco > precoMax) return false;
      if (descontoMin && i.desconto < descontoMin) return false;
      if (texto && semAcento(i.descricao + ' ' + i.endereco).indexOf(texto) < 0) return false;
      return true;
    }).sort(function (a, b) { return b.desconto - a.desconto; });
  }

  function modalidades(lista) {
    var vistas = {};
    (lista || []).forEach(function (i) { if (i.modalidade) vistas[i.modalidade] = true; });
    return Object.keys(vistas).sort();
  }

  return { UFS: UFS, urlLista: urlLista, numero: numero, lerCsv: lerCsv, filtrar: filtrar, modalidades: modalidades };
});
