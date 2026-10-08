'use strict';

// NEXIA Leads — captura de contatos de qualquer site ou app NEXIA (grátis: Worker + Firestore).
//
// POST /api/leads   (público)  → grava um lead. Qualquer site manda (Site Kit, nexia-leads.js).
//                               O corpo vai como text/plain com JSON: assim o navegador não faz
//                               "preflight" e funciona de qualquer domínio (nome.pages.dev etc.).
// GET  /api/leads   (master/admin) → últimos 300 leads, mais novos primeiro.
// PATCH /api/leads  (master/admin) → { id, status?, nota? } muda o andamento do lead.
// DELETE /api/leads (master/admin) → { id } apaga o lead (LGPD: direito de exclusão).
//
// Aviso por e-mail (opcional, grátis): com BREVO_API_KEY e LEADS_NOTIFY_EMAIL, cada lead novo
// manda um e-mail para o dono (plano grátis do Brevo: 300 e-mails por dia). Sem as chaves, só grava.

const COLLECTION = 'nexia_leads';
const STATUS = ['novo', 'conversando', 'testando', 'cliente', 'perdido'];
const UTM = ['source', 'medium', 'campaign', 'content', 'term'];
const PER_IP = { max: 5, windowMs: 60_000 };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i;

/** Valida e limpa o lead que veio do site. Devolve { lead } ou { error }. */
function cleanLead(body, headers = {}) {
  const nome = str(body.nome, 120);
  const whatsapp = digits(body.whatsapp || body.telefone).slice(0, 15);
  const email = str(body.email, 200).toLowerCase();
  if (nome.length < 2) return { error: 'Informe seu nome.' };
  if (!whatsapp && !email) return { error: 'Informe WhatsApp ou e-mail.' };
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return { error: 'WhatsApp inválido: use DDD + número.' };
  if (email && !EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
  if (body.consentimento !== true) return { error: 'É preciso aceitar o contato (LGPD).' };
  const utm = {};
  const u = body.utm && typeof body.utm === 'object' ? body.utm : {};
  for (const k of UTM) { const v = str(u[k], 120); if (v) utm[k] = v; }
  let site = str(body.site, 200);
  if (!site) { try { site = new URL(headers.origin || headers.referer || '').hostname; } catch { site = ''; } }
  return { lead: {
    nome, whatsapp, email,
    mensagem: str(body.mensagem, 2000),
    produto: str(body.produto, 60).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'geral',
    site,
    pagina: str(body.pagina, 300),
    utm,
    consentimento: true,
    status: 'novo',
    nota: '',
    criado_em: new Date().toISOString(),
  } };
}

/** Rate limit por IP em memória (1 instância do Worker); barato e sem gastar cota do Firestore. */
const _hits = new Map();
function ipAllowed(ip, now = Date.now()) {
  if (!ip) return true;
  const e = _hits.get(ip);
  if (!e || now - e.start > PER_IP.windowMs) {
    if (_hits.size > 5000) _hits.clear();
    _hits.set(ip, { start: now, n: 1 });
    return true;
  }
  e.n += 1;
  return e.n <= PER_IP.max;
}

async function notifyByEmail(lead, env, fetchImpl) {
  const key = env.BREVO_API_KEY, to = env.LEADS_NOTIFY_EMAIL;
  if (!key || !to || typeof fetchImpl !== 'function') return false;
  const linhas = [
    `Nome: ${lead.nome}`,
    lead.whatsapp && `WhatsApp: https://wa.me/${lead.whatsapp.length <= 11 ? '55' + lead.whatsapp : lead.whatsapp}`,
    lead.email && `E-mail: ${lead.email}`,
    `Produto: ${lead.produto}`,
    lead.site && `Site: ${lead.site}`,
    Object.keys(lead.utm).length && `Origem: ${Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    lead.mensagem && `Mensagem: ${lead.mensagem}`,
  ].filter(Boolean);
  try {
    const r = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'NEXIA Leads', email: to },
        to: [{ email: to }],
        subject: `Novo lead: ${lead.nome} (${lead.produto})`,
        textContent: linhas.join('\n'),
      }),
    });
    return !!(r && r.ok);
  } catch { return false; }
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch : null);

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    // POST é público e vem de qualquer domínio; o resto é só do painel (mesmo domínio, com login).
    const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    let body = {};
    if (event.body) { try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    if (method === 'POST') {
      // Armadilha para robôs: campo escondido que gente de verdade não preenche.
      if (str(body.site_url, 10)) return res(200, { ok: true });
      const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (!ipAllowed(ip)) return res(429, { error: 'Muitos envios seguidos. Tente de novo em 1 minuto.' });
      const { lead, error } = cleanLead(body, headers);
      if (error) return res(400, { error });
      const db = getDb();
      if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
      const ref = await db.collection(COLLECTION).add(lead);
      await notifyByEmail(lead, deps.env || process.env, fetchImpl);
      return res(201, { ok: true, id: ref.id });
    }

    // Painel: só master ou admin.
    const auth = await getMw().verifyBearerToken(event);
    if (!auth.ok) return res(401, { error: 'Entre na sua conta.' });
    if (auth.role !== 'master' && auth.role !== 'admin') return res(403, { error: 'Só master ou admin vê os leads.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível.' });

    if (method === 'GET') {
      const snap = await db.collection(COLLECTION).orderBy('criado_em', 'desc').limit(300).get();
      return res(200, { items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    const id = str(body.id, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res(400, { error: 'Lead inválido.' });
    const ref = db.collection(COLLECTION).doc(id);
    if (method === 'PATCH') {
      const patch = {};
      if (body.status !== undefined) {
        if (!STATUS.includes(body.status)) return res(400, { error: 'Status inválido.' });
        patch.status = body.status;
      }
      if (body.nota !== undefined) patch.nota = str(body.nota, 1000);
      if (!Object.keys(patch).length) return res(400, { error: 'Nada para mudar.' });
      patch.atualizado_em = new Date().toISOString();
      patch.atualizado_por = auth.uid;
      await ref.update(patch);
      return res(200, { ok: true });
    }
    if (method === 'DELETE') {
      await ref.delete();
      return res(200, { ok: true });
    }
    return res(405, { error: 'Method Not Allowed' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.cleanLead = cleanLead;
exports.STATUS = STATUS;
exports.COLLECTION = COLLECTION;
