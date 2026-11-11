'use strict';
// KERNEX Propostas: lead → proposta → link público → aceite (lead vira cliente). Público nunca vê contato nem nota.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, COLECAO } = require('../../netlify/functions/propostas.js');

function fakeDb(leads = {}) {
  const cols = { [COLECAO]: new Map(), nexia_leads: new Map(Object.entries(leads)) };
  const col = name => {
    const m = cols[name];
    return {
      doc: id => ({
        get: async () => ({ exists: m.has(id), data: () => ({ ...m.get(id) }) }),
        set: async d => { m.set(id, { ...d }); },
        update: async p => { if (!m.has(id)) throw new Error('NOT_FOUND'); m.set(id, { ...m.get(id), ...p }); },
      }),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [...m].reverse().map(([id, d]) => ({ id, data: () => d })) }) }) }),
    };
  };
  return { cols, collection: col };
}
const mw = role => ({ verifyBearerToken: async e => (e.headers.authorization ? { ok: true, uid: 'dono', role } : { ok: false }) });
const T = 'a'.repeat(32);
const AGORA = Date.parse('2026-11-11T12:00:00Z');
const lead = { nome: 'Marina Costa', whatsapp: '11988887777', email: 'm@x.com', status: 'novo', nota: 'cliente quente' };
const h = (db, role = 'master') => createHandler({ getDb: () => db, getMw: () => mw(role), env: {}, novoToken: () => T, agora: () => AGORA });
const req = (method, body, { auth = false, q } = {}) => ({ httpMethod: method, headers: { 'cf-connecting-ip': '9.9.9.9', ...(auth ? { authorization: 'Bearer x' } : {}) }, ...(q ? { queryStringParameters: q } : {}), ...(body ? { body: JSON.stringify(body) } : {}) });
const criar = (o = {}) => req('POST', { acao: 'criar', lead_id: 'L1', produto: 'kernex-eventos', valor: 1490, mensalidade: 59.9, validade_dias: 7, condicoes: 'Entrada + 2x', ...o }, { auth: true });

test('PROP1. criar: só master/admin; valida produto, valor e lead; devolve link e texto do WhatsApp', async () => {
  const db = fakeDb({ L1: lead });
  assert.equal((await h(db)(req('POST', { acao: 'criar' }))).statusCode, 401);
  assert.equal((await h(db, 'user')(criar())).statusCode, 403);
  assert.equal((await h(db)(criar({ produto: 'erp' }))).statusCode, 400);
  assert.equal((await h(db)(criar({ valor: 0 }))).statusCode, 400);
  assert.equal((await h(db)(criar({ lead_id: 'L9' }))).statusCode, 404);
  const r = await h(db)(criar());
  assert.equal(r.statusCode, 201);
  const j = JSON.parse(r.body);
  assert.equal(j.link, `https://kernex.com.br/proposta.html?t=${T}`);
  assert.match(j.whatsapp_url, /^https:\/\/wa\.me\/5511988887777\?text=/);
  assert.match(j.texto, /Marina/);
  assert.match(j.texto, /eventos\.kernex\.com\.br/);
  assert.equal(db.cols.nexia_leads.get('L1').status, 'conversando');
});

test('PROP2. página pública: mostra produto, valor e demo; nunca WhatsApp, e-mail ou nota; registra que foi vista', async () => {
  const db = fakeDb({ L1: lead });
  await h(db)(criar());
  const r = await h(db)(req('GET', null, { q: { t: T } }));
  assert.equal(r.statusCode, 200);
  const p = JSON.parse(r.body).proposta;
  assert.equal(p.valor, 'R$ 1.490,00');
  assert.equal(p.mensalidade, 'R$ 59,90');
  assert.equal(p.titulo, 'KERNEX Eventos');
  assert.equal(p.nome, 'Marina');
  assert.doesNotMatch(r.body, /988887777|m@x\.com|quente/);
  assert.ok(db.cols[COLECAO].get(T).vista_em);
  assert.equal((await h(db)(req('GET', null, { q: { t: 'zzz' } }))).statusCode, 404);
});

test('PROP3. aceitar: proposta vira aceita e o lead vira cliente; repetir é idempotente; vencida é recusada', async () => {
  const db = fakeDb({ L1: lead });
  await h(db)(criar());
  const r = await h(db)(req('POST', { acao: 'aceitar', t: T }));
  assert.equal(r.statusCode, 200);
  assert.equal(db.cols[COLECAO].get(T).status, 'aceita');
  assert.equal(db.cols.nexia_leads.get('L1').status, 'cliente');
  assert.equal(JSON.parse((await h(db)(req('POST', { acao: 'aceitar', t: T }))).body).ja_aceita, true);
  const db2 = fakeDb({ L1: lead });
  await h(db2)(criar({ validade_dias: 1 }));
  const tarde = createHandler({ getDb: () => db2, getMw: () => mw('master'), env: {}, agora: () => AGORA + 2 * 864e5 });
  assert.equal((await tarde(req('POST', { acao: 'aceitar', t: T }))).statusCode, 410);
});

test('PROP4. cancelar: só o dono; proposta cancelada some da página pública', async () => {
  const db = fakeDb({ L1: lead });
  await h(db)(criar());
  assert.equal((await h(db)(req('PATCH', { t: T, status: 'cancelada' }))).statusCode, 401);
  assert.equal((await h(db)(req('PATCH', { t: T, status: 'cancelada' }, { auth: true }))).statusCode, 200);
  assert.equal((await h(db)(req('GET', null, { q: { t: T } }))).statusCode, 404);
  const lista = JSON.parse((await h(db)(req('GET', null, { auth: true }))).body).items;
  assert.equal(lista[0].status, 'cancelada');
});
