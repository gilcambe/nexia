'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { TENANT_PAGES } = require('../../lib/routes');

const RAIZ = path.join(__dirname, '../../viajante-pro/app');
const PASSENGER_HTML = path.join(__dirname, '../../viajante-pro/vp-passenger.html');
const ADMIN_HTML = path.join(__dirname, '../../viajante-pro/vp-admin.html');

test('PWA Viajante Pro: arquivos do app existem e possuem conteúdo válido', () => {
  const indexHtml = path.join(RAIZ, 'index.html');
  const appJs = path.join(RAIZ, 'app.js');
  const swJs = path.join(RAIZ, 'sw.js');
  const manifest = path.join(RAIZ, 'manifest.webmanifest');
  const icon192 = path.join(RAIZ, 'icone-192.png');
  const icon512 = path.join(RAIZ, 'icone-512.png');
  const iconMask = path.join(RAIZ, 'icone-maskable-512.png');

  assert.ok(fs.existsSync(indexHtml), 'index.html deve existir');
  assert.ok(fs.existsSync(appJs), 'app.js deve existir');
  assert.ok(fs.existsSync(swJs), 'sw.js deve existir');
  assert.ok(fs.existsSync(manifest), 'manifest.webmanifest deve existir');
  assert.ok(fs.existsSync(icon192), 'icone-192.png deve existir');
  assert.ok(fs.existsSync(icon512), 'icone-512.png deve existir');
  assert.ok(fs.existsSync(iconMask), 'icone-maskable-512.png deve existir');

  const htmlContent = fs.readFileSync(indexHtml, 'utf8');
  assert.ok(htmlContent.includes('manifest.webmanifest'), 'index.html deve referenciar o manifesto');
  assert.ok(htmlContent.includes('app.js'), 'index.html deve carregar app.js');
  assert.ok(htmlContent.includes('Mostre ao Motorista'), 'index.html deve conter a tela do motorista');

  const manifestJson = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.strictEqual(manifestJson.name, 'Viajante Pro App');
  assert.strictEqual(manifestJson.display, 'standalone');

  const swContent = fs.readFileSync(swJs, 'utf8');
  assert.ok(swContent.includes('vp-app-v1'), 'sw.js deve declarar a versão do cache');
});

test('PWA Viajante Pro: rotas registradas em TENANT_PAGES', () => {
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/app'], ['viajante-pro/app', 'index.html']);
  assert.deepStrictEqual(TENANT_PAGES['/vp/passageiro'], ['viajante-pro', 'vp-passenger.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/pax'], ['viajante-pro', 'vp-passenger.html']);
  assert.deepStrictEqual(TENANT_PAGES['/vp/admin'], ['viajante-pro', 'vp-admin.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/admin'], ['viajante-pro', 'vp-admin.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro'], ['viajante-pro', 'vp-landing.html']);
  assert.deepStrictEqual(TENANT_PAGES['/vp'], ['viajante-pro', 'vp-landing.html']);
});

test('App do Viajante (vp-passenger.html): acesso por token, itinerário e chat offline', () => {
  assert.ok(fs.existsSync(PASSENGER_HTML), 'vp-passenger.html deve existir');
  const html = fs.readFileSync(PASSENGER_HTML, 'utf8');

  assert.ok(html.includes('paxToken') || html.includes('params.get(\'token\')'), 'Deve suportar acesso por token de URL');
  assert.ok(html.includes('id="screen-itinerario"'), 'Deve conter tela de itinerário');
  assert.ok(html.includes('id="screen-chat"'), 'Deve conter tela de chat');
  assert.ok(html.includes('vp_pending_chats') || html.includes('flushPendingChatMessages'), 'Deve possuir fila de mensagens chat offline');
  assert.ok(html.includes('id="screen-panico"'), 'Deve conter tela de emergência SOS');
});

test('Central Administrativa (vp-admin.html): gestão de viagens, chat pax e editor do site', () => {
  assert.ok(fs.existsSync(ADMIN_HTML), 'vp-admin.html deve existir');
  const html = fs.readFileSync(ADMIN_HTML, 'utf8');

  assert.ok(html.includes('pg-dashboard'), 'Deve conter dashboard principal');
  assert.ok(html.includes('pg-roteiros'), 'Deve conter gestão de roteiros e pacotes');
  assert.ok(html.includes('pg-passageiros'), 'Deve conter base de passageiros');
  assert.ok(html.includes('pg-financeiro'), 'Deve conter gestão financeira');
  assert.ok(html.includes('pg-chat-pax'), 'Deve conter atendimento e chat com passageiro');
  assert.ok(html.includes('pg-editor-site'), 'Deve conter editor de conteúdo do site');
});
