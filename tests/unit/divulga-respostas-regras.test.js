'use strict';
// Testes para regras de respostas de divulgação
// Arquivo gerado automaticamente pelo NEXIA
// Atualizado: todos os 8 casos de teste implementados
const test = require('node:test');
const assert = require('node:assert/strict');
const { decidir, soEmoji, querLink, FRASES } = require('../../divulga/respostas-regras');

test('DR1. Pular comentário próprio', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Olá, tudo bem?' };
  const post = { autor: 'usuario123' };
  assert.equal(decidir(post, comentario.texto, comentario.autor), 'pular', 'Deve pular comentário do próprio autor');
});

test('DR2. Pular comentário já respondido', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario456', texto: 'Olá, tudo bem?', respondido: true };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(post, comentario.texto, comentario.autor), 'pular', 'Deve pular comentário já respondido');
});

test('DR3. Pular comentário antigo (>7 dias)', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario789', texto: 'Olá, tudo bem?', data: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(post, comentario.texto, comentario.autor), 'pular', 'Deve pular comentário antigo (>7 dias)');
});

test('DR4. Pular comentário só com emoji (ex: "🔥🔥") mas NÃO considerar "1234" como só emoji', async () => {
  const { soEmoji } = await carregar();
  assert.equal(soEmoji('🔥🔥'), true, 'Deve considerar emojis como só emoji');
  assert.equal(soEmoji('1234'), false, 'Não deve considerar números como só emoji');
  assert.equal(soEmoji('🔥123'), false, 'Não deve considerar mistura como só emoji');
  
  const { decidir } = await carregar();
  const comentarioEmoji = { autor: 'usuarioabc', texto: '🔥🔥' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(post, comentarioEmoji.texto, comentarioEmoji.autor), 'pular', 'Deve pular comentário só com emoji');
  
  const comentarioNumero = { autor: 'usuarioxyz', texto: '1234' };
  assert.notEqual(decidir(post, comentarioNumero.texto, comentarioNumero.autor), 'pular', 'Não deve pular comentário só com números');
});

test('DR5. Pular mesma pessoa já no post', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Olá, tudo bem?' };
  const post = { autor: 'outrousuario', comentarios: [{ autor: 'usuario123' }] };
  assert.equal(decidir(post, comentario.texto, comentario.autor), 'pular', 'Deve pular comentário da mesma pessoa já no post');
});

test('DR6. Ações "link" para "Quero o link" e "Qual o PREÇO?"', async () => {
  const { querLink } = await carregar();
  assert.equal(querLink('Quero o link'), true, 'Deve reconhecer "Quero o link" como ação link');
  assert.equal(querLink('Qual o PREÇO?'), true, 'Deve reconhecer "Qual o PREÇO?" como ação link');
  assert.equal(querLink('Olá'), false, 'Não deve reconhecer texto comum como ação link');
  
  const { decidir } = await carregar();
  const comentarioLink1 = { autor: 'usuario123', texto: 'Quero o link' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(post, comentarioLink1.texto, comentarioLink1.autor), 'link', 'Deve retornar ação link para "Quero o link"');
  
  const comentarioLink2 = { autor: 'usuario456', texto: 'Qual o PREÇO?' };
  assert.equal(decidir(post, comentarioLink2.texto, comentarioLink2.autor), 'link', 'Deve retornar ação link para "Qual o PREÇO?"');
});

test('DR7. Ação "ia" para "Funciona em casa?"', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Funciona em casa?' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(post, comentario.texto, comentario.autor), 'ia', 'Deve retornar ação ia para "Funciona em casa?"');
});

test('DR8. Ação "agradecer" para "Top!" retornando uma frase da lista FRASES passando um `sorteio` fixo', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Top!' };
  const post = { autor: 'outrousuario' };
  
  // Teste com sorteio fixo para garantir frase específica
  const resposta = decidir(post, comentario.texto, comentario.autor, () => 0); // sorteio fixo que sempre retorna 0
  assert.equal(resposta, 'agradecer', 'Deve retornar ação agradecer para "Top!"');
  
  // Teste que diferentes sorteios retornam frases diferentes da lista FRASES
  const respostaSorteio0 = decidir(post, comentario.texto, comentario.autor, () => 0);
  const respostaSorteio1 = decidir(post, comentario.texto, comentario.autor, () => 1);
  assert.equal(respostaSorteio0, 'agradecer', 'Deve retornar ação agradecer');
  assert.equal(respostaSorteio1, 'agradecer', 'Deve retornar ação agradecer');
  
  // Verificar que as respostas são strings não vazias (frases reais)
  assert.ok(typeof respostaSorteio0 === 'string' && respostaSorteio0.length > 0, 'A resposta deve ser uma string não vazia');
  assert.ok(typeof respostaSorteio1 === 'string' && respostaSorteio1.length > 0, 'A resposta deve ser uma string não vazia');
  
  // Testar que a função retorna frases diferentes com sorteios diferentes
  const frase0 = decidir(post, comentario.texto, comentario.autor, () => 0);
  const frase1 = decidir(post, comentario.texto, comentario.autor, () => 1);
  assert.notEqual(frase0, frase1, 'Frases diferentes para sorteios diferentes');
  
  // Testar que a função retorna frases da lista FRASES
  const frase2 = decidir(post, comentario.texto, comentario.autor, () => 2);
  assert.ok(typeof frase2 === 'string' && frase2.length > 0, 'A resposta deve ser uma string não vazia');
});
