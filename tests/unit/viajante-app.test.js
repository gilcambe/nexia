'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { TENANT_PAGES } = require('../../lib/routes');

const RAIZ = path.join(__dirname, '../../viajante-pro/app');

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
});

test('PWA Viajante Pro: app.js não contém dados falsos e contém app_obter', () => {
  const appJs = path.join(RAIZ, 'app.js');
  assert.ok(fs.existsSync(appJs), 'app.js deve existir');
  
  const appJsContent = fs.readFileSync(appJs, 'utf8');
  
  // Verificar que não contém dados falsos removidos
  assert.ok(!appJsContent.includes('dadosPadrao'), 'app.js não deve conter dadosPadrao');
  assert.ok(!appJsContent.includes('Carlos Eduardo'), 'app.js não deve conter Carlos Eduardo');
  assert.ok(!appJsContent.includes('Apólice #982100'), 'app.js não deve conter Apólice #982100');
  
  // Verificar que contém a chamada para app_obter
  assert.ok(appJsContent.includes('app_obter'), 'app.js deve conter app_obter');
  
  // Verificar que a chamada app_obter está na função buscarViagem
  assert.ok(appJsContent.includes('acao: \'app_obter\''), 'app.js deve chamar app_obter na API');
});

