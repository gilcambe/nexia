'use strict';
// Biblioteca de canais de divulgação reutilizando a lógica de afiliados.
// Canais: facebook, instagram, pinterest, bluesky e threads.
// Segredos com prefixo DIVULGA_.

const afiliadosCanais = require('../../afiliados/lib/canais');

const tempo = () => AbortSignal.timeout(30000);

async function json(r, quem) {
  let j = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const msg = (j && (j.error_description || (j.error && (j.error.message || j.error)) || j.message || j.detail || j.description)) || `HTTP ${r.status}`;
    throw new afiliadosCanais.CanalErro(`${quem}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`.slice(0, 300));
  }
  return j;
}

// ---------- Facebook (página) ----------
const GRAPH = 'https://graph.facebook.com/v21.0';
const facebook = {
  id: 'facebook',
  nome: 'Página do Facebook',
  ativo: env => !!(env.DIVULGA_META_PAGE_ID && env.DIVULGA_META_PAGE_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    const textoCompleto = [post.titulo, post.texto, post.link].filter(Boolean).join('\n\n');
    const r = await fetchImpl(`${GRAPH}/${encodeURIComponent(env.DIVULGA_META_PAGE_ID)}/photos`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        url: post.imagem,
        caption: textoCompleto,
        access_token: env.DIVULGA_META_PAGE_TOKEN,
      }),
    });
    const j = await json(r, 'Facebook');
    return { ok: true, ref: j.post_id || j.id };
  },
};

// ---------- Instagram (conta comercial) ----------
const instagram = {
  id: 'instagram',
  nome: 'Instagram',
  ativo: env => !!(env.DIVULGA_META_IG_USER_ID && env.DIVULGA_META_PAGE_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    const conta = encodeURIComponent(env.DIVULGA_META_IG_USER_ID);
    const legenda = [post.titulo, post.texto, post.link ? `Link: ${post.link}` : ''].filter(Boolean).join('\n\n');
    const c = await json(await fetchImpl(`${GRAPH}/${conta}/media`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        image_url: post.imagem,
        caption: legenda.slice(0, 2200),
        access_token: env.DIVULGA_META_PAGE_TOKEN,
      }),
    }), 'Instagram mídia');
    const j = await json(await fetchImpl(`${GRAPH}/${conta}/media_publish`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        creation_id: c.id,
        access_token: env.DIVULGA_META_PAGE_TOKEN,
      }),
    }), 'Instagram publicar');
    return { ok: true, ref: j.id };
  },
};

// ---------- Pinterest ----------
const pinterest = {
  id: 'pinterest',
  nome: 'Pinterest',
  ativo: env => !!(env.DIVULGA_PINTEREST_APP_ID && env.DIVULGA_PINTEREST_APP_SECRET && env.DIVULGA_PINTEREST_REFRESH_TOKEN && env.DIVULGA_PINTEREST_BOARD_ID),
  async publicar(post, { env, fetchImpl }) {
    const basic = Buffer.from(`${env.DIVULGA_PINTEREST_APP_ID}:${env.DIVULGA_PINTEREST_APP_SECRET}`).toString('base64');
    const t = await json(await fetchImpl('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      signal: tempo(),
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: env.DIVULGA_PINTEREST_REFRESH_TOKEN,
      }).toString(),
    }), 'Pinterest token');
    const desc = [post.texto, post.link].filter(Boolean).join('\n\n');
    const j = await json(await fetchImpl('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      signal: tempo(),
      headers: {
        Authorization: `Bearer ${t.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board_id: env.DIVULGA_PINTEREST_BOARD_ID,
        link: post.link,
        title: (post.titulo || '').slice(0, 100),
        description: desc.slice(0, 500),
        alt_text: (post.titulo || '').slice(0, 500),
        media_source: {
          source_type: 'image_url',
          url: post.imagem,
        },
      }),
    }), 'Pinterest pin');
    return { ok: true, ref: j.id };
  },
};

// ---------- Bluesky ----------
const bytes = s => Buffer.byteLength(s, 'utf8');
const bluesky = {
  id: 'bluesky',
  nome: 'Bluesky',
  ativo: env => !!(env.DIVULGA_BLUESKY_HANDLE && env.DIVULGA_BLUESKY_APP_PASSWORD),
  async publicar(post, { env, fetchImpl }) {
    const base = 'https://bsky.social/xrpc';
    const s = await json(await fetchImpl(`${base}/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: tempo(),
      body: JSON.stringify({
        identifier: env.DIVULGA_BLUESKY_HANDLE,
        password: env.DIVULGA_BLUESKY_APP_PASSWORD,
      }),
    }), 'Bluesky login');
    const auth = { Authorization: `Bearer ${s.accessJwt}` };
    let thumb;
    try {
      const img = await fetchImpl(post.imagem, { signal: tempo() });
      const buf = Buffer.from(await img.arrayBuffer());
      if (img.ok && buf.length < 950000) {
        const up = await json(await fetchImpl(`${base}/com.atproto.repo.uploadBlob`, {
          method: 'POST',
          headers: {
            ...auth,
            'Content-Type': img.headers.get('content-type') || 'image/jpeg',
          },
          body: buf,
          signal: tempo(),
        }), 'Bluesky foto');
        thumb = up.blob;
      }
    } catch { /* posta sem miniatura */ }

    const text = [post.titulo, post.texto].filter(Boolean).join('\n\n').slice(0, 290);
    const record = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['pt'],
      facets: afiliadosCanais.facetasDeLink(text),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: post.link,
          title: (post.titulo || '').slice(0, 100),
          description: (post.texto || '').slice(0, 200),
          ...(thumb ? { thumb } : {}),
        },
      },
    };
    const j = await json(await fetchImpl(`${base}/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
      signal: tempo(),
      body: JSON.stringify({
        repo: s.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    }), 'Bluesky post');
    return { ok: true, ref: j.uri };
  },
};

// ---------- Threads (Meta Graph API) ----------
const threads = {
  id: 'threads',
  nome: 'Threads',
  ativo: env => !!(env.DIVULGA_THREADS_USER_ID && env.DIVULGA_THREADS_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    const conta = encodeURIComponent(env.DIVULGA_THREADS_USER_ID);
    const mensagem = [post.titulo, post.texto, post.link].filter(Boolean).join('\n\n');
    
    // 1. Criar container de imagem do Threads
    const containerRes = await fetchImpl(`${GRAPH}/${conta}/threads`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        media_type: 'IMAGE',
        image_url: post.imagem,
        text: mensagem.slice(0, 500),
        access_token: env.DIVULGA_THREADS_TOKEN,
      }),
    });
    const container = await json(containerRes, 'Threads container');

    // 2. Publicar o container
    const publishRes = await fetchImpl(`${GRAPH}/${conta}/threads_publish`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: env.DIVULGA_THREADS_TOKEN,
      }),
    });
    const published = await json(publishRes, 'Threads publicar');
    return { ok: true, ref: published.id };
  },
};

const CANAIS = [facebook, instagram, pinterest, bluesky, threads];

module.exports = { CANAIS, CanalErro: afiliadosCanais.CanalErro, facetasDeLink: afiliadosCanais.facetasDeLink };
