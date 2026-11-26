const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { listar, catalogo, escolher, carregar } = require('../nexia-ai/skills/index');

// Cria estrutura temporária para teste
const skillsDir = path.join(__dirname, '../nexia-ai/skills');

// Teste do listar
const lista = listar();
console.log('Testando listar...');
assert(lista.find(s => s.nome === 'tela-finance'), 'Deve achar tela-finance');
assert(lista.find(s => s.nome === 'job-agendado'), 'Deve achar job-agendado');

// Teste do catálogo
const cat = catalogo(lista);
console.log('Testando catálogo...');
assert(cat.includes('SKILLS DISPONÍVEIS:'), 'Deve ter cabeçalho');
assert(cat.includes('- tela-finance:'), 'Deve ter o nome');
assert(!cat.includes('Regras de uso:'), 'Não deve ter o conteúdo');

// Teste da escolha
console.log('Testando escolher...');
const escolha = escolher('criar cron que atualiza o estado', lista);
assert(escolha[0].nome === 'job-agendado', 'Deve escolher job-agendado pelo pedido');

// Teste do carregar
console.log('Testando carregar...');
const corpo = carregar('tela-finance');
assert(corpo.includes('Regras de uso:'), 'Deve ter o conteúdo');
assert(!corpo.includes('name: tela-finance'), 'Não deve ter o frontmatter');

console.log('Todos os testes passaram!');
