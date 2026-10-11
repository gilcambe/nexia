'use strict';
// Gera o site de ofertas (estático, para Cloudflare Pages grátis): vitrine com busca e categorias,
// uma página por produto (para o Google), mensagem pronta para WhatsApp, privacidade, sitemap e RSS.
const fs = require('node:fs');
const path = require('node:path');
const { reais, textoPost, LOJA, naLoja, horaMin } = require('./texto');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlSegura = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : '');
const slugId = id => String(id).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);

function css(cor) {
  return `:root{--cor:${cor};--fundo:#f6f6f7;--cartao:#fff;--texto:#1d1d1f;--suave:#6b6b70;--borda:#e6e6ea}
@media (prefers-color-scheme:dark){:root{--fundo:#121214;--cartao:#1c1c1f;--texto:#f2f2f4;--suave:#a0a0a8;--borda:#2c2c31}}
[hidden]{display:none!important}*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--fundo);color:var(--texto)}
a{color:inherit}header{background:var(--cor);color:#fff;padding:18px 16px 14px}header .in{max-width:1100px;margin:0 auto}
header h1{margin:0;font-size:1.5rem}header p{margin:4px 0 0;opacity:.92;font-size:.95rem}
.aviso{max-width:1100px;margin:10px auto 0;padding:0 16px;font-size:.8rem;color:var(--suave)}
main{max-width:1100px;margin:0 auto;padding:12px 16px 40px}
.busca{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--borda);background:var(--cartao);color:var(--texto);font-size:1rem}
.chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0}.chip{flex:none;border:1px solid var(--borda);background:var(--cartao);color:var(--texto);border-radius:999px;padding:7px 14px;font-size:.9rem;cursor:pointer}
.chip[aria-pressed=true]{background:var(--cor);border-color:var(--cor);color:#fff}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.card{background:var(--cartao);border:1px solid var(--borda);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;aspect-ratio:1;object-fit:cover;background:#ddd}.card .c{padding:10px;display:flex;flex-direction:column;gap:4px;flex:1}
.card h2{font-size:.88rem;font-weight:500;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.preco{font-weight:700;font-size:1.1rem}.antes{color:var(--suave);text-decoration:line-through;font-size:.8rem;margin-left:4px}
.selo{display:inline-block;background:var(--cor);color:#fff;border-radius:6px;padding:1px 6px;font-size:.75rem;font-weight:700}
.meta{color:var(--suave);font-size:.78rem}.btn{display:block;text-align:center;background:var(--cor);color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:10px;margin-top:auto}
.vazio{text-align:center;color:var(--suave);padding:40px 0}footer{text-align:center;color:var(--suave);font-size:.8rem;padding:24px 16px}
.prod{display:grid;gap:18px}@media(min-width:720px){.prod{grid-template-columns:1fr 1fr}}.prod img{width:100%;border-radius:14px;background:#ddd}
.caixa{background:var(--cartao);border:1px solid var(--borda);border-radius:14px;padding:16px}textarea{width:100%;min-height:320px;border-radius:12px;border:1px solid var(--borda);padding:12px;font:inherit;background:var(--cartao);color:var(--texto)}
.linha{display:flex;gap:10px;flex-wrap:wrap}.linha .btn{flex:1;min-width:150px;border:0;font-size:1rem;cursor:pointer;margin-top:0;font-family:inherit}`;
}

function pagina({ cfg, titulo, descricao, corpo, raiz = '', canonica, imagem, extraHead = '' }) {
  const s = cfg.site;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(canonica)}"><meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descricao)}">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(canonica)}">${imagem ? `<meta property="og:image" content="${esc(imagem)}">` : ''}
<meta name="theme-color" content="${esc(s.cor)}"><link rel="alternate" type="application/rss+xml" title="${esc(s.nome)}" href="${raiz}feed.xml">
<link rel="stylesheet" href="${raiz}estilo.css">${extraHead}</head><body>
<header><div class="in"><h1><a href="${raiz || './'}" style="text-decoration:none">${esc(s.nome)}</a></h1><p>${esc(s.frase)}</p></div></header>
<p class="aviso">Os links deste site são de afiliado: se você comprar por eles, podemos ganhar uma comissão, sem custo extra para você. Preços e estoque podem mudar na loja.</p>
${corpo}
<footer><a href="${raiz}privacidade.html">Privacidade e aviso de afiliado</a> · <a href="${raiz}whatsapp/">Mensagem para WhatsApp</a> · <a href="${raiz}feed.xml">RSS</a><br>Feito com NEXIA</footer>
</body></html>`;
}

function cartao(o, raiz) {
  const img = urlSegura(o.imagem);
  const link = urlSegura(o.link);
  if (!img || !link) return '';
  return `<article class="card" data-cat="${esc(o.categoria || '')}" data-busca="${esc(String(o.titulo).toLowerCase())}">
<a href="${raiz}p/${slugId(o.id)}/"><img src="${esc(img)}" alt="${esc(o.titulo)}" loading="lazy" referrerpolicy="no-referrer"></a>
<div class="c"><h2><a href="${raiz}p/${slugId(o.id)}/" style="text-decoration:none">${esc(o.titulo)}</a></h2>
<div>${o.preco ? `<span class="preco">${reais(o.preco)}</span>` : ''}${o.preco_antigo ? `<span class="antes">${reais(o.preco_antigo)}</span>` : ''} ${o.desconto >= 5 ? `<span class="selo">-${Math.round(o.desconto)}%</span>` : ''}</div>
<div class="meta">${esc(LOJA[o.loja] || '')}${o.nota ? ` · ⭐ ${o.nota.toFixed(1)}` : ''}${o.vendas >= 50 ? ` · ${o.vendas >= 1000 ? Math.floor(o.vendas / 1000) + ' mil' : o.vendas} vendidos` : ''}</div>
<a class="btn" href="${esc(link)}" rel="sponsored nofollow noopener" target="_blank">Ver oferta</a></div></article>`;
}

const SCRIPT_VITRINE = `<script>(function(){var b=document.getElementById('busca'),cs=document.querySelectorAll('.chip'),cards=document.querySelectorAll('.card'),v=document.getElementById('vazio'),cat='';
function f(){var q=(b.value||'').toLowerCase().trim(),n=0;cards.forEach(function(c){var ok=(!cat||c.dataset.cat===cat)&&(!q||c.dataset.busca.indexOf(q)>=0);c.hidden=!ok;if(ok)n++});v.hidden=n>0}
b.addEventListener('input',f);cs.forEach(function(c){c.addEventListener('click',function(){cat=c.dataset.cat;cs.forEach(function(x){x.setAttribute('aria-pressed',x===c)});f()})});})();</script>`;

function vitrine(cfg, ofertas, base, agora) {
  const cats = cfg.categorias.filter(c => ofertas.some(o => o.categoria === c.id));
  const corpo = `<main><input id="busca" class="busca" type="search" placeholder="Buscar oferta (ex.: fone, air fryer)" aria-label="Buscar oferta">
<div class="chips" role="toolbar" aria-label="Categorias"><button class="chip" data-cat="" aria-pressed="true">Todas</button>${cats.map(c => `<button class="chip" data-cat="${esc(c.id)}" aria-pressed="false">${esc(c.nome)}</button>`).join('')}${ofertas.some(o => o.manual) ? '<button class="chip" data-cat="escolhidos" aria-pressed="false">Escolhidos a dedo</button>' : ''}</div>
<div class="grade">${ofertas.map(o => cartao(o, '')).join('')}</div>
<p id="vazio" class="vazio" ${ofertas.length ? 'hidden' : ''}>${ofertas.length ? 'Nenhuma oferta com esse nome agora.' : 'As primeiras ofertas aparecem aqui em breve.'}</p>
<p class="meta" style="text-align:center;margin-top:18px">Atualizado às ${horaMin(agora)} (horário de Brasília).</p></main>${SCRIPT_VITRINE}`;
  return pagina({ cfg, titulo: `${cfg.site.nome}: ofertas do dia`, descricao: cfg.site.frase, corpo, canonica: base, imagem: ofertas[0] && urlSegura(ofertas[0].imagem) });
}

function paginaProduto(cfg, o, base, agora) {
  const link = urlSegura(o.link);
  const corpo = `<main><div class="prod"><img src="${esc(urlSegura(o.imagem))}" alt="${esc(o.titulo)}" referrerpolicy="no-referrer">
<div class="caixa"><h1 style="font-size:1.25rem;margin-top:0">${esc(o.titulo)}</h1>
<p>${o.preco ? `<span class="preco">${reais(o.preco)}</span>` : ''}${o.preco_antigo ? `<span class="antes">${reais(o.preco_antigo)}</span>` : ''} ${o.desconto >= 5 ? `<span class="selo">-${Math.round(o.desconto)}%</span>` : ''}</p>
<p class="meta">${esc(naLoja(o.loja).replace(/^n/, 'N'))}${o.vendedor ? ` · vendido por ${esc(o.vendedor)}` : ''}${o.nota ? ` · ⭐ ${o.nota.toFixed(1)}` : ''}${o.vendas >= 50 ? ` · ${o.vendas} vendidos` : ''}<br>Preço conferido às ${horaMin(o.visto || agora)}; pode mudar na loja.</p>
<a class="btn" href="${esc(link)}" rel="sponsored nofollow noopener" target="_blank">Ver oferta ${esc(naLoja(o.loja))}</a>
<p class="meta" style="margin-top:14px"><a href="../../">← Ver todas as ofertas</a></p></div></div></main>`;
  return pagina({ cfg, titulo: `${o.titulo} | ${cfg.site.nome}`, descricao: `${o.preco ? reais(o.preco) + ' ' : ''}${o.titulo}`.slice(0, 160), corpo, raiz: '../../', canonica: `${base}p/${slugId(o.id)}/`, imagem: urlSegura(o.imagem) });
}

/** Mensagem do dia para o Canal do WhatsApp: o dono copia e cola (o WhatsApp proíbe robô postando). */
function paginaWhatsapp(cfg, ofertas, base, agora) {
  const top = ofertas.filter(o => !o.manual).slice(0, 4);
  const escolhidos = ofertas.filter(o => o.manual).slice(0, 2);
  const lista = [...escolhidos, ...top].slice(0, 5);
  const msg = lista.length
    ? `*${cfg.site.nome}: ofertas de hoje* 🛍️\n\n${lista.map(o => textoPost(o, { quando: agora }).split('\n\n#publi')[0]).join('\n\n')}\n\nMais ofertas: ${base}\n#publi Links de afiliado.`
    : '';
  const corpo = `<main><div class="caixa"><h2 style="margin-top:0">Mensagem do dia para o WhatsApp</h2>
<p class="meta">O WhatsApp não deixa robôs postarem. Toque em <b>Copiar</b> e cole no seu canal, ou em <b>Abrir no WhatsApp</b>.</p>
<textarea id="msg" readonly>${esc(msg || 'Ainda não há ofertas hoje.')}</textarea>
<div class="linha" style="margin-top:10px"><button class="btn" id="copiar" type="button">Copiar</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Abrir no WhatsApp</a></div>
<p class="meta" id="ok" hidden>Copiado! Agora cole no WhatsApp.</p></div></main>
<script>document.getElementById('copiar').addEventListener('click',function(){var t=document.getElementById('msg');t.select();(navigator.clipboard?navigator.clipboard.writeText(t.value):Promise.reject()).catch(function(){document.execCommand('copy')}).then(function(){document.getElementById('ok').hidden=false})});</script>`;
  return pagina({ cfg, titulo: `Mensagem do dia | ${cfg.site.nome}`, descricao: 'Mensagem pronta com as ofertas de hoje.', corpo, raiz: '../', canonica: `${base}whatsapp/`, extraHead: '<meta name="robots" content="noindex">' });
}

function paginaPrivacidade(cfg, base) {
  const corpo = `<main><div class="caixa"><h2 style="margin-top:0">Aviso de afiliado</h2>
<p>Este site participa dos programas de afiliados da Shopee, do Mercado Livre e da Amazon. Quando você compra por um link daqui, a loja pode nos pagar uma comissão. O preço para você é o mesmo.</p>
<p>A compra, a entrega, a troca e a garantia são feitas pela loja. Os preços e o estoque são conferidos várias vezes por dia, mas podem mudar a qualquer momento; vale o que estiver na loja.</p>
<h2>Privacidade</h2><p>Este site não tem cadastro, não pede dados pessoais e não usa cookies próprios. Ao tocar em uma oferta, você vai para o site da loja, que tem a própria política de privacidade e pode usar cookies para registrar a indicação.</p>
<p><a href="./">← Voltar às ofertas</a></p></div></main>`;
  return pagina({ cfg, titulo: `Privacidade e aviso de afiliado | ${cfg.site.nome}`, descricao: 'Aviso de afiliado e política de privacidade.', corpo, canonica: `${base}privacidade.html` });
}

function rss(cfg, ofertas, base, agora) {
  const x = s => esc(s);
  const itens = ofertas.slice(0, 50).map(o => `<item><title>${x(`${o.titulo}${o.preco ? ' por ' + reais(o.preco) : ''}`)}</title><link>${x(`${base}p/${slugId(o.id)}/`)}</link><guid>${x(`${base}p/${slugId(o.id)}/`)}</guid><pubDate>${new Date(o.desde || agora).toUTCString()}</pubDate><description>${x(`${LOJA[o.loja] || ''} · link de afiliado`)}</description>${urlSegura(o.imagem) ? `<enclosure url="${x(o.imagem)}" type="image/jpeg" length="0"/>` : ''}</item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(cfg.site.nome)}</title><link>${x(base)}</link><description>${x(cfg.site.frase)}</description><language>pt-br</language><lastBuildDate>${new Date(agora).toUTCString()}</lastBuildDate>${itens}</channel></rss>`;
}

/** Escreve o site inteiro em `saida`. Devolve a lista de arquivos. */
function gerarSite(cfg, ofertas, saida, agora = Date.now()) {
  const base = `https://${cfg.site.slug}.pages.dev/`;
  const validas = ofertas.filter(o => urlSegura(o.imagem) && urlSegura(o.link));
  const arquivos = {
    'estilo.css': css(cfg.site.cor),
    'index.html': vitrine(cfg, validas, base, agora),
    'whatsapp/index.html': paginaWhatsapp(cfg, validas, base, agora),
    'privacidade.html': paginaPrivacidade(cfg, base),
    'feed.xml': rss(cfg, validas, base, agora),
    'robots.txt': `User-agent: *\nAllow: /\nDisallow: /whatsapp/\nSitemap: ${base}sitemap.xml\n`,
    'ofertas.json': JSON.stringify({ atualizado: new Date(agora).toISOString(), ofertas: validas.map(({ id, loja, titulo, preco, preco_antigo, desconto, imagem, link, categoria }) => ({ id, loja, titulo, preco, preco_antigo, desconto, imagem, link, categoria })) }),
  };
  for (const o of validas) arquivos[`p/${slugId(o.id)}/index.html`] = paginaProduto(cfg, o, base, agora);
  const urls = ['', 'privacidade.html', ...validas.map(o => `p/${slugId(o.id)}/`)];
  arquivos['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`;
  fs.rmSync(saida, { recursive: true, force: true });
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const p = path.join(saida, nome);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, conteudo);
  }
  return Object.keys(arquivos);
}

module.exports = { gerarSite, esc, slugId, urlSegura };
