'use strict';
// Body Coach B3 (modo simples), B4 (tour de 4 telas), B5 (/instalar, app sem barra de URL), B7 (abertura instantânea).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const APP = path.join(__dirname, '..', '..', 'apps', 'body-coach');
const SRC = path.join(APP, 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

async function carregar(f, troca = (s) => s) {
  const out = ts.transpileModule(troca(ler(f)), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b37-')), 'm.mjs');
  fs.writeFileSync(arq, out);
  return import(arq);
}
function memoria() {
  const d = {};
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
}

test('B3: próxima ação segue a ordem plano > check-in > treino > refeição da noite', async () => {
  const { proximaAcao } = await carregar('lib/modoSimples.ts');
  assert.equal(proximaAcao({ onboarding: false, checkinHoje: false, hora: 9 }).rota, '/onboarding');
  assert.equal(proximaAcao({ onboarding: true, checkinHoje: false, hora: 9 }).acao, 'checkin');
  assert.equal(proximaAcao({ onboarding: true, checkinHoje: true, hora: 9 }).rota, '/workout');
  assert.equal(proximaAcao({ onboarding: true, checkinHoje: true, hora: 22 }).rota, '/nutrition');
});

test('B3: "Ver tudo" fica lembrado e a tela completa não perdeu nada', async () => {
  globalThis.localStorage = memoria();
  const m = await carregar('lib/modoSimples.ts');
  assert.equal(m.verTudoGuardado(), false);
  m.guardarVerTudo(true);
  assert.equal(m.verTudoGuardado(), true);
  m.guardarVerTudo(false);
  assert.equal(m.verTudoGuardado(), false);
  const home = ler('pages/home/page.tsx');
  assert.match(home, /Ver tudo/);
  assert.match(home, /Próxima ação/);
  assert.match(home, /Voltar ao modo simples/);
  for (const n of ['AvisoAnamnese', 'AvisoFotos', 'NuncaFalhe', 'TodayCard', 'NutritionCard', 'DailyCheckIn', 'PedirAvaliacao', 'LigarAvisos', 'ConviteTestador']) assert.ok(home.includes(`<${n} />`), n);
});

test('B4: tour curto de 4 telas por papel, com "Pular" e só na primeira vez', async () => {
  const g = await carregar('lib/guia.ts');
  for (const papel of ['aluno', 'coach']) {
    const p = g.passosTour(papel);
    assert.equal(p.length, 4, papel);
    assert.match(p[0].titulo, /Bem-vindo/);
    assert.equal(p[3].titulo, 'Guia do app');
  }
  assert.ok(g.GUIA_ALUNO.length > 4 && g.GUIA_COACH.length > 4, 'o guia completo continua');
  globalThis.localStorage = memoria();
  assert.equal(g.tourVisto('coach', 'u1'), false);
  g.marcarTourVisto('coach', 'u1');
  assert.equal(g.tourVisto('coach', 'u1'), true);
  assert.equal(g.tourVisto('aluno', 'u1'), false);
  const tour = ler('components/feature/TourGuiado.tsx');
  assert.match(tour, /passosTour\(papel\)/);
  assert.match(tour, />Pular</);
  assert.match(tour, /Pular o tour/);
});

test('B5: /instalar manda Android para a loja; manifesto standalone', async () => {
  const m = await carregar('lib/instalar.ts', (s) => s.replace(/import \{ TESTADOR \} from '\.\/testador';/, "const TESTADOR = { instalar: 'https://play.google.com/store/apps/details?id=app.nexia.bodycoach' };"));
  assert.equal(m.qualAparelho('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(m.qualAparelho('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'iphone');
  assert.equal(m.qualAparelho('Mozilla/5.0 (Macintosh)', false, 5, 'MacIntel'), 'iphone');
  assert.equal(m.qualAparelho('Mozilla/5.0 (Windows NT 10.0)'), 'computador');
  assert.equal(m.qualAparelho('Android', true), 'instalado');
  assert.match(m.LINK_PLAY, /id=app\.nexia\.bodycoach/);
  assert.match(ler('router/config.tsx'), /path: "\/instalar",\s*element: <Instalar \/>/);
  const man = JSON.parse(fs.readFileSync(path.join(APP, 'public', 'manifest.webmanifest'), 'utf8'));
  assert.equal(man.display, 'standalone');
  assert.equal(JSON.parse(fs.readFileSync(path.join(APP, 'android', 'twa-manifest.json'), 'utf8')).display, 'standalone');
  assert.ok(fs.existsSync(path.join(APP, 'android', 'INSTALAR.md')));
});

test('B7: última tela volta só se recente e se não for tela pública', async () => {
  globalThis.localStorage = memoria();
  const u = await carregar('lib/ultimaTela.ts');
  const t0 = 1_000_000;
  u.guardarUltimaTela('/auth', t0);
  assert.equal(u.telaParaVoltar(t0 + 1), null);
  u.guardarUltimaTela('/nutrition', t0);
  assert.equal(u.telaParaVoltar(t0 + 60_000), '/nutrition');
  assert.equal(u.telaParaVoltar(t0 + u.VALIDADE_ULTIMA_TELA_MS + 1), null);
  u.guardarUltimaTela('/', t0 + 5);
  assert.equal(u.telaParaVoltar(t0 + 10), '/nutrition', 'a tela inicial não sobrescreve');
  globalThis.localStorage.setItem(u.CHAVE_ULTIMA_TELA, '{quebrado');
  assert.equal(u.telaParaVoltar(t0), null);
  const fb = ler('lib/firebaseClient.ts');
  assert.match(fb, /persistentLocalCache/);
  assert.match(fb, /return cfgGuardada\(\); \/\/ sem internet/);
});

// Service worker rodado de verdade num sandbox com cache e rede falsos.
function rodarSW({ rede }) {
  const ouvintes = {};
  const guardado = new Map();
  const cache = { put: async (k, v) => { guardado.set(typeof k === 'string' ? k : k.url, v); }, keys: async () => [], delete: async () => true, addAll: async () => {} };
  const self = {
    location: { origin: 'https://app.test' }, registration: { scope: 'https://app.test/body-coach/' },
    addEventListener: (t, f) => { ouvintes[t] = f; }, skipWaiting: () => {}, clients: { claim: () => {} },
  };
  const ctx = {
    self, URL, Promise, setTimeout, clearTimeout,
    Response: { error: () => ({ erro: true }) },
    caches: { open: async () => cache, match: async (k) => guardado.get(typeof k === 'string' ? k : k.url), keys: async () => [], delete: async () => true },
    fetch: rede,
  };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public', 'sw.js'), 'utf8'), ctx);
  const disparar = (url, extra = {}) => {
    let resposta = null;
    ouvintes.fetch({ request: { url, method: 'GET', mode: 'cors', ...extra }, respondWith: (p) => { resposta = p; }, waitUntil: () => {} });
    return resposta;
  };
  return { disparar, guardado };
}

test('B7: service worker versionado, rede primeiro no HTML e nunca guarda /api nem o login do Firebase', async () => {
  const sw = fs.readFileSync(path.join(APP, 'public', 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = 'body-coach-v4'/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /clients\.claim\(\)/);
  assert.match(sw, /k !== CACHE/);
  let chamadas = 0;
  const ok = (corpo) => ({ ok: true, type: 'basic', corpo, clone() { return this; }, text: async () => corpo });
  const { disparar, guardado } = rodarSW({ rede: async () => { chamadas++; return ok('<script src="/body-coach/assets/index-NOVO.js">'); } });
  assert.equal(disparar('https://app.test/body-coach/api/firebase-config'), null, '/api fica fora do SW');
  assert.equal(disparar('https://app.test/__/auth/handler'), null, 'login do Firebase fica fora');
  assert.equal(disparar('https://firestore.googleapis.com/x'), null, 'outra origem fica fora');
  assert.equal(disparar('https://app.test/body-coach/', { method: 'POST', mode: 'navigate' }), null);
  const nav = await disparar('https://app.test/body-coach/workout', { mode: 'navigate' });
  assert.equal(nav.corpo, '<script src="/body-coach/assets/index-NOVO.js">', 'HTML vem da rede');
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(guardado.has('./index.html'), 'a casca nova fica guardada');
  assert.equal(chamadas, 1);
});

test('B7: sem internet a casca guardada abre na hora', async () => {
  const { disparar, guardado } = rodarSW({ rede: async () => { throw new Error('offline'); } });
  guardado.set('./index.html', { corpo: 'casca' });
  const nav = await disparar('https://app.test/body-coach/', { mode: 'navigate' });
  assert.equal(nav.corpo, 'casca');
});

test('A8 (#811). Body Coach abre com a config guardada e atualiza pela rede depois', () => {
  const fb = ler('lib/firebaseClient.ts');
  const corpo = fb.slice(fb.indexOf('async function loadConfig'));
  assert.match(corpo, /const guardada = cfgGuardada\(\);/);
  assert.match(corpo, /if \(guardada\) \{ rede\.catch\(\(\) => null\); return guardada; \}/);
  assert.match(fb, /async function buscarConfigNaRede/);
  assert.match(fb, /localStorage\.setItem\(CHAVE_CFG_FIREBASE/);
});
