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
    caixa: { url: 'https://www.caixa.gov.br/Leiloes', tipo: 'Leilão/Venda Direta' },
    bb: { url: 'https://www.bb.com.br/pt-br/empresas/leiloes', tipo: 'Leilão' },
    santander: { url: 'https://www.santander.com.br/empresas/leiloes', tipo: 'Leilão' },
    itau: { url: 'https://www.itau.com.br/servicos/leiloes', tipo: 'Leilão' },
    bradesco: { url: 'https://www.bradesco.com.br/servicos/leiloes', tipo: 'Leilão' },
    zuk: { url: 'https://www.zuk.com.br/leiloes', tipo: 'Leilão' },
    megaLeiloes: { url: 'https://www.megaleiloes.com.br', tipo: 'Leilão' },
    sold: { url: 'https://www.sold.com.br/leiloes', tipo: 'Leilão' },
    frazao: { url: 'https://www.frazao.com.br/leiloes', tipo: 'Leilão' },
    biasi: { url: 'https://www.biasi.com.br/leiloes', tipo: 'Leilão' },
    lanceJudicial: { url: 'https://www.lancejudicial.com.br', tipo: 'Leilão' },
    tjsp: { url: 'https://www.tjsp.jus.br/consulta-leilao', tipo: 'Consulta' }
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
    const base = PORTAIS.caixa.url;
    if (!uf) return base;
    const sigla = uf.trim().toUpperCase();
    if (!UFS.includes(sigla)) return base;
    return `${base}/${sigla.toLowerCase()}`;
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
    const base = PORTAIS.caixa.url;
    return `${base}/iptu/${sigla.toLowerCase()}/${city}`;
  }

  // Exporta o objeto esperado
  return {
    PORTAIS,
    listaCaixa,
    UFS,
    consultaIptu
  };
}));
