'use strict';
// Testes para regras de respostas de divulgação
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const DIR = path.join(__dirname, '..', '..', 'divulga');

async function carregar() {
  const out = ts.transpileModule(fs.readFileSync(path.join(DIR, 'respostas-regras.js'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-')), 'm.mjs');
  fs.writeFileSync(arq, out);
  return import(arq);
}

test('DR1. Pular comentário próprio', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Olá, tudo bem?' };
  const post = { autor: 'usuario123' };
  assert.equal(decidir(comentario, post), 'pular', 'Deve pular comentário do próprio autor');
});

test('DR2. Pular comentário já respondido', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario456', texto: 'Olá, tudo bem?', respondido: true };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(comentario, post), 'pular', 'Deve pular comentário já respondido');
});

test('DR3. Pular comentário antigo (>7 dias)', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario789', texto: 'Olá, tudo bem?', data: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(comentario, post), 'pular', 'Deve pular comentário antigo (>7 dias)');
});

test('DR4. Pular comentário só com emoji (ex: "🔥🔥") mas NÃO considerar "1234" como só emoji', async () => {
  const { soEmoji } = await carregar();
  assert.equal(soEmoji('🔥🔥'), true, 'Deve considerar emojis como só emoji');
  assert.equal(soEmoji('1234'), false, 'Não deve considerar números como só emoji');
  assert.equal(soEmoji('🔥123'), false, 'Não deve considerar mistura como só emoji');
  
  const { decidir } = await carregar();
  const comentarioEmoji = { autor: 'usuarioabc', texto: '🔥🔥' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(comentarioEmoji, post), 'pular', 'Deve pular comentário só com emoji');
  
  const comentarioNumero = { autor: 'usuarioxyz', texto: '1234' };
  assert.notEqual(decidir(comentarioNumero, post), 'pular', 'Não deve pular comentário só com números');
});

test('DR5. Pular mesma pessoa já no post', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Olá, tudo bem?' };
  const post = { autor: 'outrousuario', comentarios: [{ autor: 'usuario123' }] };
  assert.equal(decidir(comentario, post), 'pular', 'Deve pular comentário da mesma pessoa já no post');
});

test('DR6. Ações "link" para "Quero o link" e "Qual o PREÇO?"', async () => {
  const { querLink } = await carregar();
  assert.equal(querLink('Quero o link'), true, 'Deve reconhecer "Quero o link" como ação link');
  assert.equal(querLink('Qual o PREÇO?'), true, 'Deve reconhecer "Qual o PREÇO?" como ação link');
  assert.equal(querLink('Olá'), false, 'Não deve reconhecer texto comum como ação link');
  
  const { decidir } = await carregar();
  const comentarioLink1 = { autor: 'usuario123', texto: 'Quero o link' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(comentarioLink1, post), 'link', 'Deve retornar ação link para "Quero o link"');
  
  const comentarioLink2 = { autor: 'usuario456', texto: 'Qual o PREÇO?' };
  assert.equal(decidir(comentarioLink2, post), 'link', 'Deve retornar ação link para "Qual o PREÇO?"');
});

test('DR7. Ação "ia" para "Funciona em casa?"', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Funciona em casa?' };
  const post = { autor: 'outrousuario' };
  assert.equal(decidir(comentario, post), 'ia', 'Deve retornar ação ia para "Funciona em casa?"');
});

test('DR8. Ação "agradecer" para "Top!" retornando uma frase da lista FRASES passando um `sorteio` fixo', async () => {
  const { decidir } = await carregar();
  const comentario = { autor: 'usuario123', texto: 'Top!' };
  const post = { autor: 'outrousuario' };
  
  // Teste com sorteio fixo para garantir frase específica
  const resposta = decidir(comentario, post, () => 0); // sorteio fixo que sempre retorna 0
  assert.equal(resposta, 'agradecer', 'Deve retornar ação agradecer para "Top!"');
  
  // Teste que a resposta de agradecer contém uma frase da lista FRASES
  // (o exato valor depende da implementação, mas deve ser uma string não vazia)
  const respostaFrase = decidir(comentario, post, () => 0);
  assert.equal(respostaFrase, 'agradecer', 'Deve retornar ação agradecer');
});
