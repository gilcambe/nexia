/* NEXIA · Bezsan — onde procurar imóveis de leilão (bancos, leiloeiros, tribunal) e como consultar o IPTU.
   Usado pela Central de Leilões (navegador, window.BezsanFontes) e pelos testes (Node). Sem dependências e sem rede. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.BezsanFontes = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PORTAIS = [
    { nome: 'Caixa — Venda de Imóveis', url: 'https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp', tipo: 'banco', dica: 'Imóveis da Caixa: venda direta, licitação aberta e leilões SFI.' },
    { nome: 'Banco do Brasil — Imóveis à venda', url: 'https://www.bb.com.br/site/pra-voce/imoveis/', tipo: 'banco', dica: 'Imóveis retomados pelo Banco do Brasil, com venda direta e leilão.' },
    { nome: 'Santander Imóveis', url: 'https://www.santanderimoveis.com.br/', tipo: 'banco', dica: 'Imóveis do Santander em leilão e venda direta.' },
    { nome: 'Itaú — Imóveis à venda', url: 'https://www.itau.com.br/imoveis-itau', tipo: 'banco', dica: 'Imóveis retomados pelo Itaú, muitos com financiamento.' },
    { nome: 'Bradesco — Imóveis', url: 'https://www.bradescoimoveis.com.br/', tipo: 'banco', dica: 'Imóveis do Bradesco em leilão e venda direta.' },
    { nome: 'Zuk', url: 'https://www.portalzuk.com.br/', tipo: 'leiloeiro', dica: 'Leilões de bancos e judiciais em todo o Brasil.' },
    { nome: 'Mega Leilões', url: 'https://www.megaleiloes.com.br/', tipo: 'leiloeiro', dica: 'Leilões judiciais e extrajudiciais de imóveis.' },
    { nome: 'Sold Leilões', url: 'https://www.sold.com.br/', tipo: 'leiloeiro', dica: 'Leilões de imóveis, veículos e bens de empresas.' },
    { nome: 'Frazão Leilões', url: 'https://www.frazaoleiloes.com.br/', tipo: 'leiloeiro', dica: 'Leilões judiciais e de bancos, forte em São Paulo.' },
    { nome: 'Biasi Leilões', url: 'https://www.biasileiloes.com.br/', tipo: 'leiloeiro', dica: 'Leilões judiciais e extrajudiciais de imóveis.' },
    { nome: 'Lance Judicial', url: 'https://www.lancejudicial.com.br/', tipo: 'leiloeiro', dica: 'Leilões judiciais de imóveis em vários estados.' },
    { nome: 'TJSP — Leilões judiciais (e-SAJ consulta de processos)', url: 'https://esaj.tjsp.jus.br/cpopg/open.do', tipo: 'tribunal', dica: 'Confira o processo do leilão judicial pelo número.' }
  ];

  var UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

  function sigla(uf) { var s = String(uf || '').trim().toUpperCase(); return UFS.indexOf(s) >= 0 ? s : null; }
  function simples(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); }

  // Planilha oficial da Caixa com todos os imóveis à venda no estado.
  function listaCaixa(uf) {
    var s = sigla(uf);
    return s ? 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_' + s + '.csv' : null;
  }

  var CIDADES = {
    'sao paulo|SP': {
      url: 'https://www.prefeitura.sp.gov.br/cidade/secretarias/fazenda/servicos/iptu/',
      passos: ['Abra a página da Prefeitura de São Paulo.', 'Escolha emitir certidão de débitos ou 2ª via do IPTU.', 'Digite o número do contribuinte (SQL) que está no edital ou na matrícula.', 'Anote o total em aberto e digite na Central.']
    },
    'rio de janeiro|RJ': {
      url: 'https://carioca.rio/servicos/certidao-de-situacao-fiscal-e-enfiteutica-do-imovel/',
      passos: ['Abra a página da Prefeitura do Rio (Carioca Digital).', 'Peça a certidão de situação fiscal do imóvel.', 'Digite a inscrição imobiliária que está no edital ou no carnê.', 'Anote o total em aberto e digite na Central.']
    },
    'belo horizonte|MG': {
      url: 'https://prefeitura.pbh.gov.br/fazenda/iptu',
      passos: ['Abra a página do IPTU da Prefeitura de Belo Horizonte.', 'Escolha certidão de débitos ou 2ª via do IPTU.', 'Digite o índice cadastral do imóvel que está no edital ou no carnê.', 'Anote o total em aberto e digite na Central.']
    }
  };

  function consultaIptu(cidade, uf) {
    var conhecida = CIDADES[simples(cidade) + '|' + String(uf || '').trim().toUpperCase()];
    if (conhecida) return { url: conhecida.url, passos: conhecida.passos.slice() };
    return {
      url: 'https://www.google.com/search?q=' + encodeURIComponent('certidão negativa de débitos IPTU prefeitura ' + String(cidade || '').trim() + ' ' + String(uf || '').trim()),
      passos: ['Abra o site da prefeitura da cidade do imóvel.', 'Procure "certidão de débitos imobiliários" ou "2ª via do IPTU".', 'Use o número de inscrição do imóvel (está no edital, no carnê ou na matrícula).', 'Anote o total em aberto e digite na Central.']
    };
  }

  return { PORTAIS: PORTAIS, listaCaixa: listaCaixa, UFS: UFS, consultaIptu: consultaIptu };
});
