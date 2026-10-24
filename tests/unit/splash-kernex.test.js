'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
const R = p => fs.readFileSync(path.join(RAIZ, p), 'utf8');

test('SPLASH-KX1: vinheta Kernex de 2 s no site e no painel, com o nome SPLASH e o mesmo símbolo do Body Coach', () => {
  const js = R('sites/splash/abertura-kernex.js');
  new vm.Script(js);
  assert.match(js, /DURACAO_MS = 2000/);
  assert.match(js, /MARCA = 'KERNEX'/);
  assert.match(js, /FRASE = 'Inteligência que resolve\.'/);
  assert.match(js, /background:#060d1c/);
  assert.match(js, /sessionStorage\.getItem\('nexia_splash'\)/);
  assert.match(js, /window\.self !== window\.top/, 'não aparece dentro do "Editar site"');
  const ts = R('src/lib/abertura-nexia.ts');
  const svg = s => (s.match(/<path d="M100,36[^']+/) || [])[0];
  assert.ok(svg(js) && svg(js) === svg(ts), 'mesmo símbolo do src/lib/abertura-nexia.ts');
  assert.doesNotMatch(js.slice(js.indexOf('function html'), js.indexOf('function mostrar')), /NEXIA/);
  assert.match(R('sites/splash/index.html'), /<script src="abertura-kernex\.js" data-produto="SPLASH" defer><\/script>/);
  assert.match(R('sites/splash/agenda/index.html'), /<script src="\.\.\/abertura-kernex\.js" data-produto="SPLASH" defer><\/script>/);
});

test('SPLASH-KX2: html da vinheta mostra KERNEX + produto e escapa o nome', () => {
  const ctx = { window: {}, document: { currentScript: null, body: null, addEventListener() {} }, navigator: {}, sessionStorage: { getItem() {}, setItem() {} } };
  vm.runInNewContext(R('sites/splash/abertura-kernex.js'), ctx);
  const h = ctx.window.KernexAbertura.html('SPLASH<b>');
  assert.match(h, /SPLASH/);
  assert.doesNotMatch(h, /<b>/);
  assert.strictEqual((h.match(/class="nx-l"/g) || []).length, 6);
});

test('SPLASH-KX3: conta do site e do painel vem do meta (multi-cliente), padrão continua splash', () => {
  const site = R('sites/splash/index.html');
  assert.match(site, /<meta name="locacao-site" content="splash">/);
  assert.match(site, /const SLUG = \(document\.querySelector\('meta\[name="locacao-site"\]'\) \|\| \{\}\)\.content \|\| 'splash';/);
  assert.match(R('sites/splash/agenda/index.html'), /const SITE_NAME = \(document\.querySelector\('meta\[name="agenda-site"\]'\) \|\| \{\}\)\.content \|\| 'splash';/);
  assert.match(R('sites/splash/agenda/sw.js'), /CACHE_VERSION = 'splash-painel-v9'/);
});

test('SPLASH-KX4: gerador cria cópia para outra empresa sem fotos nem nome do Splash', () => {
  const { criar } = require('../../scripts/novo-cliente-locacao.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kx-')), 'sol');
  criar({ slug: 'chacara-sol', nome: 'Chácara do Sol', instagram: 'chacarasol', destino, origem: path.join(RAIZ, 'sites/splash') });
  const site = fs.readFileSync(path.join(destino, 'index.html'), 'utf8');
  const painel = fs.readFileSync(path.join(destino, 'agenda/index.html'), 'utf8');
  assert.match(site, /<meta name="locacao-site" content="chacara-sol">/);
  assert.match(painel, /<meta name="agenda-site" content="chacara-sol">/);
  assert.match(site, /data-produto="CHÁCARA DO SOL"/);
  for (const t of [site, painel]) {
    assert.doesNotMatch(t, /\bSplash\b(?![A-Za-z_])/, 'nome Splash visível');
    assert.doesNotMatch(t, /splash_santaadelia|splasheventos|Amanda/);
  }
  assert.doesNotMatch(site, /midia\/[\w.-]+\.(jpe?g|png|webp|mp4)/);
  assert.ok(fs.existsSync(path.join(destino, 'midia/foto-exemplo.svg')));
  assert.deepStrictEqual(fs.readdirSync(path.join(destino, 'midia')), ['foto-exemplo.svg']);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(destino, 'agenda/manifest.webmanifest'), 'utf8')).name, 'Painel Chácara do Sol');
  assert.match(fs.readFileSync(path.join(destino, 'agenda/sw.js'), 'utf8'), /chacara-sol-painel-v1/);
  assert.throws(() => criar({ slug: 'X!', nome: 'a', destino: destino + '2', origem: path.join(RAIZ, 'sites/splash') }));
  assert.throws(() => criar({ slug: 'chacara-sol', nome: 'a', destino, origem: path.join(RAIZ, 'sites/splash') }), /já existe/);
});

test('SPLASH-KX5: Splash aparece no site da Kernex como cliente e como produto Locação', () => {
  const s = JSON.parse(R('clientes/kernex/site.json'));
  const itens = s.sections.flatMap(x => x.items || []);
  assert.ok(itens.some(i => i.title === 'Splash Eventos' && i.url === 'https://splasheventos.pages.dev'));
  assert.ok(itens.some(i => i.title === 'Locação de espaços'));
});
