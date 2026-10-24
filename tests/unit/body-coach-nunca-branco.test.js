'use strict';
// Body Coach nunca abre em branco (pedido do usuário em 24/10/2026: "Isso nunca deve acontecer!").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.join(__dirname, '..', '..', 'apps', 'body-coach');
const ler = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

function guarda() {
  const html = ler('index.html');
  const m = /<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/.exec(html);
  assert.ok(m, 'script de guarda no index.html');
  return m[1];
}

function rodar({ filhos = 0, ultima = 0 } = {}) {
  const ouvintes = {};
  const timers = [];
  const ls = new Map(ultima ? [['bc_recuperou_em', String(ultima)]] : []);
  const ctx = {
    feito: { desregistrou: 0, apagou: 0, foi: null },
    root: { children: { length: filhos }, innerHTML: '' },
  };
  const botao = {};
  Object.assign(ctx, {
    window: { addEventListener: (t, f) => { ouvintes[t] = f; } },
    document: { getElementById: (id) => (id === 'root' ? ctx.root : botao) },
    localStorage: { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v) },
    navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { ctx.feito.desregistrou++; } }] } },
    caches: null,
    location: { href: 'https://app.test/body-coach/', replace: (u) => { ctx.feito.foi = u; } },
    URL, Promise, Date,
    setTimeout: (f, ms) => { timers.push({ f, ms }); },
  });
  ctx.caches = { keys: async () => ['body-coach-v5'], delete: async () => { ctx.feito.apagou++; } };
  ctx.window.caches = ctx.caches;
  vm.runInNewContext(guarda(), ctx);
  return { ctx, ouvintes, timers, ls, botao };
}

test('tela branca por 12 s: limpa a cópia guardada do app e abre de novo', async () => {
  const { ctx, timers } = rodar();
  timers.find((t) => t.ms === 12000).f();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ctx.feito.desregistrou, 1);
  assert.equal(ctx.feito.apagou, 1);
  assert.match(ctx.feito.foi, /\?v=\d+/);
});

test('app abriu: a guarda não faz nada', async () => {
  const { ctx, timers } = rodar({ filhos: 1 });
  timers.find((t) => t.ms === 12000).f();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ctx.feito.foi, null);
});

test('arquivo do app que falhou ao carregar: recupera na hora', async () => {
  const { ctx, ouvintes } = rodar();
  ouvintes.error({ target: { src: 'https://app.test/body-coach/assets/index-VELHO.js' } });
  await new Promise((r) => setTimeout(r, 10));
  assert.match(ctx.feito.foi, /\?v=/);
});

test('já recuperou há pouco: mostra aviso com botão (sem ficar recarregando sem parar)', async () => {
  const { ctx, timers, botao } = rodar({ ultima: Date.now() - 1000 });
  timers.find((t) => t.ms === 12000).f();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ctx.feito.foi, null);
  assert.match(ctx.root.innerHTML, /Abrir de novo/);
  botao.onclick();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(ctx.feito.foi, /\?v=/, 'o botão força a recuperação');
});

test('React: tela quebrada vira aviso, Carregando eterno ganha saída, pedaço velho recupera', () => {
  const main = ler('src/main.tsx');
  assert.match(main, /<ErroGeral>\s*<App \/>\s*<\/ErroGeral>/);
  const erro = ler('src/components/feature/ErroGeral.tsx');
  assert.match(erro, /getDerivedStateFromError/);
  assert.match(erro, /Abrir de novo/);
  const guard = ler('src/components/feature/AuthGuard.tsx');
  assert.match(guard, /recuperarApp\(\{ dadosLocais: true \}\)/);
  assert.match(guard, /navigator\.onLine/);
  assert.match(ler('src/router/carregar.tsx'), /recuperarApp\(\)/);
  const rec = ler('src/lib/recuperar.ts');
  assert.match(rec, /startsWith\('firestore\/'\)/, 'só a cópia local do banco; o login fica');
  assert.doesNotMatch(rec, /firebaseLocalStorageDb'\)/);
});

test('Marca: o topo do app mostra Body Coach, não NEXIA', () => {
  const shell = ler('src/components/feature/AppShell.tsx');
  assert.match(shell, /marca\?\.nome \|\| 'Body Coach'/);
  assert.doesNotMatch(shell, /'NEXIA'/);
  assert.doesNotMatch(ler('src/pages/auth/page.tsx'), />\s*NEXIA\s*</);
  assert.match(ler('public/manifest.webmanifest'), /"name": "Body Coach"/);
});
