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
  calcularDiasMes
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
  assert.ok(msg1.includes('A chave Pix para pagamento do sinal ainda não foi cadastrada'), 'deve avisar sobre Pix ausente');
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
