'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decidir, soEmoji, querLink, temPergunta, sem, FRASES } = require('../../divulga/respostas-regras');

test('DR1. Comentário inválido ou vazio deve pedir mensagem válida', () => {
  const post = { usuario: 'outro', respondido: false, data: Date.now() };
  assert.equal(decidir(post, '', 'eu'), 'Por favor, envie uma mensagem válida.');
  assert.equal(decidir(post, '   ', 'eu'), 'Por favor, envie uma mensagem válida.');
});

test('DR2. Comentário do próprio autor do post', () => {
  const post = { usuario: 'autor1', respondido: false, data: Date.now() };
  assert.equal(decidir(post, 'Atualizei o texto', 'autor1'), 'Obrigado por atualizar seu post! 😊');
});

test('DR3. Post já respondido anteriormente', () => {
  const post = { usuario: 'outro', respondido: true, data: Date.now() };
  assert.equal(decidir(post, 'Olá', 'eu'), 'Este post já foi respondido anteriormente.');
});

test('DR4. Post antigo com mais de 7 dias', () => {
  const oitoDiasAtras = Date.now() - (8 * 24 * 60 * 60 * 1000);
  const post = { usuario: 'outro', respondido: false, data: oitoDiasAtras };
  assert.equal(decidir(post, 'Olá', 'eu'), 'Este post é antigo e já não está mais ativo.');
});

test('DR5. Comentário contendo apenas emojis', () => {
  const post = { usuario: 'outro', respondido: false, data: Date.now() };
  assert.equal(soEmoji('👍🎉'), true);
  assert.equal(soEmoji('Olá 👍'), false);
  assert.equal(decidir(post, '😀😃😄', 'eu'), 'Por favor, envie uma mensagem mais detalhada além dos emojis.');
});

test('DR6. Pedido de link ou contato', () => {
  const post = { usuario: 'outro', respondido: false, data: Date.now() };
  assert.equal(querLink('Onde fica o link?'), true);
  assert.equal(querLink('Como posso baixar?'), true);
  assert.equal(decidir(post, 'Qual o link do site?', 'eu'), 'Acesse nosso site: www.nexia.com.br ou entre em contato via WhatsApp: (11) 99999-9999');
});

test('DR7. Pergunta do usuário', () => {
  const post = { usuario: 'outro', respondido: false, data: Date.now() };
  assert.equal(temPergunta('Como funciona o serviço?'), true);
  assert.equal(decidir(post, 'Como faço para agendar?', 'eu'), 'Obrigado pela sua pergunta! Em breve nossa equipe entrará em contato para responder.');
});

test('DR8. Comentário padrão com e sem sorteio de frase', () => {
  const post = { usuario: 'outro', respondido: false, data: Date.now() };
  assert.equal(decidir(post, 'Excelente trabalho pessoal', 'eu', false), 'Obrigado pela sua mensagem! 😊');
  const respSorteio = decidir(post, 'Muito bom', 'eu', true);
  assert.ok(FRASES.includes(respSorteio), 'A resposta sorteada deve estar na lista de FRASES');
});
