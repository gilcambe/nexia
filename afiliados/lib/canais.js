'use strict';
// Redes onde o robô posta sozinho. Cada canal só liga quando os segredos dele existem.
// Todas são APIs oficiais e grátis; nenhuma posta em grupo ou perfil de outra pessoa.
// WhatsApp não está aqui de propósito: os termos dele proíbem robô em grupos e canais (o número é banido).
const crypto = require('node:crypto');
const { textoPost, encurtar } = require('./texto');

class CanalErro extends Error {}
const tempo = () => AbortSignal.timeout(30000);

async function json(r, quem) {
  let j = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const msg = (j && (j.error_description || (j.error && (j.error.message || j.error)) || j.message || j.detail || j.description)) || `HTTP ${r.status}`;
    throw new CanalErro(`${quem}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`.slice(0, 300));
  }
  return j;
}

// ---------- Telegram (canal público de ofertas) ----------
const telegram = {
  id: 'telegram', nome: 'Canal do Telegram',
  ativo: env => !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CANAL),
  async publicar(o, { env, fetchImpl, quando }) {
    const caption = encurtar(textoPost(o, { quando }), 1024);
    const r = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: tempo(),
      body: JSON.stringify({ chat_id: env.TELEGRAM_CANAL, photo: o.imagem, caption }),
    });
    const j = await json(r, 'Telegram');
    return { ok: true, ref: String(j.result && j.result.message_id) };
  },
};

// ---------- Bluesky ----------
/** Posição em bytes UTF-8 (o Bluesky marca links por byte, não por caractere). */
const bytes = s => Buffer.byteLength(s, 'utf8');
function facetasDeLink(texto) {
  const out = [];
  const re = /https:\/\/\S+/g;
  let m;
  while ((m = re.exec(texto))) {
    const ini = bytes(texto.slice(0, m.index));
    out.push({ index: { byteStart: ini, byteEnd: ini + bytes(m[0]) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  return out;
}
const bluesky = {
  id: 'bluesky', nome: 'Bluesky',
  ativo: env => !!(env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD),
  async publicar(o, { env, fetchImpl, quando }) {
    const base = 'https://bsky.social/xrpc';
    const s = await json(await fetchImpl(`${base}/com.atproto.server.createSession`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: tempo(),
      body: JSON.stringify({ identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD }),
    }), 'Bluesky login');
    const auth = { Authorization: `Bearer ${s.accessJwt}` };
    let thumb;
    try {
      const img = await fetchImpl(o.imagem, { signal: tempo() });
      const buf = Buffer.from(await img.arrayBuffer());
      if (img.ok && buf.length < 950000) {
        const up = await json(await fetchImpl(`${base}/com.atproto.repo.uploadBlob`, {
          method: 'POST', headers: { ...auth, 'Content-Type': img.headers.get('content-type') || 'image/jpeg' }, body: buf, signal: tempo(),
        }), 'Bluesky foto');
        thumb = up.blob;
      }
    } catch { /* posta sem miniatura */ }
    const text = textoPost(o, { curto: true, quando, limite: 290, linkConta: null });
    const record = {
      $type: 'app.bsky.feed.post', text, createdAt: new Date(quando).toISOString(), langs: ['pt'],
      facets: facetasDeLink(text),
      embed: { $type: 'app.bsky.embed.external', external: { uri: o.link, title: encurtar(o.titulo, 100), description: 'Link de afiliado', ...(thumb ? { thumb } : {}) } },
    };
    const j = await json(await fetchImpl(`${base}/com.atproto.repo.createRecord`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, signal: tempo(),
      body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record }),
    }), 'Bluesky post');
    return { ok: true, ref: j.uri };
  },
};

// ---------- Pinterest ----------
const pinterest = {
  id: 'pinterest', nome: 'Pinterest',
  ativo: env => !!(env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET && env.PINTEREST_REFRESH_TOKEN && env.PINTEREST_BOARD_ID),
  async publicar(o, { env, fetchImpl, quando }) {
    // O token de acesso dura 30 dias; o de renovação, 1 ano. Renova a cada rodada para nunca vencer.
    const basic = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');
    const t = await json(await fetchImpl('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST', signal: tempo(),
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.PINTEREST_REFRESH_TOKEN }).toString(),
    }), 'Pinterest token');
    const j = await json(await fetchImpl('https://api.pinterest.com/v5/pins', {
      method: 'POST', signal: tempo(),
      headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: env.PINTEREST_BOARD_ID, link: o.link,
        title: encurtar(o.titulo, 100),
        description: encurtar(textoPost(o, { quando, link: '' }).replace(/\n?👉\s*\n?/, '\n'), 500),
        alt_text: encurtar(o.titulo, 500),
        media_source: { source_type: 'image_url', url: o.imagem },
      }),
    }), 'Pinterest pin');
    return { ok: true, ref: j.id };
  },
};

// ---------- X (Twitter), OAuth 1.0a ----------
const pct = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function oauth1(metodo, url, env, { nonce = crypto.randomBytes(16).toString('hex'), ts = Math.floor(Date.now() / 1000) } = {}) {
  const p = {
    oauth_consumer_key: env.X_API_KEY, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(ts), oauth_token: env.X_ACCESS_TOKEN, oauth_version: '1.0',
  };
  const base = [metodo.toUpperCase(), pct(url), pct(Object.keys(p).sort().map(k => `${pct(k)}=${pct(p[k])}`).join('&'))].join('&');
  p.oauth_signature = crypto.createHmac('sha1', `${pct(env.X_API_SECRET)}&${pct(env.X_ACCESS_SECRET)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(p).sort().map(k => `${pct(k)}="${pct(p[k])}"`).join(', ');
}
const x = {
  id: 'x', nome: 'X (Twitter)',
  ativo: env => !!(env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET),
  async publicar(o, { env, fetchImpl, quando }) {
    const url = 'https://api.x.com/2/tweets';
    const j = await json(await fetchImpl(url, {
      method: 'POST', signal: tempo(),
      headers: { Authorization: oauth1('POST', url, env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textoPost(o, { curto: true, quando }) }),
    }), 'X');
    return { ok: true, ref: j.data && j.data.id };
  },
};

// ---------- Facebook (página) e Instagram (conta comercial ligada à página) ----------
const GRAPH = 'https://graph.facebook.com/v21.0';
const facebook = {
  id: 'facebook', nome: 'Página do Facebook',
  ativo: env => !!(env.META_PAGE_ID && env.META_PAGE_TOKEN),
  async publicar(o, { env, fetchImpl, quando }) {
    const j = await json(await fetchImpl(`${GRAPH}/${encodeURIComponent(env.META_PAGE_ID)}/photos`, {
      method: 'POST', signal: tempo(),
      body: new URLSearchParams({ url: o.imagem, caption: textoPost(o, { quando }), access_token: env.META_PAGE_TOKEN }),
    }), 'Facebook');
    return { ok: true, ref: j.post_id || j.id };
  },
};
const instagram = {
  id: 'instagram', nome: 'Instagram',
  ativo: env => !!(env.META_IG_USER_ID && env.META_PAGE_TOKEN),
  // No Instagram o link na legenda não abre; o post manda para a página do produto no site (link na bio).
  async publicar(o, { env, fetchImpl, quando, linkSite }) {
    const conta = encodeURIComponent(env.META_IG_USER_ID);
    const legenda = textoPost(o, { quando, link: linkSite || 'link na bio' }).replace('👉 ', '👉 Link na bio: ');
    const c = await json(await fetchImpl(`${GRAPH}/${conta}/media`, {
      method: 'POST', signal: tempo(),
      body: new URLSearchParams({ image_url: o.imagem, caption: encurtar(legenda, 2200), access_token: env.META_PAGE_TOKEN }),
    }), 'Instagram mídia');
    const j = await json(await fetchImpl(`${GRAPH}/${conta}/media_publish`, {
      method: 'POST', signal: tempo(),
      body: new URLSearchParams({ creation_id: c.id, access_token: env.META_PAGE_TOKEN }),
    }), 'Instagram publicar');
    return { ok: true, ref: j.id };
  },
};

const CANAIS = [pinterest, facebook, instagram, x, bluesky, telegram];

module.exports = { CANAIS, CanalErro, facetasDeLink, oauth1 };
