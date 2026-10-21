'use strict';
// NEXIA Locação: lista de contas/clientes de locação por dia (usada por netlify/functions/locacao.js).
// Para criar uma conta de locação nova: acrescente uma entrada aqui com o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/locacao-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const LOCACOES = {
  splash: {
    nome: 'Splash Eventos',
    versao: 1,
    // Sem codigo_salt nem codigo_hash por padrão (o dono gera depois com scripts/locacao-codigo.js)
    config: {
      nome: 'Splash Eventos',
      whatsapp: '', // sem dados inventados
      unidades: [
        { id: 'santa-adelia', nome: 'Splash Santa Adélia' },
        { id: 'santa-barbara', nome: 'Splash Santa Bárbara' },
      ],
      sinal: { tipo: 'percentual', valor: 50 },
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
