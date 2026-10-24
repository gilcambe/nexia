'use strict';
// NEXIA Locação: lista de contas/clientes de locação por dia (usada por netlify/functions/locacao.js).
// Para criar uma conta de locação nova: acrescente uma entrada aqui com o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/locacao-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const LOCACOES = {
  splash: {
    nome: 'Splash Eventos',
    // Senhas iniciais (só hash): ADMIN01 (dono do sistema) e AMANDA01 (a dona). Valem até alguém trocar a senha no painel ("Sua Conta").
    senhas_iniciais: [
      { salt: 'd3451e7f34a8549290d4cda5b069c80b', hash: '0752321472aaccfe5e23961d97417d85e6b25587c15a30b6f71e8a2ac650a35c' },
      { salt: 'c7d54e0a28d81cf3d477ef61d83a438d', hash: '692ff6b63c04bd3227af63f93b72136ec186fe14f7938d5cbd157b85299318b9' },
    ],
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
  // Conta de TESTE do dono (dados fictícios, separada da conta real da Amanda). Código de primeiro acesso: ADMIN01.
  'splash-teste': {
    nome: 'Splash TESTE',
    versao: 1,
    codigo_salt: '741f44f11bf2f1e6e9718acc2773a4b8',
    codigo_hash: 'd8f233466c67103e1dbc729a74542adf852c7cbef2a5c5a3fa19f9c02f6f2225',
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
};

module.exports = { LOCACOES };
