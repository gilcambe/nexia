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
  assert.match(swContent, /vp-app-v\d+/, 'sw.js deve declarar a versão do cache');
});

test('PWA Viajante Pro: rotas registradas em TENANT_PAGES', () => {
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/app'], ['viajante-pro/app', 'index.html']);
  assert.deepStrictEqual(TENANT_PAGES['/vp/passageiro'], ['viajante-pro', 'vp-passenger.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/pax'], ['viajante-pro', 'vp-passenger.html']);
  assert.deepStrictEqual(TENANT_PAGES['/vp/admin'], ['viajante-pro/painel', 'index.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/admin'], ['viajante-pro/painel', 'index.html']);
  assert.deepStrictEqual(TENANT_PAGES['/viajante-pro/painel-classico'], ['viajante-pro', 'vp-admin.html']);
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

test('Central Administrativa (vp-admin.html): só telas reais pela API oficial (#2837)', () => {
  assert.ok(fs.existsSync(ADMIN_HTML), 'vp-admin.html deve existir');
  const html = fs.readFileSync(ADMIN_HTML, 'utf8');
  assert.ok(html.includes('pg-dashboard'), 'Deve conter dashboard principal');
  for (const a of ['entrar', 'cotacao-listar', 'viagem-listar', 'chat-conversas', 'trocar-senha']) assert.ok(html.includes(`'${a}'`), `usa a ação real ${a}`);
  for (const l of ['/viajante-pro/cotacoes', '/viajante-pro/viagens', '/viajante-pro/editar']) assert.ok(html.includes(l), `link real ${l}`);
  for (const fake of ['COL(', "collection('data')", '/api/cortex', 'Simule', 'getDefault', 'simScan', 'pg-pabx']) assert.ok(!html.includes(fake), `sem tela de teste: ${fake}`);
});

test('App do Viajante (app.js): usa API real por token e sem dados inventados (#2303)', () => {
  const appJsPath = path.join(RAIZ, 'app.js');
  assert.ok(fs.existsSync(appJsPath), 'app.js deve existir');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert.ok(!appJs.includes('dadosPadrao'), 'Não deve conter a função dadosPadrao');
  assert.ok(!appJs.includes('Carlos Eduardo'), 'Não deve conter Carlos Eduardo inventado');
  assert.ok(!appJs.includes('982100'), 'Não deve conter Apólice #982100');
  assert.ok(appJs.includes("acao: 'app-viagem'"), 'Deve usar a ação real app-viagem da API (app_obter nunca existiu)');
  assert.ok(appJs.includes('mostrarMensagem'), 'Deve implementar mostrarMensagem');
  assert.ok(appJs.includes('converter'), 'Deve implementar converter');
});
