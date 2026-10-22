'use strict';
// KERNEX Nutri: lista de contas/clientes para o sistema de nutricionistas (usada por netlify/functions/nutri.js).
// Para criar ou ativar uma conta nova: acrescente ou atualize o código do primeiro acesso
// guardado SÓ como hash (PBKDF2). Gere com: node scripts/nutri-codigo.js
// Se a conta não tem hash de senha/código, o painel exibe aviso informando que a conta ainda não foi ativada.

const NUTRIS = {
  adriano: {
    nome: 'Adriano Blumer',
    versao: 1,
    codigo_salt: 'abcb8259e73eaca9144199d35082109e',
    codigo_hash: '1b052f1ed3b42b719611c0531b0ca3d8d9d5580d8ed0ff7d27f9b3450174b5c6',
    config: {
      nome: 'Adriano Blumer',
      crn: '', // sem dados inventados
      whatsapp: '5511999994185', // editável pelo painel (só exibe se preenchido)
      email: 'nutri.adrianoblumer@gmail.com',
      endereco: 'Rua Domingos de Morais, 2781 - CJ 802, Vila Mariana, São Paulo - SP, 04035-001',
      biolink: 'https://biolink.website/nutriadriano',
      instagram: 'https://www.instagram.com/adrianoblumer_nutri',
      tiktok: 'https://www.tiktok.com/@adrianoblumer_nutri',
      youtube: 'https://www.youtube.com/@adrianoblumer',
      horario_resposta: 'Segunda, quarta e sexta: 10h às 16h | Terça e quinta: 11h às 19h',
      mensagem_instagram: 'Olá, tudo bem? Deixe sua mensagem completa, com as dúvidas e solicitações e responderei dentro dos horários abaixo...\nSegunda, quarta e sexta: 10h às 16h\nTerça e quinta: 11h às 19h\n\nCaso tenha dúvida sobre agendamentos e informações de consulta, pode enviar ou acesse: https://biolink.website/nutriadriano',
      aviso: '',
    },
  },
};

module.exports = { NUTRIS };
