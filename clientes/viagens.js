'use strict';
// NEXIA Viagens: lista de contas/clientes de viagens por dia (usada por netlify/functions/viagens.js).
// Para criar uma conta de viagem nova: acrescente uma entrada aqui com o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/viagem-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const VIAGENS = {
  viajantepro: {
    nome: 'Viajante Pro',
    versao: 1,
    codigo_salt: 'f880ae6ea10238de715a549b8abb05f2',
    codigo_hash: 'e2d165583a27c742b72aff5b13db118428b7fb093222087a37692a24dfe75a38',
    config: {
      nome: 'Viajante Pro Viagens',
      whatsapp: '5511941247074', // do perfil do Instagram (o dono confere e pode trocar no painel)
      instagram: 'viajantepro',
      destinos: [
        { id: 'nordeste', nome: 'Nordeste Brasileiro', descricao: 'Pacotes para o Nordeste com praias e cultura' },
        { id: 'sudeste', nome: 'Sudeste Brasileiro', descricao: 'Pacotes para o Sudeste com cidades históricas e natureza' },
        { id: 'sul', nome: 'Sul Brasileiro', descricao: 'Pacotes para o Sul com montanhas e gastronomia' },
      ],
      // Opções extras que o cliente escolhe no pedido. valor 0 = "valor combinado com o viajante" (ele define o preço no painel).
      extras: [
        { id: 'seguro', nome: 'Seguro Viagem', descricao: 'Seguro completo para sua viagem', valor: 0, ativo: true },
        { id: 'translado', nome: 'Translado', descricao: 'Transporte do aeroporto para o hotel', valor: 0, ativo: true },
      ],
      sinal: { tipo: 'percentual', valor: 0 }, // 0 = o dono define no painel (sem valor inventado)
      pix: { chave: '', titular: '' },
      prazo_horas: 48,
      antecedencia_dias: 0,
      dias_a_frente: 540,
      aviso: '',
      mensagem_pedido: 'Pedido de viagem recebido com sucesso! Aguarde o contato para confirmação do sinal.',
    },
  },
  'viagem-teste': {
    nome: 'Viagem TESTE',
    versao: 1,
    // Código de primeiro acesso DESATIVADO em 11/11/2026 (o valor tinha vazado em comentário público). Para reativar: node scripts/locacao-codigo.js ou viagem equivalente.
    config: {
      nome: 'Viagem TESTE (não é o site real)',
      whatsapp: '5511941247074',
      instagram: 'viajantepro',
      destinos: [
        { id: 'nordeste', nome: 'Nordeste Brasileiro', descricao: 'Pacotes para o Nordeste com praias e cultura' },
        { id: 'sudeste', nome: 'Sudeste Brasileiro', descricao: 'Pacotes para o Sudeste com cidades históricas e natureza' },
      ],
      extras: [
        { id: 'seguro', nome: 'Seguro Viagem', descricao: 'Seguro completo para sua viagem', valor: 0, ativo: true },
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

module.exports = { VIAGENS };
