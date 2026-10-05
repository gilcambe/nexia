'use strict';
// Busca de fotos e vídeos grátis para os sites que o Cortex cria (ADR-Q-03). Só leitura (LOW):
// devolve links públicos com licença e crédito; nada é baixado nem gravado aqui.
//   Fotos: Pexels (se PEXELS_API_KEY, grátis) → Openverse (sem chave, licenças CC de uso comercial)
//          → Wikimedia Commons (sem chave).
//   Vídeos: Pexels (se PEXELS_API_KEY) → Wikimedia Commons (webm/ogv).
// O resultado inclui o crédito exigido pela licença; o agente põe os créditos no rodapé do site.
const { GatewayError, CODES } = require('../errors');

const UA = 'NEXIA-AI/1.0 (https://github.com/gilcambe/nexia)';
const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const stripHtml = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
const clampCount = n => Math.min(Math.max(Number(n) || 6, 1), 12);

async function getJson(fetchImpl, url, headers = {}) {
  let res;
  try { res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } }); }
  catch { return null; }
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function pexelsImages(deps, q, n, orientation) {
  const key = deps.env && deps.env.PEXELS_API_KEY;
  if (!key) return [];
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}${orientation ? `&orientation=${orientation}` : ''}`;
  const d = await getJson(deps.fetchImpl, u, { Authorization: key });
  return ((d && d.photos) || []).map(p => ({
    url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`, width: p.width, height: p.height, alt: stripHtml(p.alt) || q,
    license: 'Pexels License (uso livre)', credit: `Foto: ${stripHtml(p.photographer)} / Pexels`, source_page: p.url, provider: 'pexels',
  }));
}

async function openverseImages(deps, q, n, orientation) {
  const aspect = orientation === 'landscape' ? '&aspect_ratio=wide' : orientation === 'portrait' ? '&aspect_ratio=tall' : '';
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${Math.min(n * 2, 20)}&license_type=commercial&mature=false&size=large${aspect}`;
  const d = await getJson(deps.fetchImpl, u);
  return ((d && d.results) || []).filter(r => r.url && IMG_EXT.test(r.url) && (!r.width || r.width >= 900)).slice(0, n).map(r => ({
    url: r.url, width: r.width || null, height: r.height || null, alt: stripHtml(r.title) || q,
    license: `${String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
    credit: `${stripHtml(r.title) || 'Foto'} — ${stripHtml(r.creator) || 'autor desconhecido'} (${String(r.license || '').toUpperCase()} ${r.license_version || ''}, via Openverse)`.trim(),
    source_page: r.foreign_landing_url || r.url, provider: 'openverse',
  }));
}

async function commons(deps, q, n, kind) {
  const search = kind === 'video' ? `${q} filetype:video` : `${q} filetype:bitmap`;
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6'
    + `&gsrsearch=${encodeURIComponent(search)}&gsrlimit=${Math.min(n * 2, 20)}&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=1600`;
  const d = await getJson(deps.fetchImpl, u);
  const pages = Object.values((d && d.query && d.query.pages) || {});
  return pages.map(p => ({ p, ii: (p.imageinfo || [])[0] })).filter(({ ii }) => ii && (kind === 'video' ? /^video\//.test(ii.mime) : /^image\/(jpeg|png|webp)/.test(ii.mime)))
    .slice(0, n).map(({ p, ii }) => {
      const m = ii.extmetadata || {};
      const lic = stripHtml(m.LicenseShortName && m.LicenseShortName.value) || 'ver página';
      return {
        url: kind === 'video' ? ii.url : (ii.thumburl || ii.url), width: ii.thumbwidth || ii.width, height: ii.thumbheight || ii.height,
        alt: stripHtml(m.ImageDescription && m.ImageDescription.value) || p.title.replace(/^File:|\.\w+$/g, ''),
        license: lic, credit: `${stripHtml(m.Artist && m.Artist.value) || 'Wikimedia Commons'} (${lic}, via Wikimedia Commons)`,
        source_page: ii.descriptionurl, provider: 'wikimedia', ...(kind === 'video' ? { mime: ii.mime } : {}),
      };
    });
}

async function pexelsVideos(deps, q, n, orientation) {
  const key = deps.env && deps.env.PEXELS_API_KEY;
  if (!key) return [];
  const u = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${n}${orientation ? `&orientation=${orientation}` : ''}`;
  const d = await getJson(deps.fetchImpl, u, { Authorization: key });
  return ((d && d.videos) || []).map(v => {
    const files = (v.video_files || []).filter(f => f.file_type === 'video/mp4' && f.width).sort((a, b) => a.width - b.width);
    const f = files.find(x => x.width >= 1280) || files[files.length - 1];
    return f && { url: f.link, width: f.width, height: f.height, poster: v.image, mime: 'video/mp4', license: 'Pexels License (uso livre)',
      credit: `Vídeo: ${stripHtml(v.user && v.user.name)} / Pexels`, source_page: v.url, provider: 'pexels' };
  }).filter(Boolean);
}

// O resultado vai inteiro para o modelo (cota de tokens): só o que ele usa no HTML.
const slim = m => ({ url: m.url, width: m.width, height: m.height, alt: String(m.alt || '').slice(0, 80), credit: String(m.credit || '').slice(0, 110),
  provider: m.provider, ...(m.poster ? { poster: m.poster } : {}), ...(m.mime ? { mime: m.mime } : {}) });

const QUERY = { type: 'string', minLength: 2, maxLength: 100 };
const ORIENT = { type: 'string', enum: ['landscape', 'portrait', 'square'] };
const COUNT = { type: 'integer', minimum: 1, maximum: 12 };

module.exports = [
  {
    name: 'media.search_images', risk: 'LOW',
    description: 'Busca fotos reais e grátis para usar em sites (Pexels, Openverse, Wikimedia Commons). Escreva a busca em inglês '
      + '(ex.: "artisan bread bakery"). Devolve url (link direto da imagem), largura, altura, alt e o crédito que precisa ir no rodapé.',
    input_schema: { type: 'object', properties: { query: QUERY, count: COUNT, orientation: ORIENT }, required: ['query'] },
    summarizeInput: i => `fotos "${i.query}"`,
    async run(deps, i) {
      const n = clampCount(i.count);
      const q = String(i.query).trim();
      if (!/[a-z]{2}/i.test(q)) throw new GatewayError(CODES.INVALID_INPUT, 'Escreva a busca em palavras, em inglês (ex.: "dental clinic").');
      let images = await pexelsImages(deps, q, n, i.orientation);
      if (images.length < n) images = images.concat(await openverseImages(deps, q, n - images.length, i.orientation));
      if (images.length < n) images = images.concat(await commons(deps, q, n - images.length, 'image'));
      if (!images.length) throw new GatewayError(CODES.UPSTREAM, 'Nenhuma foto encontrada agora; tente outra busca em inglês, mais simples.');
      return { query: q, images: images.map(slim) };
    },
    summarizeOutput: r => `${r.images.length} foto(s) (${[...new Set(r.images.map(x => x.provider))].join(', ')})`,
  },
  {
    name: 'media.search_videos', risk: 'LOW',
    description: 'Busca vídeos curtos e grátis para fundo de seção (Pexels se configurado; senão Wikimedia Commons). Busca em inglês. '
      + 'Use com <video autoplay muted loop playsinline poster="..."> e sempre com uma foto de reserva.',
    input_schema: { type: 'object', properties: { query: QUERY, count: COUNT, orientation: ORIENT }, required: ['query'] },
    summarizeInput: i => `vídeos "${i.query}"`,
    async run(deps, i) {
      const n = Math.min(clampCount(i.count), 5);
      const q = String(i.query).trim();
      if (!/[a-z]{2}/i.test(q)) throw new GatewayError(CODES.INVALID_INPUT, 'Escreva a busca em palavras, em inglês (ex.: "dental clinic").');
      let videos = await pexelsVideos(deps, q, n, i.orientation);
      if (videos.length < n) videos = videos.concat(await commons(deps, q, n - videos.length, 'video'));
      if (!videos.length) throw new GatewayError(CODES.UPSTREAM, 'Nenhum vídeo encontrado agora; use foto com animação CSS no lugar.');
      return { query: q, videos: videos.map(slim) };
    },
    summarizeOutput: r => `${r.videos.length} vídeo(s)`,
  },
];
