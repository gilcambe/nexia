'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('ADRIANO-SITE. validação da landing page pública de sites/adrianoblumer/index.html', () => {
  const indexPath = path.join(__dirname, '../../sites/adrianoblumer/index.html');
  assert.ok(fs.existsSync(indexPath), 'sites/adrianoblumer/index.html deve existir');

  const html = fs.readFileSync(indexPath, 'utf8');

  // 1. Dados Proibidos NÃO podem estar presentes
  const PROIBIDOS = [
    'CRN 12345',
    '500+ pacientes',
    '97% satisfação',
    'Marina Santos',
    'Rafael Torres',
    'unsplash.com',
    '(11) 9 9999-9999',
    'contato@adrianoblumer.com',
    'antes e depois',
  ];

  for (const p of PROIBIDOS) {
    assert.ok(!html.toLowerCase().includes(p.toLowerCase()), `HTML não pode conter dado proibido: "${p}"`);
  }

  // 2. Marcações data-ed, data-lista, data-secao devem existir
  assert.ok(html.includes('data-ed="hero-titulo"'), 'Deve conter chaves data-ed para edição');
  assert.ok(html.includes('data-secao="inicio"'), 'Deve conter data-secao para controle de visibilidade');
  assert.ok(html.includes('data-lista="especialidades"'), 'Deve conter data-lista para coleções');

  // 3. Selo Kernex visível e link correto
  assert.ok(html.includes('Feito com Kernex'), 'Deve conter o selo visível Feito com Kernex');
  assert.ok(html.includes('kernex.com.br/?utm_source=adriano&amp;utm_medium=selo&amp;utm_campaign=clientes') || html.includes('kernex.com.br/?utm_source=adriano&utm_medium=selo&utm_campaign=clientes'), 'Selo Kernex deve conter UTM de cliente adriano');

  // 4. Funciona sem API (conteúdo estático padrão presente)
  assert.ok(html.includes('Adriano Blumer'), 'Deve conter o nome do cliente no HTML estático');
  assert.ok(html.includes('Rua Domingos de Morais, 2781'), 'Deve conter o endereço real do consultório');
  assert.ok(html.includes('nutri.adrianoblumer@gmail.com'), 'Deve conter o e-mail real');
  assert.ok(html.includes('5511999994185'), 'Deve conter o WhatsApp real confirmado');

  // 5. Calculadora de IMC no navegador
  assert.ok(html.includes('function calcularIMC()'), 'Deve conter a função JS de cálculo de IMC');
  assert.ok(html.includes('não substitui uma avaliação profissional'), 'Deve conter o aviso legal na calculadora de IMC');

  // 6. Não grava em disco e sem chamadas server-side
  assert.ok(!html.includes('fs.writeFileSync') && !html.includes('require('), 'Não deve conter fs ou require no código do frontend');
});
