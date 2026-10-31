'use strict';
// NEXIA Viagens: lista de contas/clientes de viagens por dia (usada por netlify/functions/viagens.js).
// Para criar uma conta de viagem nova: acrescente uma entrada aqui com o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/viagem-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const VIAGENS = {
  viajantepro: {
    nome: 'Viajante Pro',
    // Senhas iniciais (só hash): ADMIN01 (dono do sistema) e VIAJANTE01 (o dono). Valem até alguém trocar a senha no painel ("Sua Conta").
    senhas_iniciais: [
      { salt: 'd3451e7f34a8549290d4cda5b069c80b', hash: '0752321472aaccfe5e23961d97417d85e6b25587c15a30b6f71e8a2ac650a35c' },
      { salt: '35fce0ac05eb77d81226cb448b58fc8c', hash: '3fce054c8c8429bbe1597656e9d715bbdfa0acb7fb2cb5f4291d2218e5cc3090' },
    ],
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
  // Conta de TESTE do dono (dados fictícios, separada da conta real do Viajante Pro). Código de primeiro acesso: ADMIN01.
  'viagem-teste': {
    nome: 'Viagem TESTE',
    versao: 1,
    codigo_salt: '741f44f11bf2f1e6e9718acc2773a4b8',
    codigo_hash: 'd8f233466c67103e1dbc729a74542adf852c7cbef2a5c5a3fa19f9c02f6f2225',
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
