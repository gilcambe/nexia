'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { enviarDiario } = require('../../netlify/functions/prumo-lib/alertas.js');

function bancoFalso(pessoas) {
  const dados = {};
  for (const [uid, cols] of Object.entries(pessoas)) for (const [c, docs] of Object.entries(cols)) for (const [id, v] of Object.entries(docs)) dados[`${uid}/${c}/${id}`] = v;
  const col = (pref) => ({
    get: async () => ({ docs: Object.keys(dados).filter((k) => k.startsWith(pref + '/') && k.split('/').length === pref.split('/').length + 1).map((k) => ({ id: k.split('/').pop(), data: () => dados[k] })) }),
    doc: (id) => ({ get: async () => ({ exists: `${pref}/${id}` in dados, data: () => dados[`${pref}/${id}`] }), set: async (v) => { dados[`${pref}/${id}`] = v; }, collection: (c) => col(`${pref}/${id}/${c}`.replace(/^prumo_users\//, '')) }),
  });
  const raiz = { get: async () => ({ docs: Object.keys(pessoas).map((id) => ({ id, data: () => ({}) })) }), doc: (id) => ({ collection: (c) => col(`${id}/${c}`) }) };
  return { collection: () => raiz, dados };
}

const vencendo = { c1: { nome: 'Nubank', dia_vencimento: 9 } };
const cfgEmail = { alertas: { canais: { app: true, email: true }, email_para: 'a@exemplo.com', tipos: {} } };

test('AD1. só manda para quem ligou o e-mail, uma vez por dia, e não finge sucesso sem provedor', async () => {
  const db = bancoFalso({ ana12345: { config: cfgEmail, cartoes: vencendo }, bia12345: { cartoes: vencendo } });
  const env = { ...process.env }; delete process.env.BREVO_API_KEY;
  const semProvedor = await enviarDiario(db, '2026-11-08T11:00:00.000Z');
  process.env = env;
  assert.equal(semProvedor.pessoas, 1);
  assert.equal(semProvedor.enviados, 0);
  const mandados = [];
  const deps = { enviarEmail: async (m) => { mandados.push(m); return { ok: true }; } };
  const r = await enviarDiario(db, '2026-11-08T11:00:00.000Z', deps);
  assert.equal(r.enviados, 1);
  assert.equal(mandados[0].to, 'a@exemplo.com');
  const de_novo = await enviarDiario(db, '2026-11-08T15:00:00.000Z', deps);
  assert.equal(de_novo.ja_hoje, 1);
  assert.equal(mandados.length, 1);
});

test('AD2. sem BREVO_SENDER usa o remetente confirmado da conta Brevo', async () => {
  const antes = { ...process.env }; const fetchAntes = global.fetch;
  process.env.BREVO_API_KEY = 'k'; delete process.env.BREVO_SENDER;
  const chamadas = [];
  global.fetch = async (url, op) => { chamadas.push({ url, op }); return url.endsWith('/senders') ? { ok: true, json: async () => ({ senders: [{ email: 'x@y.com', active: false }, { email: 'ok@kernex.com', active: true }] }) } : { ok: true }; };
  try {
    const db = bancoFalso({ ana12345: { config: cfgEmail, cartoes: vencendo } });
    const r = await enviarDiario(db, '2026-11-08T11:00:00.000Z');
    assert.equal(r.enviados, 1);
    const envio = chamadas.find((c) => c.url.endsWith('/smtp/email'));
    assert.equal(JSON.parse(envio.op.body).sender.email, 'ok@kernex.com');
  } finally { process.env = antes; global.fetch = fetchAntes; }
});
