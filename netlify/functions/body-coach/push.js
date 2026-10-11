'use strict';

// NEXIA Body Coach — avisos no celular (Web Push), grátis e sem serviço de terceiros:
// o próprio servidor cria as chaves VAPID na primeira vez (guardadas no banco, só o servidor lê),
// criptografa cada aviso (RFC 8291, aes128gcm) e entrega no serviço de push do navegador (Google, Apple, Mozilla).
// Só usa WebCrypto, que existe no Node e no Cloudflare Worker.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => new Uint8Array(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
const juntar = (...partes) => {
  const out = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
};

async function hmac(chave, dados) {
  const k = await subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, dados));
}
// HKDF com um só bloco (até 32 bytes), que é tudo o que o RFC 8291 precisa.
async function hkdf(sal, ikm, info, tamanho) {
  const prk = await hmac(sal, ikm);
  return (await hmac(prk, juntar(info, new Uint8Array([1])))).slice(0, tamanho);
}

// Criptografa o conteúdo para a assinatura (p256dh + auth do navegador). Devolve o corpo do POST.
async function criptografar(texto, p256dh, auth) {
  const chaveDele = deB64u(p256dh);
  const segredo = deB64u(auth);
  const efemera = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const minhaPublica = new Uint8Array(await subtle.exportKey('raw', efemera.publicKey));
  const dele = await subtle.importKey('raw', chaveDele, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartilhado = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: dele }, efemera.privateKey, 256));
  const ikm = await hkdf(segredo, compartilhado, juntar(enc.encode('WebPush: info\0'), chaveDele, minhaPublica), 32);
  const sal = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const chave = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const claro = juntar(enc.encode(texto), new Uint8Array([2])); // 2 = último (e único) registro
  const cifrado = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chave, claro));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([minhaPublica.length]), minhaPublica, cifrado);
}

// Chaves VAPID: criadas uma vez pelo servidor e guardadas em bc_config/vapid.
let cacheVapid = null;
async function chavesVapid(db) {
  if (cacheVapid) return cacheVapid;
  const ref = db.collection('bc_config').doc('vapid');
  let d = (await ref.get()).data?.();
  if (!d || !d.publica || !d.privada) {
    const par = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    d = { publica: b64u(await subtle.exportKey('raw', par.publicKey)), privada: await subtle.exportKey('jwk', par.privateKey), em: Date.now() };
    await ref.set(d);
    d = (await ref.get()).data?.() || d; // se dois pedidos criaram ao mesmo tempo, fica o que ficou gravado
  }
  const privada = await subtle.importKey('jwk', d.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  cacheVapid = { publica: d.publica, privada };
  return cacheVapid;
}

async function jwtVapid(vapid, endpoint) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:contato@nexia.app' })));
  const ass = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.privada, enc.encode(`${cab}.${corpo}`));
  return `${cab}.${corpo}.${b64u(ass)}`;
}

const ENDPOINT_OK = (e) => {
  try {
    const u = new URL(e);
    if (u.protocol === 'https:') return true;
    // só para os testes locais (servidor de push falso na própria máquina)
    return u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) && !!process.env.FIRESTORE_EMULATOR_HOST;
  } catch { return false; }
};

// Manda um aviso para uma assinatura. Devolve o status HTTP (404/410 = assinatura morta).
async function enviarUm(db, sub, conteudo) {
  const vapid = await chavesVapid(db);
  const corpo = await criptografar(JSON.stringify(conteudo), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '86400', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Urgency: conteudo.urgente ? 'high' : 'normal', Authorization: `vapid t=${await jwtVapid(vapid, sub.endpoint)}, k=${vapid.publica}` },
    body: corpo,
  });
  return r.status;
}

const PREFS_PADRAO = { mensagens: true, treino: { ativo: false, hora: '18:00' }, agua: { ativo: false, de: '08:00', ate: '20:00', cada: 2 }, mensalidade: true };
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const slot = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 5) * 5).padStart(2, '0')}`; };

function prefsLimpas(p) {
  const x = p && typeof p === 'object' ? p : {};
  const t = x.treino || {};
  const a = x.agua || {};
  return {
    mensagens: x.mensagens !== false,
    treino: { ativo: !!t.ativo, hora: HORA.test(t.hora) ? t.hora : '18:00' },
    agua: { ativo: !!a.ativo, de: HORA.test(a.de) ? a.de : '08:00', ate: HORA.test(a.ate) ? a.ate : '20:00', cada: [1, 2, 3].includes(Number(a.cada)) ? Number(a.cada) : 2 },
    mensalidade: x.mensalidade !== false,
  };
}

// Horários (em blocos de 5 min, hora de Brasília) em que esta pessoa recebe lembrete: o robô de 5 em 5 min só lê quem é da vez.
function horariosDe(prefs) {
  const h = new Set();
  if (prefs.treino.ativo) h.add(slot(prefs.treino.hora));
  if (prefs.agua.ativo) {
    const min = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
    for (let t = min(prefs.agua.de); t <= min(prefs.agua.ate); t += prefs.agua.cada * 60) h.add(slot(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`));
  }
  return [...h].sort();
}

// Envia para todos os aparelhos da pessoa; tira os que o navegador já descartou.
async function avisar(db, uid, conteudo, tipo = 'mensagens') {
  const ref = db.collection('bc_push').doc(uid);
  const d = (await ref.get()).data?.();
  if (!d || !Array.isArray(d.subs) || !d.subs.length) return 0;
  const prefs = prefsLimpas(d.prefs);
  if (tipo === 'mensagens' && !prefs.mensagens) return 0;
  if (tipo === 'mensalidade' && !prefs.mensalidade) return 0;
  const status = await Promise.all(d.subs.map((s) => enviarUm(db, s, conteudo).catch(() => 0)));
  const vivas = d.subs.filter((_, i) => status[i] !== 404 && status[i] !== 410);
  if (vivas.length !== d.subs.length) await ref.set({ subs: vivas }, { merge: true });
  return status.filter((s) => s >= 200 && s < 300).length;
}

// Para não segurar a resposta do app: espera no máximo 3 s pelo aviso.
const semEsperarMuito = (p) => Promise.race([p.catch(() => 0), new Promise((r) => setTimeout(() => r(0), 3000))]);
const avisarConversa = (db, para, deNome, texto) => semEsperarMuito(avisar(db, para, { titulo: deNome || 'Nova mensagem', corpo: String(texto || '').slice(0, 180), url: 'chat', tag: 'conversa' }));

async function acoesPush(body, uid, db) {
  const acao = body.acao;
  const ref = db.collection('bc_push').doc(uid);
  if (acao === 'push_chave') return [200, { chave: (await chavesVapid(db)).publica }];
  if (acao === 'push_ver') {
    const d = (await ref.get()).data?.() || {};
    return [200, { prefs: prefsLimpas(d.prefs), aparelhos: Array.isArray(d.subs) ? d.subs.length : 0 }];
  }
  if (acao === 'push_assinar') {
    const s = body.sub || {};
    const sub = { endpoint: typeof s.endpoint === 'string' ? s.endpoint.slice(0, 800) : '', p256dh: String((s.keys && s.keys.p256dh) || '').slice(0, 200), auth: String((s.keys && s.keys.auth) || '').slice(0, 60), em: Date.now() };
    if (!ENDPOINT_OK(sub.endpoint) || deB64u(sub.p256dh).length !== 65 || deB64u(sub.auth).length < 16) return [400, { error: 'Este aparelho não aceitou os avisos.' }];
    const d = (await ref.get()).data?.() || {};
    const prefs = prefsLimpas(body.prefs || d.prefs || PREFS_PADRAO);
    const subs = [...(Array.isArray(d.subs) ? d.subs : []).filter((x) => x.endpoint !== sub.endpoint), sub].slice(-5);
    await ref.set({ subs, prefs, horarios: horariosDe(prefs), em: Date.now() });
    return [200, { prefs, aparelhos: subs.length }];
  }
  if (acao === 'push_prefs') {
    const d = (await ref.get()).data?.() || {};
    const prefs = prefsLimpas(body.prefs);
    await ref.set({ subs: Array.isArray(d.subs) ? d.subs : [], prefs, horarios: horariosDe(prefs), em: Date.now() });
    return [200, { prefs }];
  }
  if (acao === 'push_cancelar') {
    const d = (await ref.get()).data?.() || {};
    const subs = (Array.isArray(d.subs) ? d.subs : []).filter((x) => x.endpoint !== body.endpoint);
    await ref.set({ subs }, { merge: true });
    return [200, { aparelhos: subs.length }];
  }
  if (acao === 'push_testar') {
    const n = await avisar(db, uid, { titulo: 'NEXIA Body Coach', corpo: 'Pronto! Os avisos estão chegando neste celular. 💪', url: '', tag: 'teste' }, 'teste');
    return n ? [200, { enviados: n }] : [409, { error: 'Não consegui avisar este celular. Ative os avisos de novo.' }];
  }
  return null;
}

module.exports = { acoesPush, avisar, avisarConversa, criptografar, chavesVapid, prefsLimpas, horariosDe, slot, PREFS_PADRAO, deB64u, b64u, hkdf };
