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
