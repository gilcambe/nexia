'use strict';
// Vigia dos endereços públicos (#1014), com fetch falso e banco em memória.
const test = require('node:test');
const assert = require('node:assert');
const v = require('../../netlify/functions/central/vigia-sites');

const ROTAS = [{ id: 'bezsan', nome: 'Bezsan', url: 'https://bezsan.pages.dev/' }];
const OK = { ok: true, codigo: 200, tempo: 120 };
const CAIU = { ok: false, codigo: 0, tempo: 10000 };

function bancoFalso() {
  const docs = {};
  return {
    docs,
    collection: (c) => ({ doc: (d) => ({
      get: async () => ({ exists: !!docs[`${c}/${d}`], data: () => docs[`${c}/${d}`] }),
      set: async (x) => { docs[`${c}/${d}`] = x; },
    }) }),
  };
}
function githubFalso(abertas = []) {
  const criadas = [];
  const fetchImpl = async (url, o = {}) => {
    if ((o.method || 'GET') === 'GET') return { ok: true, status: 200, json: async () => abertas };
    const b = JSON.parse(o.body);
    criadas.push(b);
    abertas.push({ title: b.title });
    return { ok: true, status: 201, json: async () => ({}) };
  };
  return { fetchImpl, criadas };
}
const env = { NEXIA_JOBS_TOKEN: 't' };
const kernexNuncaNoAr = async () => CAIU;

test('VG1. 1 falha → nenhum alerta; 2 falhas seguidas → 1 alerta; 3ª falha não repete', async () => {
  const db = bancoFalso();
  const gh = githubFalso();
  const rodar = (m, hr) => v.vigiar(db, { at: Date.UTC(2026, 9, 19, hr), porRota: { bezsan: m }, rotas: ROTAS, medir: kernexNuncaNoAr, env, fetchImpl: gh.fetchImpl });
  assert.deepStrictEqual((await rodar(CAIU, 1)).alertas, []);
  assert.deepStrictEqual((await rodar(CAIU, 2)).alertas, ['bezsan']);
  assert.equal(gh.criadas.length, 1);
  assert.equal(gh.criadas[0].title, 'Site fora do ar: https://bezsan.pages.dev/');
  assert.deepStrictEqual(gh.criadas[0].labels, ['cortex-alerta']);
  assert.deepStrictEqual((await rodar(CAIU, 3)).alertas, []);
  assert.equal(gh.criadas.length, 1);
  // último resultado guardado (ok, código, tempo)
  const e = db.docs['saude_vigia/estado'].rotas.bezsan;
  assert.deepStrictEqual([e.ok, e.codigo, e.tempo, e.falhas], [false, 0, 10000, 3]);
});

test('VG2. falha, volta, falha → nenhum alerta (não é seguido)', () => {
  let r = v.avaliar({ medidas: { bezsan: CAIU }, rotas: ROTAS });
  r = v.avaliar({ estado: r.estado, medidas: { bezsan: OK }, rotas: ROTAS });
  r = v.avaliar({ estado: r.estado, medidas: { bezsan: CAIU }, rotas: ROTAS });
  assert.deepStrictEqual(r.alertas, []);
});

test('VG3. endereço Kernex que nunca respondeu é ignorado; depois de responder uma vez, vale a regra', () => {
  const K = v.KERNEX_ROTAS;
  let r = { estado: {} };
  for (let i = 0; i < 4; i++) r = v.avaliar({ estado: r.estado, medidas: { 'kernex-site': CAIU }, rotas: K });
  assert.deepStrictEqual(r.alertas, []);
  r = v.avaliar({ estado: r.estado, medidas: { 'kernex-site': OK }, rotas: K });
  r = v.avaliar({ estado: r.estado, medidas: { 'kernex-site': CAIU }, rotas: K });
  assert.deepStrictEqual(r.alertas, []);
  r = v.avaliar({ estado: r.estado, medidas: { 'kernex-site': CAIU }, rotas: K });
  assert.deepStrictEqual(r.alertas.map((a) => a.id), ['kernex-site']);
});

test('VG4. já existe issue aberta para a mesma URL → não abre outra; sem token, só guarda', async () => {
  const gh = githubFalso([{ title: 'Site fora do ar: https://bezsan.pages.dev/' }]);
  assert.equal(await v.abrirAlerta({ id: 'bezsan', nome: 'Bezsan', url: 'https://bezsan.pages.dev/' }, { token: 't', fetchImpl: gh.fetchImpl }), 'ja-aberta');
  assert.equal(gh.criadas.length, 0);
  const db = bancoFalso();
  await v.vigiar(db, { porRota: { bezsan: CAIU }, rotas: ROTAS, env: {} });
  const r = await v.vigiar(db, { porRota: { bezsan: CAIU }, rotas: ROTAS, env: {} });
  assert.deepStrictEqual(r.alertas, ['bezsan']);
  assert.deepStrictEqual(r.abertos, []);
});

test('VG5. o cron de saúde chama o vigia e devolve o resumo sem as medidas brutas', () => {
  const s = require('fs').readFileSync(require('path').join(__dirname, '../../cloudflare/saude.js'), 'utf8');
  assert.match(s, /vigia-sites\.js/);
  assert.match(s, /10000/);
  assert.match(s, /catch \(e\) \{ r\.vigia = /);
});

test('VS-EMAIL1. 2ª falha seguida manda 1 e-mail pelo Brevo (sem token do GitHub também)', async () => {
  const db = bancoFalso();
  const enviados = [];
  const fetchImpl = async (url, init) => { if (String(url).includes('brevo')) enviados.push(JSON.parse(init.body)); return { ok: true, status: 201 }; };
  const env = { BREVO_API_KEY: 'k', LEADS_NOTIFY_EMAIL: 'dono@exemplo.com' };
  const r1 = await v.vigiar(db, { porRota: { bezsan: CAIU }, rotas: ROTAS, env, fetchImpl });
  assert.strictEqual(r1.email, undefined);
  const r2 = await v.vigiar(db, { porRota: { bezsan: CAIU }, rotas: ROTAS, env, fetchImpl });
  assert.strictEqual(r2.email, 'enviado');
  const r3 = await v.vigiar(db, { porRota: { bezsan: CAIU }, rotas: ROTAS, env, fetchImpl });
  assert.strictEqual(r3.email, undefined);
  assert.strictEqual(enviados.length, 1);
  assert.match(enviados[0].subject, /Fora do ar: Bezsan/);
  assert.strictEqual(enviados[0].to[0].email, 'dono@exemplo.com');
});

test('VS-EMAIL2. sem BREVO_API_KEY ou sem e-mail, não manda', async () => {
  let chamou = false;
  const f = async () => { chamou = true; return { ok: true }; };
  assert.strictEqual(await v.enviarEmailAlerta([{ nome: 'x', url: 'u' }], { env: { BREVO_API_KEY: 'k' }, fetchImpl: f }), 'sem-config');
  assert.strictEqual(await v.enviarEmailAlerta([{ nome: 'x', url: 'u' }], { env: { LEADS_NOTIFY_EMAIL: 'a@b.co' }, fetchImpl: f }), 'sem-config');
  assert.strictEqual(chamou, false);
  assert.strictEqual(await v.enviarEmailAlerta([{ nome: 'x', url: 'u' }], { env: { BREVO_API_KEY: 'k', LEADS_NOTIFY_EMAIL: 'a@b.co' }, fetchImpl: async () => ({ ok: false, status: 401 }) }), 'erro-401');
});
