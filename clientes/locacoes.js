'use strict';
// NEXIA Locação: lista de contas/clientes de locação por dia (usada por netlify/functions/locacao.js).
// Para criar uma conta de locação nova: acrescente uma entrada aqui com o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/locacao-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const LOCACOES = {
  splash: {
    nome: 'Splash Eventos',
    versao: 1,
    codigo_salt: 'f880ae6ea10238de715a549b8abb05f2',
    codigo_hash: 'e2d165583a27c742b72aff5b13db118428b7fb093222087a37692a24dfe75a38',
    config: {
      nome: 'Splash Piscina e Lazer',
      whatsapp: '5511941247074', // do perfil do Instagram (a dona confere e pode trocar no painel)
      instagram: 'splash_santaadelia',
      unidades: [
        { id: 'santa-adelia', nome: 'Splash Santa Adélia', endereco: 'Região de São Mateus, zona leste de São Paulo (SP)' },
        { id: 'santa-barbara', nome: 'Splash Santa Bárbara', endereco: 'Região de São Mateus, zona leste de São Paulo (SP)', terceiro: true }, // unidade de outro dono: a Amanda recebe comissão (definida no painel)
      ],
      // Opções extras que o cliente escolhe no pedido. valor 0 = "valor combinado com a Amanda" (ela define o preço no painel).
      extras: [
        { id: 'decoracao', nome: 'Decoração', descricao: 'Decoração do espaço para a sua festa', valor: 0, ativo: true },
      ],
      sinal: { tipo: 'percentual', valor: 0 }, // 0 = a dona define no painel (sem valor inventado)
      pix: { chave: '', titular: '' },
      prazo_horas: 48,
      antecedencia_dias: 0,
      dias_a_frente: 540,
      aviso: '',
      mensagem_pedido: 'Pedido de reserva recebido com sucesso! Aguarde o contato para confirmação do sinal.',
    },
  },
  'splash-teste': {
    nome: 'Splash TESTE',
    versao: 1,
    // Código de primeiro acesso DESATIVADO em 11/11/2026 (o valor tinha vazado em comentário público). Para reativar: node scripts/locacao-codigo.js ou viagem equivalente.
    config: {
      nome: 'Splash TESTE (não é o site real)',
      whatsapp: '5511941247074',
      instagram: 'splash_santaadelia',
      unidades: [
        { id: 'santa-adelia', nome: 'Splash Santa Adélia', endereco: 'Endereço de teste, São Mateus (SP)' },
        { id: 'santa-barbara', nome: 'Splash Santa Bárbara', endereco: 'Endereço de teste, São Mateus (SP)' },
      ],
      extras: [
        { id: 'decoracao', nome: 'Decoração', descricao: 'Decoração do espaço para a sua festa', valor: 0, ativo: true },
      ],
      sinal: { tipo: 'percentual', valor: 30 },
      pix: { chave: '', titular: '' },
      prazo_horas: 48,
      antecedencia_dias: 0,
      dias_a_frente: 540,
      aviso: 'AMBIENTE DE TESTE',
      mensagem_pedido: 'Pedido de teste recebido com sucesso!',
    },
  },
  // KERNEX Eventos — conta de DEMONSTRAÇÃO do modelo (dados fictícios; vendas). Código de primeiro acesso: só com o dono (aqui só o hash).
  'demo-eventos': {
    nome: 'KERNEX Eventos (demonstração)',
    codigo_salt: '42bd65e145e76643122f0e9e99861b30',
    codigo_hash: '645e7b183ba64693dbfb5ff5fa575669972322a1c44d279c06a51db134276c5b',
    versao: 1,
    config: {
      nome: 'Espaço Exemplo — Eventos e Lazer',
      whatsapp: '5511944037259', // WhatsApp da KERNEX: quem testar a demonstração fala com a KERNEX
      instagram: '',
      unidades: [
        { id: 'unidade-1', nome: 'Unidade 1', endereco: 'Endereço de exemplo (demonstração)' },
        { id: 'unidade-2', nome: 'Unidade 2', endereco: 'Endereço de exemplo (demonstração)' },
      ],
      extras: [
        { id: 'decoracao', nome: 'Decoração', descricao: 'Decoração do espaço para a sua festa', valor: 0, ativo: true },
      ],
      sinal: { tipo: 'percentual', valor: 30 },
      pix: { chave: '', titular: '' },
      prazo_horas: 48,
      antecedencia_dias: 0,
      dias_a_frente: 365,
      aviso: 'DEMONSTRAÇÃO KERNEX — este espaço é fictício; os pedidos não são reservas reais.',
      mensagem_pedido: 'Pedido de demonstração recebido! Este espaço é fictício. Fale com a KERNEX para ter o seu.',
    },
  },
};

module.exports = { LOCACOES };
