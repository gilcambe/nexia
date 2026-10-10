'use strict';
// NEXIA Agenda: lista das agendas de clientes (usada por netlify/functions/agenda.js).
// Para criar uma agenda nova: acrescente uma entrada aqui, com o código do primeiro acesso guardado
// SÓ como hash (PBKDF2). Gere com: node scripts/agenda-codigo.js  (mostra o código uma vez e as linhas para colar).
// O código só serve enquanto a dona ainda não criou a senha. Esqueceu a senha? Gere um código novo e suba "versao".
// O resto (serviços, horários) a dona muda no próprio painel; "config" aqui é só o ponto de partida.

const TODO_DIA = [['06:00', '23:00']];

const AGENDAS = {
  studiolima: {
    nome: 'Studio Lima',
    versao: 1,
    codigo_salt: 'c148c392522001ab6aa3bf93bef2abf9',
    codigo_hash: 'fb2d6a80103503b13b8a1404a7961be3c6801ca8e9c461d998fc91d09b6f5852',
    config: {
      nome: 'Studio Lima',
      whatsapp: '5511960324530',
      // Decisão do Gil (02/09/2026): todos os dias, das 06:00 às 23:00, horários de 30 em 30 minutos.
      semana: { 0: TODO_DIA, 1: TODO_DIA, 2: TODO_DIA, 3: TODO_DIA, 4: TODO_DIA, 5: TODO_DIA, 6: TODO_DIA },
      intervalo: 30,
      antecedencia_horas: 2,
      dias_a_frente: 60,
      aviso: 'A Carolina confirma seu horário pelo WhatsApp. Se precisar desmarcar, avise com 24 horas de antecedência.',
      servicos: [
        'Limpeza de Pele', 'Hidratação Facial', 'Microagulhamento', 'Jato de Plasma', 'Radiofrequência Facial',
        'HIFU - Ultrassom Microfocado', 'Ultrassom Facial - Rejuvenescimento', 'Peeling Químico', 'Toxina Botulínica',
        'Hidragloss', 'Drenagem Linfática / Pós Operatório', 'Radiofrequência Corporal', 'Carboxiterapia',
        'Hidrolipoclasia', 'Criolipólise', 'Ultrassom Macrofocado', 'Tonificação Muscular', 'Ventosaterapia', 'Fototerapia',
        'Avaliação',
      ].map(nome => ({ nome, duracao: 60 })),
    },
  },

  // Agenda de teste (dados de mentira): usada pelo teste humano automático. O código é público de propósito.
  'agenda-teste': {
    nome: 'Agenda de Teste',
    versao: 1,
    codigo_salt: '00498ea74d1b0d70b4f350cf4a62acba',
    codigo_hash: '54ec012b8a1e2da7e86198c870f455099e36609e64a23c62bdeab1534f8b70e7',
    config: {
      nome: 'Agenda de Teste',
      whatsapp: '5511999998888',
      semana: { 0: [], 1: [['09:00', '18:00']], 2: [['09:00', '18:00']], 3: [['09:00', '18:00']], 4: [['09:00', '18:00']], 5: [['09:00', '18:00']], 6: [['09:00', '13:00']] },
      servicos: [{ nome: 'Corte', duracao: 30, preco: 'R$ 50' }, { nome: 'Coloração', duracao: 90, preco: 'R$ 180' }],
    },
  },
};

module.exports = { AGENDAS };
