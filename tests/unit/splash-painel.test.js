'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  escapeHtml,
  formatarDataBr,
  formatarMoeda,
  MapearEstado,
  montarMensagemWhatsApp,
  gerarCsvBackup,
  calcularDiasMes,
  gerarCsvFinanceiro
} = require('../../sites/splash/agenda/painel.js');

test('SPLASH-PAINEL 1: Leitura do HTML do painel da Amanda e metadados requeridos', () => {
  const htmlPath = path.join(__dirname, '../../sites/splash/agenda/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('<meta name="agenda-site" content="splash">'), 'deve conter o meta tag agenda-site');
  assert.ok(/<meta name="agenda-api" content="[^"]*\/api\/locacao">/.test(html), 'deve indicar a API /api/locacao');
  assert.ok(html.includes('Painel da Amanda'), 'deve conter o título do painel da Amanda');
  assert.ok(html.includes('id="aba-calendario"'), 'deve possuir a aba do calendário');
  assert.ok(html.includes('id="aba-pedidos"'), 'deve possuir a aba de pedidos');
  assert.ok(html.includes('id="aba-reservas"'), 'deve possuir a aba de reservas');
  assert.ok(html.includes('id="aba-config"'), 'deve possuir a aba de configurações');
  assert.ok(html.includes('id="badge-pedidos"'), 'deve possuir a bolinha de notificações de pedidos');
});

test('SPLASH-PAINEL 2: Sanitize/Escape HTML contra XSS de dados de clientes', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('João & Maria'), 'João &amp; Maria');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('SPLASH-PAINEL 3: Mapeamento de estados e cores do calendário', () => {
  const livre = MapearEstado('livre');
  assert.equal(livre.rotulo, 'Livre');

  const pedido = MapearEstado('pedido');
  assert.equal(pedido.rotulo, 'Pedido pendente');

  const aguardando = MapearEstado('aguardando_sinal');
  assert.equal(aguardando.rotulo, 'Aguardando sinal');

  const confirmado = MapearEstado('confirmado');
  assert.equal(confirmado.rotulo, 'Confirmado');

  const bloqueado = MapearEstado('bloqueado');
  assert.equal(bloqueado.rotulo, 'Bloqueado');
});

test('SPLASH-PAINEL 4: Montagem de mensagem do WhatsApp com sinal e chave Pix', () => {
  const reserva = {
    nome: 'Carolina Lima',
    unidade: 'santa-adelia',
    data: '2026-10-25'
  };

  // Sem chave Pix configurada -> deve avisar que falta a chave em vez de inventar
  const configSemPix = {
    pix: { chave: '', titular: '' },
    sinal: { tipo: 'percentual', valor: 30 }
  };
  const msg1 = montarMensagemWhatsApp(reserva, configSemPix);
  assert.ok(msg1.includes('Vamos combinar o pagamento'), 'sem chave Pix, combina o pagamento por aqui');
  assert.ok(!msg1.includes('Chave Pix:'), 'sem chave Pix, não inventa chave');
  assert.ok(!msg1.includes('123.456'), 'não deve conter chave Pix inventada');

  // Com chave Pix configurada
  const configComPix = {
    pix: { chave: '17999990000', titular: 'Amanda Splash' },
    sinal: { tipo: 'percentual', valor: 30 }
  };
  const msg2 = montarMensagemWhatsApp(reserva, configComPix);
  assert.ok(msg2.includes('17999990000'), 'deve conter a chave Pix');
  assert.ok(msg2.includes('Amanda Splash'), 'deve conter o titular');
  assert.ok(msg2.includes('30% do valor total'), 'deve conter o sinal de 30%');
  assert.ok(msg2.includes('25/10/2026'), 'deve formatar a data para BR');
});

test('SPLASH-PAINEL 5: Geração do CSV de cópia de segurança (backup)', () => {
  const reservas = [
    {
      id: 'res-1',
      protocolo: 'SPL-123456',
      unidade: 'santa-barbara',
      data: '2026-11-10',
      nome: 'Carlos & Ana',
      whatsapp: '17999991111',
      email: 'carlos@exemplo.com',
      tipo_evento: 'Casamento',
      convidados: 250,
      status: 'confirmado',
      obs: 'Mesa de doces no jardim',
      prazo_ate: ''
    }
  ];

  const csv = gerarCsvBackup(reservas);
  assert.ok(csv.startsWith('ID,Protocolo,Unidade,Data,Cliente,WhatsApp,E-mail,Tipo de Evento,Convidados,Status,Observações,Prazo Até'));
  assert.ok(csv.includes('SPL-123456'));
  assert.ok(csv.includes('"Carlos & Ana"'));
  assert.ok(csv.includes('santa-barbara'));
  assert.ok(csv.includes('250'));
});

test('SPLASH-PAINEL 6: Utilitários de cálculo de calendário mensal', () => {
  const infoOct = calcularDiasMes('2026', '10');
  assert.equal(infoOct.totalDias, 31, 'outubro possui 31 dias');

  const infoFeb = calcularDiasMes('2026', '02');
  assert.equal(infoFeb.totalDias, 28, 'fevereiro de 2026 possui 28 dias');
});

test('SPLASH-PAINEL 7: Geração do CSV financeiro com dados básicos', () => {
  const financeiroData = [
    {
      data: '2026-10-25',
      descricao: 'Reserva - Casamento Carlos & Ana',
      tipo: 'receita',
      valor: '5000.00',
      status: 'pago',
      reserva_id: 'res-1',
      forma_pagamento: 'Pix'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: 'Carlos & Ana',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  assert.equal(linhas.length, 2, 'deve ter 2 linhas (cabeçalho + 1 linha de dados)');
  assert.ok(linhas[0].includes('Data,Descrição,Tipo,Valor (R$),Status,Reserva ID,Cliente,Unidade,Forma de Pagamento'), 'cabeçalho correto');
  assert.ok(linhas[1].includes('2026-10-25'), 'deve conter a data');
  assert.ok(linhas[1].includes('Reserva - Casamento Carlos & Ana'), 'deve conter a descrição');
  assert.ok(linhas[1].includes('5000.00'), 'deve conter o valor');
  assert.ok(linhas[1].includes('Carlos & Ana'), 'deve conter o nome do cliente');
  assert.ok(linhas[1].includes('santa-barbara'), 'deve conter a unidade');
});

test('SPLASH-PAINEL 8: Proteção contra injeção de fórmulas em CSV', () => {
  const financeiroData = [
    {
      data: '=NOW()',
      descricao: '+MALICIOUS',
      tipo: '@SCRIPT',
      valor: '1000.00',
      status: 'pago',
      reserva_id: 'res-1',
      forma_pagamento: 'Pix'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: '=INJECT',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  // Valores que começam com =, +, -, @ devem ser protegidos com apóstrofo
  assert.ok(linhas[1].includes("'=NOW()'"), 'data com = deve ser protegida');
  assert.ok(linhas[1].includes("'+MALICIOUS'"), 'descrição com + deve ser protegida');
  assert.ok(linhas[1].includes("'@SCRIPT'"), 'tipo com @ deve ser protegida');
  assert.ok(linhas[1].includes("'=INJECT'"), 'nome do cliente com = deve ser protegida');
});

test('SPLASH-PAINEL 8b: Proteção contra injeção de fórmulas com hífen (-)', () => {
  const financeiroData = [
    {
      data: '-INJECT-DATE',
      descricao: 'Descrição normal',
      tipo: 'receita',
      valor: '1000.00',
      status: 'pago',
      reserva_id: 'res-1',
      forma_pagamento: 'Pix'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: '-INJECT-NAME',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');

  assert.ok(linhas[1].includes("'-INJECT-DATE'"), 'data com - deve ser protegida');
  assert.ok(linhas[1].includes("'-INJECT-NAME'"), 'nome com - deve ser protegido');
});

test('SPLASH-PAINEL 9: Validação e tratamento de dados ausentes ou inválidos', () => {
  const financeiroData = [
    {
      data: null,
      descricao: undefined,
      tipo: '',
      valor: 'abc', // valor inválido
      status: null,
      reserva_id: 'res-1',
      forma_pagamento: null
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: 'Cliente Teste',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  assert.ok(linhas[1].includes(''), 'data null deve ser vazia');
  assert.ok(linhas[1].includes(''), 'descricao undefined deve ser vazia');
  assert.ok(linhas[1].includes(''), 'tipo vazio deve ser vazio');
  assert.ok(linhas[1].includes('0'), 'valor inválido deve ser convertido para 0');
  assert.ok(linhas[1].includes(''), 'status null deve ser vazio');
  assert.ok(linhas[1].includes(''), 'forma_pagamento null deve ser vazia');
});

test('SPLASH-PAINEL 10: Geração do CSV financeiro com múltiplos registros', () => {
  const financeiroData = [
    {
      data: '2026-10-25',
      descricao: 'Reserva - Casamento',
      tipo: 'receita',
      valor: '5000.00',
      status: 'pago',
      reserva_id: 'res-1',
      forma_pagamento: 'Pix'
    },
    {
      data: '2026-11-15',
      descricao: 'Reserva - Aniversário',
      tipo: 'receita',
      valor: '2000.00',
      status: 'pendente',
      reserva_id: 'res-2',
      forma_pagamento: 'Cartão'
    },
    {
      data: '2026-12-20',
      descricao: 'Reserva - Formatura',
      tipo: 'receita',
      valor: '3000.00',
      status: 'pago',
      reserva_id: 'res-3',
      forma_pagamento: 'Dinheiro'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: 'Carlos & Ana',
      unidade: 'santa-barbara'
    },
    {
      id: 'res-2',
      nome: 'João Silva',
      unidade: 'santa-adelia'
    },
    {
      id: 'res-3',
      nome: 'Maria Oliveira',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  assert.equal(linhas.length, 4, 'deve ter 4 linhas (cabeçalho + 3 linhas de dados)');
  
  // Verifica se cada linha de dados contém as informações corretas
  assert.ok(linhas[1].includes('Carlos & Ana'), 'primeira linha deve conter Carlos & Ana');
  assert.ok(linhas[2].includes('João Silva'), 'segunda linha deve conter João Silva');
  assert.ok(linhas[3].includes('Maria Oliveira'), 'terceira linha deve conter Maria Oliveira');
  
  // Verifica se os valores estão corretos
  assert.ok(linhas[1].includes('5000.00'), 'primeira linha deve conter valor 5000.00');
  assert.ok(linhas[2].includes('2000.00'), 'segunda linha deve conter valor 2000.00');
  assert.ok(linhas[3].includes('3000.00'), 'terceira linha deve conter valor 3000.00');
});

test('SPLASH-PAINEL 11: Validação de dados de reserva não encontrados', () => {
  const financeiroData = [
    {
      data: '2026-10-25',
      descricao: 'Reserva sem correspondente',
      tipo: 'receita',
      valor: '1000.00',
      status: 'pago',
      reserva_id: 'res-nao-existe',
      forma_pagamento: 'Pix'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: 'Cliente Teste',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  assert.ok(linhas[1].includes(''), 'campos de reserva não encontrados devem ser vazios');
  assert.ok(linhas[1].includes(''), 'nome da reserva não encontrada deve ser vazio');
  assert.ok(linhas[1].includes(''), 'unidade da reserva não encontrada deve ser vazia');
});

test('SPLASH-PAINEL 12: Validação de dados vazios ou arrays vazios', () => {
  // Testa com arrays vazios
  const csv1 = gerarCsvFinanceiro([], []);
  assert.equal(csv1, 'Data,Descrição,Tipo,Valor (R$),Status,Reserva ID,Cliente,Unidade,Forma de Pagamento', 'deve retornar apenas o cabeçalho quando arrays vazios');
  
  // Testa com null/undefined
  const csv2 = gerarCsvFinanceiro(null, null);
  assert.equal(csv2, 'Data,Descrição,Tipo,Valor (R$),Status,Reserva ID,Cliente,Unidade,Forma de Pagamento', 'deve retornar apenas o cabeçalho quando null');
  
  // Testa com undefined
  const csv3 = gerarCsvFinanceiro(undefined, undefined);
  assert.equal(csv3, 'Data,Descrição,Tipo,Valor (R$),Status,Reserva ID,Cliente,Unidade,Forma de Pagamento', 'deve retornar apenas o cabeçalho quando undefined');
});

test('SPLASH-PAINEL 13: Validação de dados com caracteres especiais e vírgulas', () => {
  const financeiroData = [
    {
      data: '2026-10-25',
      descricao: 'Evento "Especial" com, vírgulas',
      tipo: 'Receita',
      valor: '1.000,50',
      status: 'Pago',
      reserva_id: 'res-1',
      forma_pagamento: 'Cartão de Crédito'
    }
  ];

  const reservasData = [
    {
      id: 'res-1',
      nome: 'Cliente "Importante"',
      unidade: 'santa-barbara'
    }
  ];

  const csv = gerarCsvFinanceiro(financeiroData, reservasData);
  const linhas = csv.split('\n');
  
  // Campos com vírgulas e aspas devem ser corretamente escapados
  assert.ok(linhas[1].includes('"Evento \"Especial\" com, vírgulas"'), 'descrição com vírgulas e aspas deve ser escapada');
  assert.ok(linhas[1].includes('"Cliente \"Importante\""'), 'nome com aspas deve ser escapado');
  assert.ok(linhas[1].includes('"Cartão de Crédito"'), 'forma de pagamento com espaços deve estar entre aspas');
});
