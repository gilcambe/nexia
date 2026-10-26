'use strict';
// #1670: o Cortex se apresenta só como "Cortex" e responde no idioma de quem pergunta.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const fonte = fs.readFileSync(path.join(__dirname, '../../netlify/functions/cortex-chat.js'), 'utf8');
const prompt = (/function buildSystemPrompt[\s\S]*?\n}/.exec(fonte) || [''])[0];

test('prompt do Cortex: nome comercial e idioma da pessoa', () => {
  assert.ok(prompt, 'buildSystemPrompt existe');
  assert.match(prompt, /Você é o Cortex/);
  assert.match(prompt, /mesmo idioma da última mensagem/);
  assert.doesNotMatch(prompt, /IA Suprema/);
  assert.doesNotMatch(prompt, /SEMPRE em português/);
  assert.doesNotMatch(prompt, /Modo MASTER/);
});

test('anexos recebem o binding do Workers AI', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../cloudflare/app.js'), 'utf8');
  const acoes = fs.readFileSync(path.join(__dirname, '../../netlify/functions/central/pedidos-acoes.js'), 'utf8');
  assert.match(app, /globalThis\.__NEXIA_AI__ = env\.AI/);
  assert.match(acoes, /AI: globalThis\.__NEXIA_AI__/);
});
