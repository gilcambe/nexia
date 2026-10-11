/* NEXIA · Bezsan — passo a passo de um imóvel de leilão, da busca à entrega das chaves.
   Linguagem simples para o investidor. Regras "em geral": cada edital manda no seu leilão. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.BezsanEtapas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FASES = [
    {
      id: 'busca', titulo: '1. Buscar o imóvel', passos: [
        { id: 'perfil', titulo: 'Definir o perfil', texto: 'Cidade, bairro, tipo (apartamento, casa, terreno), quanto há de capital e se vai revender ou alugar.' },
        { id: 'portais', titulo: 'Procurar nos portais', texto: 'Caixa (venda direta, licitação e leilão), outros bancos e leiloeiros judiciais. A Central filtra a lista da Caixa por cidade, preço e desconto.' },
        { id: 'triagem', titulo: 'Fazer a primeira triagem', texto: 'Descartar desconto pequeno, imóvel com problema visível na descrição e lugar onde não há procura para revenda.' },
      ],
    },
    {
      id: 'edital', titulo: '2. Ler o edital', passos: [
        { id: 'tipo', titulo: 'Saber o tipo de leilão', texto: 'Judicial (ordem de um juiz, num processo), extrajudicial (banco retomou por falta de pagamento, Lei 9.514/97) ou venda direta.' },
        { id: 'datas', titulo: 'Anotar datas e valores', texto: '1ª e 2ª praça (ou 1º e 2º leilão), lance mínimo de cada uma, valor de avaliação e horário de encerramento.' },
        { id: 'pagamento', titulo: 'Ver as condições de pagamento', texto: 'À vista ou parcelado (no judicial, em geral 25% de entrada e o resto em até 30 meses, art. 895 do CPC), se aceita FGTS ou financiamento, e o prazo para pagar.' },
        { id: 'comissao', titulo: 'Ver a comissão do leiloeiro', texto: 'Em geral 5% sobre o lance, pagos por quem arremata, à parte do lance. Venda direta da Caixa normalmente não tem.' },
        { id: 'quempaga', titulo: 'Ver quem paga as dívidas', texto: 'IPTU, condomínio e outras dívidas: o edital diz se ficam com quem arremata. No judicial, em geral o IPTU antigo sai do valor do lance (art. 130 do CTN); condomínio costuma acompanhar o imóvel se o edital avisar.' },
        { id: 'ocupacao', titulo: 'Ver se está ocupado', texto: 'Ocupado pelo antigo dono ou por inquilino muda o prazo e o custo para ter a posse.' },
      ],
    },
    {
      id: 'documentos', titulo: '3. Conferir os documentos', passos: [
        { id: 'matricula', titulo: 'Tirar a matrícula atualizada', texto: 'Certidão de inteiro teor no cartório de registro de imóveis (pedido online em registradores.org.br). Conferir dono, área, penhoras, hipotecas, indisponibilidade e ações.' },
        { id: 'processo', titulo: 'Consultar o processo', texto: 'No judicial: ler o processo pelo número (a Central consulta a base pública do CNJ) e ver se há recurso, embargos ou pedido de anulação pendente.' },
        { id: 'certidoes', titulo: 'Tirar certidões do devedor', texto: 'Distribuidores cível, federal e trabalhista do antigo dono, para ver outras dívidas que possam disputar o imóvel.' },
        { id: 'iptu', titulo: 'Consultar a dívida de IPTU', texto: 'No site da prefeitura, com o número de inscrição do imóvel (está no edital, no carnê ou na matrícula).' },
        { id: 'condominio', titulo: 'Consultar a dívida de condomínio', texto: 'Pedir à administradora ou ao síndico a declaração de débitos da unidade.' },
        { id: 'visita', titulo: 'Visitar a região', texto: 'Ver o prédio por fora, a rua, a vizinhança e conversar com o porteiro. Imóvel ocupado em geral não pode ser visitado por dentro.' },
        { id: 'mercado', titulo: 'Pesquisar o preço de venda', texto: 'Comparar com imóveis parecidos à venda no mesmo bairro para estimar quanto vale de verdade.' },
      ],
    },
    {
      id: 'viabilidade', titulo: '4. Decidir se vale a pena', passos: [
        { id: 'conta', titulo: 'Fazer a conta', texto: 'Lance, comissão, ITBI, registro, dívidas, desocupação, reforma, condomínio e IPTU até vender, corretagem e imposto.' },
        { id: 'lancemax', titulo: 'Definir o lance máximo', texto: 'O maior lance que ainda dá o lucro desejado. Não passar dele na hora da disputa.' },
        { id: 'parecer', titulo: 'Ler o parecer', texto: 'Parecer automático da Central e, antes de dar lance, a opinião de um advogado.' },
      ],
    },
    {
      id: 'lance', titulo: '5. Dar o lance', passos: [
        { id: 'cadastro', titulo: 'Fazer o cadastro no leiloeiro', texto: 'Com antecedência: RG, CPF, comprovante de endereço e, às vezes, comprovante de renda. A aprovação pode levar dias.' },
        { id: 'habilitar', titulo: 'Habilitar-se no leilão', texto: 'Pedir a habilitação para aquele lote no site do leiloeiro antes do horário.' },
        { id: 'dinheiro', titulo: 'Deixar o dinheiro pronto', texto: 'O pagamento costuma ter prazo curto (até 24 horas no judicial; boleto da Caixa em poucos dias).' },
        { id: 'disputa', titulo: 'Disputar com calma', texto: 'Entrar alguns minutos antes, respeitar o lance máximo e guardar o comprovante do lance vencedor.' },
      ],
    },
    {
      id: 'arremate', titulo: '6. Depois de arrematar', passos: [
        { id: 'pagar', titulo: 'Pagar lance e comissão', texto: 'Dentro do prazo do edital. Atraso pode fazer perder o imóvel e o sinal.' },
        { id: 'auto', titulo: 'Assinar o auto de arrematação', texto: 'No judicial, o auto é assinado pelo juiz, leiloeiro e arrematante. Há um prazo de 10 dias para impugnações (art. 903 do CPC).' },
        { id: 'carta', titulo: 'Receber a carta ou a escritura', texto: 'Judicial: carta de arrematação expedida pelo juiz. Extrajudicial ou Caixa: escritura ou contrato com o banco.' },
        { id: 'itbi', titulo: 'Pagar o ITBI', texto: 'Imposto de transmissão da prefeitura (em São Paulo, 3%), emitido no site da prefeitura.' },
        { id: 'registro', titulo: 'Registrar no cartório', texto: 'Levar carta ou escritura e a guia do ITBI paga ao cartório de registro de imóveis. Só depois do registro o imóvel é seu no papel.' },
        { id: 'dividas', titulo: 'Acertar as dívidas', texto: 'Pagar ou pedir a baixa do IPTU e do condomínio, conforme o edital. No judicial, pedir ao juiz que as dívidas antigas saiam do valor do lance.' },
      ],
    },
    {
      id: 'posse', titulo: '7. Ter a posse e as chaves', passos: [
        { id: 'contato', titulo: 'Conversar com quem ocupa', texto: 'Muitas vezes um acordo (prazo e ajuda de mudança) sai mais rápido e barato que a Justiça.' },
        { id: 'imissao', titulo: 'Pedir a desocupação na Justiça, se precisar', texto: 'Judicial: mandado de imissão na posse no próprio processo. Extrajudicial: ação de reintegração de posse, com desocupação em 60 dias (art. 30 da Lei 9.514/97).' },
        { id: 'vistoria', titulo: 'Fazer a vistoria de entrada', texto: 'Fotos de tudo, leitura dos relógios de água, luz e gás no dia em que receber o imóvel.' },
        { id: 'fechaduras', titulo: 'Trocar as fechaduras', texto: 'Logo ao receber as chaves.' },
        { id: 'contas', titulo: 'Passar as contas para o seu nome', texto: 'Água, luz, gás, IPTU e condomínio.' },
        { id: 'chaves', titulo: 'Chaves entregues', texto: 'Imóvel registrado, desocupado e com as contas em dia. Pronto para reformar, alugar ou vender.' },
      ],
    },
  ];

  function todos() {
    var lista = [];
    FASES.forEach(function (f) { f.passos.forEach(function (p) { lista.push({ fase: f.id, id: f.id + '-' + p.id, titulo: p.titulo, texto: p.texto }); }); });
    return lista;
  }

  /** Quanto falta: { feitos, total, pct, proximo } a partir de { 'fase-passo': true }. */
  function progresso(marcados) {
    marcados = marcados || {};
    var lista = todos();
    var feitos = lista.filter(function (p) { return marcados[p.id] === true; }).length;
    var proximo = lista.filter(function (p) { return marcados[p.id] !== true; })[0] || null;
    return { feitos: feitos, total: lista.length, pct: Math.round((feitos / lista.length) * 100), proximo: proximo };
  }

  return { FASES: FASES, todos: todos, progresso: progresso };
});
