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
        { id: 'santa-barbara', nome: 'Splash Santa Bárbara', endereco: 'Região de São Mateus, zona leste de São Paulo (SP)' },
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
};

module.exports = { LOCACOES };
