(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node, CommonJS
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.BezsanFontes = factory();
  }
}(this, function () {
  'use strict';

  // Portais de leilões suportados
  const PORTAIS = {
    caixa: 'https://www.caixa.gov.br/Leiloes',
    bb: 'https://www.bb.com.br/pt-br/empresas/leiloes',
    santander: 'https://www.santander.com.br/empresas/leiloes',
    itau: 'https://www.itau.com.br/servicos/leiloes',
    bradesco: 'https://www.bradesco.com.br/servicos/leiloes',
    zuk: 'https://www.zuk.com.br/leiloes',
    megaLeiloes: 'https://www.megaleiloes.com.br',
    sold: 'https://www.sold.com.br/leiloes',
    frazao: 'https://www.frazao.com.br/leiloes',
    biasi: 'https://www.biasi.com.br/leiloes',
    lanceJudicial: 'https://www.lancejudicial.com.br',
    tjsp: 'https://www.tjsp.jus.br/consulta-leilao'
  };

  // Lista de Unidades Federativas (Estados) do Brasil
  const UFS = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ];

  /**
   * Retorna a URL da página de leilões da Caixa para a UF informada.
   * @param {string} uf - Sigla da Unidade Federativa (ex.: 'SP')
   * @returns {string} URL completa
   */
  function listaCaixa(uf) {
    if (!uf) return PORTAIS.caixa;
    const sigla = uf.trim().toUpperCase();
    if (!UFS.includes(sigla)) return PORTAIS.caixa;
    return `${PORTAIS.caixa}/${sigla.toLowerCase()}`;
  }

  /**
   * Monta a URL de consulta de IPTU para a cidade e UF informadas.
   * @param {string} cidade - Nome da cidade
   * @param {string} uf - Sigla da UF
   * @returns {string} URL de consulta IPTU
   */
  function consultaIptu(cidade, uf) {
    if (!cidade || !uf) return '';
    const sigla = uf.trim().toUpperCase();
    if (!UFS.includes(sigla)) return '';
    const city = encodeURIComponent(cidade.trim());
    return `${PORTAIS.caixa}/iptu/${sigla.toLowerCase()}/${city}`;
  }

  // Exporta o objeto esperado
  return {
    PORTAIS,
    listaCaixa,
    UFS,
    consultaIptu
  };
}));
