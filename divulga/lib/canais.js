'use strict';
// Biblioteca de canais de divulgação reutilizando a lógica de afiliados.
// Canais: facebook, instagram, pinterest, bluesky e threads.
// Segredos com prefixo DIVULGA_.

const afiliadosCanais = require('../../afiliados/lib/canais');

const tempo = () => AbortSignal.timeout(30000);

function sanitizeError(msg) {
  if (typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  // Sanitize to avoid leaking sensitive internal API info, stack traces, tokens or paths
  return msg
    .replace(/(access_token|token|password|secret)=[^&\s]+/gi, '$1=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***')
    .slice(0, 200);
}

async function json(r, quem) {
  let j = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const rawMsg = (j && (j.error_description || (j.error && (j.error.message || j.error)) || j.message || j.detail || j.description)) || `HTTP ${r.status}`;
    const safeMsg = sanitizeError(rawMsg);
    throw new afiliadosCanais.CanalErro(`${quem}: ${safeMsg}`);
  }
  return j;
}

function validarUrlPublica(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block private/internal hostnames and IPs (SSRF mitigation)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('20.') || // metadata or cloud local
      hostname.startsWith('169.254.') // AWS/Cloud metadata
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validarPost(post) {
  if (!post || typeof post !== 'object') {
    throw new afiliadosCanais.CanalErro('Post inválido');
  }
  if (post.titulo && (typeof post.titulo !== 'string' || post.titulo.length > 500)) {
    throw new afiliadosCanais.CanalErro('Título inválido ou muito longo');
  }
  if (post.texto && (typeof post.texto !== 'string' || post.texto.length > 5000)) {
    throw new afiliadosCanais.CanalErro('Texto inválido ou muito longo');
  }
  if (post.link) {
    if (typeof post.link !== 'string' || post.link.length > 2000 || !validarUrlPublica(post.link)) {
      throw new afiliadosCanais.CanalErro('Link inválido ou não seguro');
    }
  }
  if (!post.imagem || typeof post.imagem !== 'string' || post.imagem.length > 2000 || !validarUrlPublica(post.imagem)) {
    throw new afiliadosCanais.CanalErro('URL de imagem inválida ou não pública (HTTPS obrigatório)');
  }
}

async function fetchWithRetry(fetchImpl, url, options = {}, retries = 3, delay = 1000) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetchImpl(url, options);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
}

const GRAPH_VERSION = process.env.DIVULGA_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const THREADS = 'https://graph.threads.net/v1.0';

// ---------- Facebook (página) ----------
const facebook = {
  id: 'facebook',
  nome: 'Página do Facebook',
  ativo: env => !!(env.DIVULGA_META_PAGE_ID && env.DIVULGA_META_PAGE_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    validarPost(post);
    const textoCompleto = [post.titulo, post.texto, post.link].filter(Boolean).join('\n\n');
    const r = await fetchWithRetry(fetchImpl, `${GRAPH}/${encodeURIComponent(env.DIVULGA_META_PAGE_ID)}/photos`, {
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

/** O Instagram processa o vídeo antes de publicar: espera ficar pronto (até ~3 min). */
async function esperarVideo(id, env, fetchImpl, { tentativas = 36, pausa = 5000 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetchImpl(`${GRAPH}/${encodeURIComponent(id)}?fields=status_code&access_token=${encodeURIComponent(env.DIVULGA_META_PAGE_TOKEN)}`, { signal: tempo() });
    const j = await json(r, 'Instagram vídeo');
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') throw new afiliadosCanais.CanalErro(`Instagram vídeo: ${j.status_code}`);
    await new Promise(res => setTimeout(res, env.DIVULGA_PAUSA_MS != null ? Number(env.DIVULGA_PAUSA_MS) : pausa));
  }
  throw new afiliadosCanais.CanalErro('Instagram vídeo: demorou demais');
}

// ---------- Instagram (conta comercial) ----------
const instagram = {
  id: 'instagram',
  nome: 'Instagram',
  ativo: env => !!(env.DIVULGA_META_IG_USER_ID && env.DIVULGA_META_PAGE_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    validarPost(post);
    const conta = encodeURIComponent(env.DIVULGA_META_IG_USER_ID);
    const legenda = [post.titulo, post.texto, post.link ? `Link: ${post.link}` : ''].filter(Boolean).join('\n\n');
    // Com vídeo vira Reels (o formato que o Instagram mais mostra para quem não segue a conta).
    const midia = post.video && validarUrlPublica(post.video)
      ? { media_type: 'REELS', video_url: post.video, share_to_feed: 'true' }
      : { image_url: post.imagem };
    const cRes = await fetchWithRetry(fetchImpl, `${GRAPH}/${conta}/media`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        ...midia,
        caption: legenda.slice(0, 2200),
        access_token: env.DIVULGA_META_PAGE_TOKEN,
      }),
    });
    const c = await json(cRes, 'Instagram mídia');
    if (midia.video_url) await esperarVideo(c.id, env, fetchImpl);
    const jRes = await fetchWithRetry(fetchImpl, `${GRAPH}/${conta}/media_publish`, {
      method: 'POST',
      signal: tempo(),
      body: new URLSearchParams({
        creation_id: c.id,
        access_token: env.DIVULGA_META_PAGE_TOKEN,
      }),
    });
    const j = await json(jRes, 'Instagram publicar');
    return { ok: true, ref: j.id };
  },
};

// ---------- Pinterest ----------
const pinterest = {
  id: 'pinterest',
  nome: 'Pinterest',
  ativo: env => !!(env.DIVULGA_PINTEREST_APP_ID && env.DIVULGA_PINTEREST_APP_SECRET && env.DIVULGA_PINTEREST_REFRESH_TOKEN && env.DIVULGA_PINTEREST_BOARD_ID),
  async publicar(post, { env, fetchImpl }) {
    validarPost(post);
    const basic = Buffer.from(`${env.DIVULGA_PINTEREST_APP_ID}:${env.DIVULGA_PINTEREST_APP_SECRET}`).toString('base64');
    const tRes = await fetchWithRetry(fetchImpl, 'https://api.pinterest.com/v5/oauth/token', {
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
    });
    const t = await json(tRes, 'Pinterest token');
    const desc = [post.texto, post.link].filter(Boolean).join('\n\n');
    const jRes = await fetchWithRetry(fetchImpl, 'https://api.pinterest.com/v5/pins', {
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
    });
    const j = await json(jRes, 'Pinterest pin');
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
    validarPost(post);
    const base = 'https://bsky.social/xrpc';
    const sRes = await fetchWithRetry(fetchImpl, `${base}/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: tempo(),
      body: JSON.stringify({
        identifier: env.DIVULGA_BLUESKY_HANDLE,
        password: env.DIVULGA_BLUESKY_APP_PASSWORD,
      }),
    });
    const s = await json(sRes, 'Bluesky login');
    const auth = { Authorization: `Bearer ${s.accessJwt}` };
    let thumb;
    try {
      if (validarUrlPublica(post.imagem)) {
        const img = await fetchWithRetry(fetchImpl, post.imagem, { signal: tempo() });
        const buf = Buffer.from(await img.arrayBuffer());
        if (img.ok && buf.length < 950000) {
          const upRes = await fetchWithRetry(fetchImpl, `${base}/com.atproto.repo.uploadBlob`, {
            method: 'POST',
            headers: {
              ...auth,
              'Content-Type': img.headers.get('content-type') || 'image/jpeg',
            },
            body: buf,
            signal: tempo(),
          });
          const up = await json(upRes, 'Bluesky foto');
          thumb = up.blob;
        }
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
    const jRes = await fetchWithRetry(fetchImpl, `${base}/com.atproto.repo.createRecord`, {
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
    });
    const j = await json(jRes, 'Bluesky post');
    return { ok: true, ref: j.uri };
  },
};

// ---------- Threads (Meta Graph API) ----------
const threads = {
  id: 'threads',
  nome: 'Threads',
  ativo: env => !!(env.DIVULGA_THREADS_USER_ID && env.DIVULGA_THREADS_TOKEN),
  async publicar(post, { env, fetchImpl }) {
    validarPost(post);
    const conta = encodeURIComponent(env.DIVULGA_THREADS_USER_ID);
    const mensagem = [post.titulo, post.texto, post.link].filter(Boolean).join('\n\n');
    
    // 1. Criar container de imagem do Threads
    const containerRes = await fetchWithRetry(fetchImpl, `${THREADS}/${conta}/threads`, {
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
    const publishRes = await fetchWithRetry(fetchImpl, `${THREADS}/${conta}/threads_publish`, {
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
