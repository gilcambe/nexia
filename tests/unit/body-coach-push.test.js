'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { executar } = require('../../netlify/functions/body-coach-chat.js');
const push = require('../../netlify/functions/body-coach/push.js');
const { rodarLembretes } = require('../../netlify/functions/body-coach/lembretes.js');

const subtle = globalThis.crypto.subtle;
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => (op === 'array-contains' ? (d.data()[campo] || []).includes(val) : d.data()[campo] === val)) }) }) }),
    orderBy: (campo) => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).sort((a, b) => String(b.data()[campo]).localeCompare(String(a.data()[campo]))).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}

// Um "navegador" de mentira: chaves do aparelho e um serviço de push local que decifra o que chega.
async function aparelho() {
  const chaves = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', chaves.publicKey));
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const recebidos = [];
  let status = 201;
  const srv = http.createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', async () => {
      const corpo = new Uint8Array(Buffer.concat(partes));
      const sal = corpo.slice(0, 16);
      const tamId = corpo[20];
      const deles = corpo.slice(21, 21 + tamId);
      const cifrado = corpo.slice(21 + tamId);
      const pubDeles = await subtle.importKey('raw', deles, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const comp = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pubDeles }, chaves.privateKey, 256));
      const enc = new TextEncoder();
      const ikm = await push.hkdf(auth, comp, new Uint8Array([...enc.encode('WebPush: info\0'), ...pub, ...deles]), 32);
      const cek = await push.hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
      const nonce = await push.hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
      const k = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const claro = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cifrado));
      recebidos.push({ headers: req.headers, conteudo: JSON.parse(new TextDecoder().decode(claro.slice(0, -1))) });
      res.writeHead(status); res.end();
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const endpoint = `http://127.0.0.1:${srv.address().port}/push/${Math.random().toString(36).slice(2)}`;
  return { sub: { endpoint, keys: { p256dh: push.b64u(pub), auth: push.b64u(auth) } }, recebidos, fechar: () => srv.close(), morrer: () => { status = 410; } };
}

test('BCPU1. avisos: assina, recebe mensagem do coach criptografada (RFC 8291) com VAPID válido, e assinatura morta sai', async () => {
  process.env.FIRESTORE_EMULATOR_HOST ||= 'teste';
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  const cel = await aparelho();
  try {
    const [s0, k] = await executar({ acao: 'push_chave' }, 'ana', db);
    assert.equal(s0, 200);
    assert.equal(push.deB64u(k.chave).length, 65);
    assert.equal((await executar({ acao: 'push_assinar', sub: { endpoint: 'http://evil.com/x', keys: cel.sub.keys } }, 'ana', db))[0], 400);
    const [s1, r1] = await executar({ acao: 'push_assinar', sub: cel.sub }, 'ana', db);
    assert.equal(s1, 200);
    assert.equal(r1.aparelhos, 1);
    await executar({ acao: 'enviar', com: 'ana', texto: 'Bora treinar hoje?' }, 'coach1', db);
    assert.equal(cel.recebidos.length, 1);
    const m = cel.recebidos[0];
    assert.deepEqual({ t: m.conteudo.titulo, c: m.conteudo.corpo, u: m.conteudo.url }, { t: 'Gil', c: 'Bora treinar hoje?', u: 'chat' });
    assert.equal(m.headers['content-encoding'], 'aes128gcm');
    // assinatura VAPID confere com a chave pública
    const [, jwt, kk] = m.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
    assert.equal(kk, k.chave);
    const [h, p, sig] = jwt.split('.');
    const pubV = await subtle.importKey('raw', push.deB64u(kk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubV, push.deB64u(sig), new TextEncoder().encode(`${h}.${p}`)));
    assert.equal(JSON.parse(Buffer.from(p, 'base64').toString()).aud, new URL(cel.sub.endpoint).origin);
    // desligou "mensagens": não avisa
    await executar({ acao: 'push_prefs', prefs: { mensagens: false } }, 'ana', db);
    await executar({ acao: 'enviar', com: 'ana', texto: 'oi' }, 'coach1', db);
    assert.equal(cel.recebidos.length, 1);
    // teste manual
    assert.equal((await executar({ acao: 'push_testar' }, 'ana', db))[0], 200);
    assert.equal(cel.recebidos.length, 2);
    // navegador descartou: sai da lista
    cel.morrer();
    assert.equal((await executar({ acao: 'push_testar' }, 'ana', db))[0], 409);
    assert.equal(db.dados.bc_push.ana.subs.length, 0);
  } finally { cel.fechar(); }
});

test('BCPU2. lembretes: horário certo, sem treino hoje, não repete no mesmo bloco', async () => {
  process.env.FIRESTORE_EMULATOR_HOST ||= 'teste';
  const db = fakeDb();
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  const cel = await aparelho();
  try {
    const prefs = { treino: { ativo: true, hora: '18:02' }, agua: { ativo: true, de: '08:00', ate: '12:00', cada: 2 } };
    await executar({ acao: 'push_assinar', sub: cel.sub, prefs }, 'ana', db);
    assert.deepEqual(db.dados.bc_push.ana.horarios, ['08:00', '10:00', '12:00', '18:00']);
    const as = (hhmm) => Date.parse(`2026-10-12T${hhmm}:00-03:00`);
    assert.equal((await rodarLembretes(db, as('09:00'))).pessoas, 0);
    await rodarLembretes(db, as('10:01'));
    assert.equal(cel.recebidos.at(-1).conteudo.tag, 'agua');
    await rodarLembretes(db, as('10:03'));
    assert.equal(cel.recebidos.length, 1, 'não repete no mesmo bloco');
    await rodarLembretes(db, as('18:04'));
    assert.equal(cel.recebidos.at(-1).conteudo.tag, 'treino');
    // já treinou hoje: não lembra do treino
    await db.collection('bc_diretorio').doc('ana').set({ ultimoTreino: as('07:00') }, { merge: true });
    await db.collection('bc_push').doc('ana').set({ ultimoLembrete: '' }, { merge: true });
    const antes = cel.recebidos.length;
    await rodarLembretes(db, as('18:00'));
    assert.equal(cel.recebidos.length, antes, 'treinou hoje: sem lembrete de treino (e água fora do horário)');
  } finally { cel.fechar(); }
});
