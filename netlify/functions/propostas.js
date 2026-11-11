'use strict';
// KERNEX Propostas — o dono transforma um lead em proposta de um produto pronto (KERNEX Eventos, KERNEX Viagens),
// manda o link pelo WhatsApp (o dono aperta "enviar"; nada é disparado em massa) e o cliente aceita pela página.
//
// GET  /api/propostas?t=TOKEN            (público)  → proposta para a página kernex.com.br/proposta.html
// POST /api/propostas {acao:'aceitar',t} (público)  → cliente aceita; o lead vira "cliente" e o dono é avisado
// POST /api/propostas {acao:'criar', lead_id, produto, valor, ...} (master/admin) → cria e devolve link + texto do WhatsApp
// GET  /api/propostas?lista=1            (master/admin) → últimas 200 propostas
// PATCH /api/propostas {t, status:'cancelada'} (master/admin)
// O preço NÃO é fixo no código: quem define é o dono em cada proposta.
const crypto = require('crypto');

const COLECAO = 'kernex_propostas';
const LEADS = 'nexia_leads';
const SITE = 'https://kernex.com.br';
const PRODUTOS = {
  'kernex-eventos': {
    titulo: 'KERNEX Eventos',
    resumo: 'Site próprio do seu espaço de eventos ou lazer, com agenda de reservas e painel para você editar.',
    demo: 'https://eventos.kernex.com.br',
    itens: ['Site no endereço seunome.kernex.com.br', 'Agenda de reservas com calendário e preço por dia', 'Galeria de fotos e vídeos',
      'Botão de WhatsApp direto para você', 'Painel para editar textos, fotos e preços', 'Pronto para aparecer no Google'],
  },
  'kernex-viagens': {
    titulo: 'KERNEX Viagens',
    resumo: 'Site da sua agência com pacotes, pedido de orçamento, área do viajante e painel da agência.',
    demo: 'https://viagens.kernex.com.br',
    itens: ['Site no endereço seunome.kernex.com.br', 'Vitrine de pacotes e destinos', 'Pedido de orçamento direto para a agência',
      'Área do viajante com código da viagem', 'Painel da agência para editar conteúdo', 'Botão de WhatsApp da agência'],
  },
};
const STATUS = ['enviada', 'aceita', 'cancelada'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const brl = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const waNum = n => { const d = String(n || '').replace(/\D/g, ''); return d && d.length <= 11 ? '55' + d : d; };
const tokenOk = t => /^[a-f0-9]{32}$/.test(String(t || ''));

const _hits = new Map();
function ipOk(ip, now = Date.now()) {
  if (!ip) return true;
  const e = _hits.get(ip);
  if (!e || now - e.start > 60_000) { if (_hits.size > 5000) _hits.clear(); _hits.set(ip, { start: now, n: 1 }); return true; }
  return ++e.n <= 10;
}

/** O que o cliente vê: sem WhatsApp, e-mail ou nota interna. */
function publica(p, agora = Date.now()) {
  const prod = PRODUTOS[p.produto] || {};
  return {
    nome: p.primeiro_nome, produto: p.produto, titulo: prod.titulo, resumo: prod.resumo, itens: prod.itens, demo: prod.demo,
    valor: brl(p.valor), mensalidade: p.mensalidade ? brl(p.mensalidade) : null, condicoes: p.condicoes || '',
    validade: p.validade, expirada: Date.parse(p.validade) < agora, status: p.status,
  };
}

function textoWhats(p, link) {
  const prod = PRODUTOS[p.produto];
  return `Olá, ${p.primeiro_nome}! Aqui é da KERNEX. Preparei sua proposta do ${prod.titulo}: ${link}\n`
    + `Você pode ver a demonstração funcionando em ${prod.demo}. Qualquer dúvida, é só responder aqui.`;
}

async function avisar(env, fetchImpl, assunto, texto) {
  const key = env.BREVO_API_KEY, to = env.LEADS_NOTIFY_EMAIL;
  if (!key || !to || typeof fetchImpl !== 'function') return false;
  try {
    const r = await fetchImpl('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'KERNEX Propostas', email: to }, to: [{ email: to }], subject: assunto, textContent: texto }) });
    return !!(r && r.ok);
  } catch { return false; }
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const novoToken = deps.novoToken || (() => crypto.randomBytes(16).toString('hex'));
  const agora = deps.agora || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const q = event.queryStringParameters || {};
    const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    let body = {};
    if (event.body) { try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const col = db.collection(COLECAO);

    // ── Público: ver e aceitar ──
    if (method === 'GET' && q.t !== undefined) {
      if (!tokenOk(q.t)) return res(404, { error: 'Proposta não encontrada.' });
      const s = await col.doc(q.t).get();
      if (!s.exists) return res(404, { error: 'Proposta não encontrada.' });
      const p = s.data();
      if (p.status === 'cancelada') return res(404, { error: 'Esta proposta não está mais disponível.' });
      if (!p.vista_em) await col.doc(q.t).update({ vista_em: new Date(agora()).toISOString() });   // o dono sabe que o cliente abriu
      return res(200, { proposta: publica(p, agora()) });
    }
    if (method === 'POST' && body.acao === 'aceitar') {
      const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (!ipOk(ip)) return res(429, { error: 'Muitas tentativas. Tente de novo em 1 minuto.' });
      if (!tokenOk(body.t)) return res(404, { error: 'Proposta não encontrada.' });
      const s = await col.doc(body.t).get();
      if (!s.exists) return res(404, { error: 'Proposta não encontrada.' });
      const p = s.data();
      if (p.status === 'cancelada') return res(404, { error: 'Esta proposta não está mais disponível.' });
      if (p.status === 'aceita') return res(200, { ok: true, ja_aceita: true });
      if (Date.parse(p.validade) < agora()) return res(410, { error: 'A validade desta proposta terminou. Fale com a KERNEX pelo WhatsApp para renovar.' });
      const quando = new Date(agora()).toISOString();
      await col.doc(body.t).update({ status: 'aceita', aceita_em: quando });
      try { await db.collection(LEADS).doc(p.lead_id).update({ status: 'cliente', atualizado_em: quando, atualizado_por: 'proposta-aceita' }); } catch { /* lead apagado: a proposta vale mesmo assim */ }
      await avisar(deps.env || process.env, fetchImpl, `Proposta ACEITA: ${p.primeiro_nome} (${PRODUTOS[p.produto].titulo})`,
        `${p.nome} aceitou a proposta de ${brl(p.valor)} do ${PRODUTOS[p.produto].titulo}.\nWhatsApp: https://wa.me/${waNum(p.whatsapp)}\nPróximo passo: criar o cliente na Central (Novo cliente).`);
      return res(200, { ok: true });
    }

    // ── Painel: só master ou admin ──
    const auth = await getMw().verifyBearerToken(event);
    if (!auth.ok) return res(401, { error: 'Entre na sua conta.' });
    if (auth.role !== 'master' && auth.role !== 'admin') return res(403, { error: 'Só master ou admin cria propostas.' });

    if (method === 'GET') {
      const snap = await col.orderBy('criado_em', 'desc').limit(200).get();
      return res(200, { items: snap.docs.map(d => { const p = d.data(); return { t: d.id, nome: p.nome, produto: p.produto, valor: p.valor, status: p.status, validade: p.validade, vista_em: p.vista_em || null, aceita_em: p.aceita_em || null, criado_em: p.criado_em, link: `${SITE}/proposta.html?t=${d.id}` }; }) });
    }
    if (method === 'POST' && body.acao === 'criar') {
      const produto = str(body.produto, 40);
      if (!PRODUTOS[produto]) return res(400, { error: 'Produto inválido.', produtos: Object.keys(PRODUTOS) });
      const valor = Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 1e6) return res(400, { error: 'Informe o valor da proposta (em reais).' });
      const mensalidade = body.mensalidade === undefined || body.mensalidade === '' ? 0 : Number(body.mensalidade);
      if (!Number.isFinite(mensalidade) || mensalidade < 0 || mensalidade > 1e5) return res(400, { error: 'Mensalidade inválida.' });
      const dias = Math.min(60, Math.max(1, Math.round(Number(body.validade_dias) || 7)));
      const leadId = str(body.lead_id, 64);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(leadId)) return res(400, { error: 'Lead inválido.' });
      const ls = await db.collection(LEADS).doc(leadId).get();
      if (!ls.exists) return res(404, { error: 'Lead não encontrado.' });
      const lead = ls.data();
      if (!lead.whatsapp) return res(400, { error: 'Este lead não tem WhatsApp; a proposta é enviada por WhatsApp.' });
      const t = novoToken();
      const quando = new Date(agora());
      const p = {
        lead_id: leadId, nome: lead.nome, primeiro_nome: String(lead.nome).split(/\s+/)[0], whatsapp: lead.whatsapp,
        produto, valor, mensalidade, condicoes: str(body.condicoes, 600), status: 'enviada',
        validade: new Date(quando.getTime() + dias * 864e5).toISOString(), criado_em: quando.toISOString(), criado_por: auth.uid,
      };
      await col.doc(t).set(p);
      if (lead.status === 'novo') await db.collection(LEADS).doc(leadId).update({ status: 'conversando', atualizado_em: p.criado_em, atualizado_por: auth.uid });
      const link = `${SITE}/proposta.html?t=${t}`;
      const texto = textoWhats(p, link);
      return res(201, { ok: true, t, link, texto, whatsapp_url: `https://wa.me/${waNum(lead.whatsapp)}?text=${encodeURIComponent(texto)}` });
    }
    if (method === 'PATCH') {
      if (!tokenOk(body.t)) return res(400, { error: 'Proposta inválida.' });
      if (!STATUS.includes(body.status) || body.status !== 'cancelada') return res(400, { error: 'Só é possível cancelar.' });
      await col.doc(body.t).update({ status: 'cancelada', cancelada_em: new Date(agora()).toISOString() });
      return res(200, { ok: true });
    }
    return res(405, { error: 'Method Not Allowed' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.PRODUTOS = PRODUTOS;
exports.publica = publica;
exports.COLECAO = COLECAO;
