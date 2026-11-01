'use strict';
// #2840 — remetente confirmado no Brevo, destino LEADS_NOTIFY_EMAIL, messageId guardado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { __email } = require('../../netlify/functions/viajante-pro');

function fakeFetch(log, { senders = [{ email: 'ok@exemplo.com', active: true }], status = 201 } = {}) {
  return async (url, opt = {}) => {
    log.push({ url, opt });
    if (url.endsWith('/v3/senders')) return { ok: true, status: 200, json: async () => ({ senders }) };
    return { ok: status < 300, status, json: async () => (status < 300 ? { messageId: '<abc@brevo>' } : { message: 'erro' }) };
  };
}

test('usa o 1º remetente ativo do Brevo (nunca no-reply fixo) e guarda messageId', async () => {
  __email.__resetRemetenteCache();
  const log = []; const orig = globalThis.fetch; globalThis.fetch = fakeFetch(log, { senders: [{ email: 'x@y.com', active: false }, { email: 'ok@exemplo.com', active: true }] });
  try {
    const r = await __email.enviarEmailBrevo({ BREVO_API_KEY: 'k' }, { codigo: 'VP-1', nome: 'Ana <b>', email: 'ana@c.com', destino: 'Paris' });
    assert.equal(r.ok, true); assert.equal(r.messageId, '<abc@brevo>');
    const envio = JSON.parse(log.find(l => l.url.endsWith('/smtp/email')).opt.body);
    assert.equal(envio.sender.email, 'ok@exemplo.com');
    assert.equal(envio.to[0].email, 'cotacao.site@viajante.pro');
    assert.equal(envio.replyTo.email, 'ana@c.com');
    assert.ok(!envio.htmlContent.includes('<b>'), 'escapa HTML do cliente');
  } finally { globalThis.fetch = orig; }
});

test('BREVO_SENDER e LEADS_NOTIFY_EMAIL têm prioridade', async () => {
  __email.__resetRemetenteCache();
  const log = []; const orig = globalThis.fetch; globalThis.fetch = fakeFetch(log);
  try {
    await __email.enviarEmailBrevo({ BREVO_API_KEY: 'k', BREVO_SENDER: 'rem@a.com', LEADS_NOTIFY_EMAIL: 'dest@a.com' }, { codigo: 'VP-2', nome: 'B' });
    assert.ok(!log.some(l => l.url.endsWith('/v3/senders')));
    const envio = JSON.parse(log[0].opt.body);
    assert.equal(envio.sender.email, 'rem@a.com'); assert.equal(envio.to[0].email, 'dest@a.com');
  } finally { globalThis.fetch = orig; }
});

test('falha clara sem chave, sem remetente ou com erro do Brevo', async () => {
  __email.__resetRemetenteCache();
  assert.equal((await __email.enviarEmailBrevo({}, { codigo: 'VP-3' })).ok, false);
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = fakeFetch([], { senders: [] });
    const r1 = await __email.enviarCodigoBrevo({ BREVO_API_KEY: 'k' }, 'a@b.com', '123456');
    assert.equal(r1.ok, false); assert.match(r1.motivo, /remetente/);
    __email.__resetRemetenteCache();
    globalThis.fetch = fakeFetch([], { status: 401 });
    const r2 = await __email.enviarEmailBrevo({ BREVO_API_KEY: 'k' }, { codigo: 'VP-4' });
    assert.equal(r2.ok, false); assert.equal(r2.status, 401);
  } finally { globalThis.fetch = orig; }
});
