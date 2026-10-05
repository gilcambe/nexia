'use strict';
// Renderiza um site institucional/landing a partir do spec (ADR-Q-04): HTML semântico, CSS com design
// system (variáveis, tipografia fluida, sombras, animações) e JS sem dependências (menu, cabeçalho ao
// rolar, revelar ao rolar, contadores, FAQ, formulário que valida e abre o WhatsApp/e-mail).
const { icon } = require('./icons');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const fontsHref = f => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.heading).replace(/%20/g, '+')}:wght@500;600;700;800&family=${encodeURIComponent(f.body).replace(/%20/g, '+')}:wght@400;500;600&display=swap`;

const STYLE = {
  elegant: { radius: '4px', radiusLg: '8px', shadow: '0 18px 40px -24px rgba(0,0,0,.35)', weight: 600, track: '.01em' },
  modern: { radius: '14px', radiusLg: '24px', shadow: '0 24px 48px -28px rgba(0,0,0,.35)', weight: 700, track: '-.02em' },
  bold: { radius: '10px', radiusLg: '18px', shadow: '0 30px 60px -30px rgba(0,0,0,.5)', weight: 800, track: '-.03em' },
  soft: { radius: '22px', radiusLg: '32px', shadow: '0 20px 50px -30px rgba(0,0,0,.25)', weight: 600, track: '-.01em' },
};

function img(m, cls, { eager = false, sizes = '' } = {}) {
  if (!m) return '';
  const w = m.width || 1600, h = m.height || 1067;
  return `<img class="${cls}" src="${attr(m.url)}" alt="${attr(m.alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`;
}

function waLink(spec, text) {
  return spec.contact.whatsapp ? `https://wa.me/${spec.contact.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '#contato';
}
const href = (spec, h) => (h === 'whatsapp' || /wa\.me|whatsapp/i.test(h || '') ? waLink(spec, `Olá! Vim pelo site da ${spec.name}.`) : h || '#contato');

const sec = {
  hero(s, spec, media, si) {
    const m = media[`s${si}.hero`];
    const v = media[`s${si}.video`];
    return `<section class="hero" id="${s.id}">
  <div class="hero__media" aria-hidden="true">${v ? `<video autoplay muted loop playsinline poster="${attr((m && m.url) || v.poster || '')}"><source src="${attr(v.url)}" type="${attr(v.mime || 'video/mp4')}"></video>` : img(m, 'hero__img', { eager: true })}</div>
  <div class="hero__overlay" aria-hidden="true"></div>
  <div class="container hero__content">
    ${s.eyebrow ? `<p class="eyebrow hero__in" style="--d:0s">${esc(s.eyebrow)}</p>` : ''}
    <h1 class="hero__in" style="--d:.1s">${esc(s.title || spec.name)}</h1>
    ${s.subtitle ? `<p class="hero__lead hero__in" style="--d:.2s">${esc(s.subtitle)}</p>` : ''}
    <div class="hero__actions hero__in" style="--d:.3s">
      ${s.cta ? `<a class="btn btn--primary" href="${attr(href(spec, s.cta.href))}">${esc(s.cta.label)} ${icon('arrow', 18)}</a>` : ''}
      ${s.cta2 ? `<a class="btn btn--ghost" href="${attr(href(spec, s.cta2.href))}">${esc(s.cta2.label)}</a>` : ''}
    </div>
  </div>
  <a class="hero__scroll" href="#${attr(spec.sections[si + 1] ? spec.sections[si + 1].id : 'contato')}" aria-label="Rolar para a próxima seção"><span></span></a>
</section>`;
  },
  services(s, spec, media, si) {
    return `<section class="section" id="${s.id}">
  <div class="container">
    ${head(s)}
    <div class="cards">
      ${s.items.map((it, k) => `<article class="card reveal" style="--d:${(k % 3) * 0.08}s">
        ${media[`s${si}.item${k}`] ? `<div class="card__media">${img(media[`s${si}.item${k}`], 'card__img', { sizes: '(max-width: 700px) 100vw, 33vw' })}</div>` : `<div class="card__icon">${icon('sparkle', 26)}</div>`}
        <div class="card__body">
          <h3>${esc(it.title)}</h3>
          ${it.text ? `<p>${esc(it.text)}</p>` : ''}
          ${it.price ? `<p class="price">${esc(it.price)}</p>` : ''}
        </div>
      </article>`).join('\n      ')}
    </div>
  </div>
</section>`;
  },
  about(s, spec, media, si) {
    const m = media[`s${si}.about`];
    return `<section class="section section--alt" id="${s.id}">
  <div class="container split">
    <div class="split__media reveal">${img(m, 'split__img', { sizes: '(max-width: 900px) 100vw, 50vw' })}<span class="split__badge">${icon('sparkle', 18)} ${esc(spec.tagline || spec.name)}</span></div>
    <div class="split__text reveal" style="--d:.1s">
      ${s.title ? `<p class="eyebrow">${esc(s.title)}</p>` : ''}
      <h2>${esc(s.subtitle && s.subtitle.length < 90 ? s.subtitle : spec.name)}</h2>
      ${(s.text || (s.subtitle && s.subtitle.length >= 90 ? s.subtitle : '')).split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}
      ${s.stats.length ? `<dl class="stats">${s.stats.map(x => `<div><dt><span class="count" data-to="${attr(x.value)}">${esc(x.value)}</span></dt><dd>${esc(x.label)}</dd></div>`).join('')}</dl>` : ''}
    </div>
  </div>
</section>`;
  },
  gallery(s, spec, media, si) {
    const imgs = s.image_queries.map((q, k) => media[`s${si}.g${k}`]).filter(Boolean);
    if (!imgs.length) return '';
    return `<section class="section" id="${s.id}">
  <div class="container">
    ${head(s)}
    <div class="gallery">${imgs.map((m, k) => `<figure class="gallery__item reveal" style="--d:${(k % 4) * 0.06}s">${img(m, 'gallery__img', { sizes: '(max-width: 700px) 50vw, 25vw' })}</figure>`).join('')}</div>
  </div>
</section>`;
  },
  team(s, spec, media, si) {
    return `<section class="section section--alt" id="${s.id}">
  <div class="container">
    ${head(s)}
    <div class="team">${s.members.map((p, k) => `<article class="person reveal" style="--d:${(k % 4) * 0.08}s">
      ${media[`s${si}.m${k}`] ? img(media[`s${si}.m${k}`], 'person__img') : `<div class="person__avatar" aria-hidden="true">${esc(initials(p.name))}</div>`}
      <h3>${esc(p.name)}</h3><p>${esc(p.role)}</p></article>`).join('')}</div>
  </div>
</section>`;
  },
  testimonials(s) {
    return `<section class="section" id="${s.id}">
  <div class="container">
    ${head(s)}
    <div class="quotes">${s.items.map((q, k) => `<figure class="quote reveal" style="--d:${(k % 3) * 0.08}s">
      <div class="stars" aria-label="${q.rating} de 5 estrelas">${icon('star', 16).repeat(q.rating)}</div>
      <blockquote><p>${esc(q.text)}</p></blockquote>
      <figcaption><span class="quote__avatar" aria-hidden="true">${esc(initials(q.name))}</span><span><strong>${esc(q.name)}</strong>${q.role ? `<small>${esc(q.role)}</small>` : ''}</span></figcaption>
    </figure>`).join('')}</div>
  </div>
</section>`;
  },
  faq(s) {
    return `<section class="section section--alt" id="${s.id}">
  <div class="container container--narrow">
    ${head(s)}
    <div class="faq">${s.items.map(i => `<details class="faq__item reveal"><summary>${esc(i.q)}<span aria-hidden="true">${icon('plus', 18)}</span></summary><p>${esc(i.a)}</p></details>`).join('')}</div>
  </div>
</section>`;
  },
  cta(s, spec) {
    return `<section class="band" id="${s.id}">
  <div class="container band__inner reveal">
    <div><h2>${esc(s.title)}</h2>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}</div>
    ${s.cta ? `<a class="btn btn--light" href="${attr(href(spec, s.cta.href))}">${esc(s.cta.label)} ${icon('arrow', 18)}</a>` : ''}
  </div>
</section>`;
  },
  contact(s, spec) {
    const c = spec.contact;
    const where = [c.address, c.city].filter(Boolean).join(' — ');
    const items = [
      c.whatsapp && `<li>${icon('whatsapp')}<a href="${attr(waLink(spec))}" target="_blank" rel="noopener">WhatsApp ${esc(c.phone || c.whatsapp)}</a></li>`,
      !c.whatsapp && c.phone && `<li>${icon('phone')}<a href="tel:${attr(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></li>`,
      c.email && `<li>${icon('mail')}<a href="mailto:${attr(c.email)}">${esc(c.email)}</a></li>`,
      where && `<li>${icon('pin')}<span>${esc(where)}</span></li>`,
      c.hours && `<li>${icon('clock')}<span>${esc(c.hours)}</span></li>`,
    ].filter(Boolean).join('');
    return `<section class="section" id="contato">
  <div class="container contact">
    <div class="contact__info reveal">
      <p class="eyebrow">Contato</p>
      <h2>${esc(s.title || 'Fale com a gente')}</h2>
      ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
      <ul class="contact__list">${items}</ul>
      ${s.map && where ? `<div class="map"><iframe title="Mapa: ${attr(where)}" src="https://maps.google.com/maps?q=${encodeURIComponent(where)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
    </div>
    <form class="form reveal" style="--d:.1s" novalidate data-whatsapp="${attr(c.whatsapp)}" data-email="${attr(c.email)}" data-name="${attr(spec.name)}">
      <div class="field"><label for="f-nome">Nome</label><input id="f-nome" name="nome" autocomplete="name" required minlength="2"><small class="field__err" aria-live="polite"></small></div>
      <div class="field"><label for="f-tel">Telefone / WhatsApp</label><input id="f-tel" name="telefone" type="tel" autocomplete="tel" inputmode="tel" required pattern="[0-9()+\\-\\s]{10,}"><small class="field__err" aria-live="polite"></small></div>
      <div class="field"><label for="f-email">E-mail <span class="opt">(opcional)</span></label><input id="f-email" name="email" type="email" autocomplete="email"><small class="field__err" aria-live="polite"></small></div>
      <div class="field"><label for="f-msg">Mensagem</label><textarea id="f-msg" name="mensagem" rows="4" required minlength="10"></textarea><small class="field__err" aria-live="polite"></small></div>
      <button class="btn btn--primary btn--block" type="submit">Enviar mensagem ${icon('arrow', 18)}</button>
      <p class="form__ok" role="status" hidden>${icon('check', 18)} Recebemos sua mensagem! Vamos responder em breve.</p>
    </form>
  </div>
</section>`;
  },
};

const NAV = { services: 'Serviços', about: 'Sobre', gallery: 'Galeria', team: 'Equipe', testimonials: 'Depoimentos', faq: 'Dúvidas', contact: 'Contato' };
const navLabel = s => { const t = s.title.split(/[:—–-]/)[0].trim(); return t.length <= 16 ? t : NAV[s.type] || t.slice(0, 16); };

function head(s) {
  return `<header class="section__head reveal">
      ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
      ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
    </header>`;
}

function html(spec, media) {
  const nav = spec.sections.filter(s => !['hero', 'cta'].includes(s.type) && s.title).slice(0, 6);
  const credits = Object.values(media).filter(m => m && m.credit).map(m => m.credit);
  const c = spec.contact;
  const ogImg = Object.values(media).find(Boolean);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(spec.name)}${spec.tagline ? ` — ${esc(spec.tagline)}` : ''}</title>
  <meta name="description" content="${attr(spec.description || spec.tagline || spec.name)}">
  <meta name="theme-color" content="${spec.palette.primary}">
  <meta property="og:title" content="${attr(spec.name)}">
  <meta property="og:description" content="${attr(spec.description || spec.tagline)}">
  <meta property="og:type" content="website">
  ${ogImg ? `<meta property="og:image" content="${attr(ogImg.url)}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${attr(fontsHref(spec.fonts))}" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#conteudo">Pular para o conteúdo</a>
  <header class="topbar" id="topo">
    <div class="container topbar__inner">
      <a class="brand" href="#topo">${esc(spec.name)}</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu">${icon('menu', 24)}</button>
      <nav id="menu" class="menu" aria-label="Menu principal">
        ${nav.map(s => `<a href="#${s.type === 'contact' ? 'contato' : s.id}">${esc(navLabel(s))}</a>`).join('\n        ')}
        ${c.whatsapp ? `<a class="btn btn--primary btn--sm" href="${attr(waLink(spec, `Olá! Vim pelo site da ${spec.name}.`))}" target="_blank" rel="noopener">${icon('whatsapp', 18)} WhatsApp</a>` : ''}
      </nav>
    </div>
  </header>
  <main id="conteudo">
${spec.sections.map((s, si) => sec[s.type](s, spec, media, si)).filter(Boolean).join('\n')}
  </main>
  <footer class="footer">
    <div class="container footer__grid">
      <div><p class="brand brand--light">${esc(spec.name)}</p><p>${esc(spec.tagline)}</p></div>
      <div><h3>Contato</h3><ul>${[c.phone && `<li>${esc(c.phone)}</li>`, c.email && `<li>${esc(c.email)}</li>`, (c.address || c.city) && `<li>${esc([c.address, c.city].filter(Boolean).join(', '))}</li>`, c.hours && `<li>${esc(c.hours)}</li>`].filter(Boolean).join('')}</ul></div>
      <div><h3>Redes</h3><p class="social">${c.instagram ? `<a href="https://instagram.com/${attr(c.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a>` : ''}${c.facebook ? `<a href="https://facebook.com/${attr(c.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook')}</a>` : ''}${c.whatsapp ? `<a href="${attr(waLink(spec))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>` : ''}</p></div>
    </div>
    <div class="container footer__bottom">
      <p>© <span data-year>${new Date().getFullYear()}</span> ${esc(spec.name)}. Todos os direitos reservados.</p>
      ${credits.length ? `<details class="credits"><summary>Créditos das imagens</summary><ul>${credits.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    </div>
  </footer>
  ${c.whatsapp ? `<a class="wa-float" href="${attr(waLink(spec, `Olá! Vim pelo site da ${spec.name}.`))}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${icon('whatsapp', 28)}</a>` : ''}
  <a class="to-top" href="#topo" aria-label="Voltar ao topo">${icon('up', 20)}</a>
  <script src="script.js" defer></script>
</body>
</html>
`;
}

function css(spec) {
  const p = spec.palette, st = STYLE[spec.style] || STYLE.modern;
  return `/* ${spec.name} — gerado pelo NEXIA Site Kit (ADR-Q-04) */
:root {
  --primary: ${p.primary};
  --accent: ${p.accent};
  --bg: ${p.bg};
  --surface: ${p.surface};
  --text: ${p.text};
  --muted: ${p.muted};
  --dark: ${p.dark};
  --font-head: "${spec.fonts.heading}", Georgia, serif;
  --font-body: "${spec.fonts.body}", system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: ${st.radius};
  --radius-lg: ${st.radiusLg};
  --shadow: ${st.shadow};
  --head-weight: ${st.weight};
  --track: ${st.track};
  --container: 1200px;
  --ease: cubic-bezier(.2, .7, .2, 1);
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { margin: 0; font-family: var(--font-body); font-size: 1.0625rem; line-height: 1.65; color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased; }
img, video, iframe { display: block; max-width: 100%; }
img { height: auto; }
a { color: var(--primary); }
h1, h2, h3 { font-family: var(--font-head); font-weight: var(--head-weight); letter-spacing: var(--track); line-height: 1.12; margin: 0 0 .5em; color: var(--text); }
h1 { font-size: clamp(2.5rem, 6vw, 4.75rem); }
h2 { font-size: clamp(1.9rem, 3.6vw, 3rem); }
h3 { font-size: 1.3rem; }
p { margin: 0 0 1rem; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
.skip { position: absolute; left: -999px; top: 0; background: var(--primary); color: #fff; padding: .75rem 1rem; z-index: 100; }
.skip:focus { left: 1rem; top: 1rem; }
.container { width: min(100% - 2.5rem, var(--container)); margin-inline: auto; }
.container--narrow { --container: 820px; }
.eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: .8rem; font-weight: 600; color: var(--accent); margin-bottom: .75rem; }

/* Botões */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; padding: .95rem 1.6rem; border-radius: 999px; font-weight: 600; text-decoration: none; border: 2px solid transparent; cursor: pointer; font: inherit; font-weight: 600; transition: transform .25s var(--ease), box-shadow .25s var(--ease), background-color .25s, color .25s; }
.btn .i { transition: transform .25s var(--ease); }
.btn:hover { transform: translateY(-2px); }
.btn:hover .i { transform: translateX(3px); }
.btn--primary { background: var(--primary); color: #fff; box-shadow: 0 12px 30px -12px var(--primary); }
.btn--primary:hover { box-shadow: 0 18px 36px -14px var(--primary); }
.btn--ghost { color: #fff; border-color: rgba(255,255,255,.7); backdrop-filter: blur(6px); }
.btn--ghost:hover { background: #fff; color: var(--dark); }
.btn--light { background: #fff; color: var(--dark); }
.btn--sm { padding: .6rem 1.1rem; font-size: .95rem; }
.btn--block { width: 100%; }

/* Cabeçalho */
.topbar { position: fixed; inset: 0 0 auto; z-index: 50; transition: background-color .35s, box-shadow .35s, padding .35s; padding: 1.1rem 0; }
.topbar.is-scrolled { background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); box-shadow: 0 10px 30px -20px rgba(0,0,0,.4); padding: .6rem 0; }
.topbar__inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.brand { font-family: var(--font-head); font-weight: var(--head-weight); font-size: 1.45rem; color: #fff; text-decoration: none; letter-spacing: var(--track); transition: color .35s; }
.is-scrolled .brand { color: var(--text); }
.menu { display: flex; align-items: center; gap: 1.6rem; }
.menu a:not(.btn) { color: #fff; text-decoration: none; font-weight: 500; white-space: nowrap; position: relative; transition: color .35s; }
.is-scrolled .menu a:not(.btn) { color: var(--text); }
.menu a:not(.btn)::after { content: ""; position: absolute; left: 0; right: 100%; bottom: -4px; height: 2px; background: var(--accent); transition: right .3s var(--ease); }
.menu a:not(.btn):hover::after { right: 0; }
.menu-btn { display: none; background: none; border: 0; color: #fff; cursor: pointer; padding: .4rem; }
.is-scrolled .menu-btn { color: var(--text); }

/* Hero */
.hero { position: relative; min-height: 100svh; display: grid; align-items: center; color: #fff; overflow: hidden; isolation: isolate; }
.hero__media, .hero__overlay { position: absolute; inset: 0; z-index: -1; }
.hero__media img, .hero__media video { width: 100%; height: 100%; object-fit: cover; animation: zoom 18s var(--ease) both; }
.hero__overlay { background: linear-gradient(115deg, color-mix(in srgb, var(--dark) 88%, transparent) 10%, color-mix(in srgb, var(--dark) 45%, transparent) 60%, transparent), linear-gradient(0deg, color-mix(in srgb, var(--dark) 60%, transparent), transparent 40%); }
.hero__content { padding: 8rem 0 6rem; max-width: 760px; margin-left: max(1.25rem, calc((100% - var(--container)) / 2)); }
.hero h1 { color: #fff; text-wrap: balance; }
.hero__lead { font-size: clamp(1.1rem, 1.8vw, 1.35rem); max-width: 600px; opacity: .92; }
.hero__actions { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; }
.hero__in { opacity: 0; animation: rise .9s var(--ease) forwards; animation-delay: var(--d, 0s); }
.hero__scroll { position: absolute; left: 50%; bottom: 2rem; width: 28px; height: 46px; border: 2px solid rgba(255,255,255,.7); border-radius: 20px; transform: translateX(-50%); }
.hero__scroll span { position: absolute; left: 50%; top: 8px; width: 4px; height: 8px; margin-left: -2px; border-radius: 2px; background: #fff; animation: scrollcue 1.8s infinite; }

/* Seções */
.section { padding: clamp(4.5rem, 9vw, 7.5rem) 0; }
.section--alt { background: color-mix(in srgb, var(--primary) 6%, var(--bg)); }
.section__head { text-align: center; max-width: 720px; margin: 0 auto 3.25rem; }
.section__head p { color: var(--muted); font-size: 1.1rem; }
.cards { display: grid; gap: 1.75rem; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); }
.card { background: var(--surface); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: transform .4s var(--ease), box-shadow .4s var(--ease); }
.card:hover { transform: translateY(-8px); box-shadow: 0 34px 60px -30px rgba(0,0,0,.45); }
.card__media { aspect-ratio: 4 / 3; overflow: hidden; }
.card__img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.card:hover .card__img { transform: scale(1.07); }
.card__icon { margin: 1.75rem 1.75rem 0; width: 56px; height: 56px; display: grid; place-items: center; border-radius: 16px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
.card__body { padding: 1.5rem 1.75rem 1.9rem; display: flex; flex-direction: column; flex: 1; }
.card__body p { color: var(--muted); }
.price { margin-top: auto; font-family: var(--font-head); font-size: 1.35rem; font-weight: var(--head-weight); color: var(--primary) !important; }
.split { display: grid; gap: clamp(2rem, 5vw, 5rem); grid-template-columns: 1.05fr 1fr; align-items: center; }
.split__media { position: relative; }
.split__img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow); }
.split__badge { position: absolute; right: -1rem; bottom: 2rem; display: inline-flex; gap: .5rem; align-items: center; max-width: 80%; background: var(--surface); color: var(--text); padding: .9rem 1.2rem; border-radius: var(--radius); box-shadow: var(--shadow); font-weight: 600; animation: float 6s ease-in-out infinite; }
.split__text p { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 1.5rem; margin: 2rem 0 0; }
.stats dt { font-family: var(--font-head); font-size: clamp(2rem, 4vw, 2.75rem); font-weight: var(--head-weight); color: var(--primary); line-height: 1; }
.stats dd { margin: .35rem 0 0; color: var(--muted); font-size: .95rem; }
.gallery { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.gallery__item { margin: 0; overflow: hidden; border-radius: var(--radius); aspect-ratio: 1; }
.gallery__img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease), filter .4s; }
.gallery__item:hover .gallery__img { transform: scale(1.08); filter: saturate(1.15); }
.team { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); text-align: center; }
.person__img, .person__avatar { width: 168px; height: 168px; border-radius: 50%; margin: 0 auto 1.1rem; object-fit: cover; box-shadow: var(--shadow); }
.person__avatar { display: grid; place-items: center; font-family: var(--font-head); font-size: 2.6rem; color: #fff; background: linear-gradient(135deg, var(--primary), var(--accent)); }
.person p { color: var(--muted); }
.quotes { display: grid; gap: 1.75rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.quote { margin: 0; background: var(--surface); padding: 2rem; border-radius: var(--radius-lg); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 1rem; transition: transform .4s var(--ease); }
.quote:hover { transform: translateY(-6px); }
.quote blockquote { margin: 0; font-size: 1.08rem; }
.quote blockquote p::before { content: "“"; font-family: var(--font-head); font-size: 3rem; line-height: 0; vertical-align: -.4em; color: var(--accent); margin-right: .2rem; }
.stars { color: var(--accent); display: flex; gap: 2px; }
.quote figcaption { display: flex; gap: .85rem; align-items: center; margin-top: auto; }
.quote figcaption small { display: block; color: var(--muted); }
.quote__avatar { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; background: linear-gradient(135deg, var(--primary), var(--accent)); flex: none; }
.faq { display: grid; gap: 1rem; }
.faq__item { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0 1.5rem; }
.faq__item summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; gap: 1rem; padding: 1.3rem 0; font-weight: 600; font-size: 1.08rem; }
.faq__item summary::-webkit-details-marker { display: none; }
.faq__item summary .i { transition: transform .3s var(--ease); color: var(--primary); flex: none; }
.faq__item[open] summary .i { transform: rotate(45deg); }
.faq__item p { color: var(--muted); padding-bottom: 1.3rem; margin: 0; animation: rise .4s var(--ease); }
.band { background: linear-gradient(120deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--accent))); color: #fff; padding: clamp(3.5rem, 7vw, 5rem) 0; position: relative; overflow: hidden; }
.band::before { content: ""; position: absolute; width: 520px; height: 520px; border-radius: 50%; right: -160px; top: -260px; background: rgba(255,255,255,.08); animation: float 9s ease-in-out infinite; }
.band__inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2rem; position: relative; }
.band h2 { color: #fff; margin: 0 0 .4rem; }
.band p { margin: 0; opacity: .9; }
.contact { display: grid; gap: clamp(2rem, 5vw, 4.5rem); grid-template-columns: 1fr 1.05fr; align-items: start; }
.contact__list { list-style: none; padding: 0; margin: 1.5rem 0; display: grid; gap: .9rem; }
.contact__list li { display: flex; gap: .8rem; align-items: center; }
.contact__list .i { color: var(--primary); flex: none; }
.contact__list a { color: var(--text); text-decoration: none; font-weight: 500; }
.contact__list a:hover { color: var(--primary); }
.map { border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow); aspect-ratio: 16 / 10; }
.map iframe { width: 100%; height: 100%; border: 0; }
.form { background: var(--surface); padding: clamp(1.75rem, 4vw, 2.75rem); border-radius: var(--radius-lg); box-shadow: var(--shadow); display: grid; gap: 1.1rem; }
.field { display: grid; gap: .4rem; }
.field label { font-weight: 600; font-size: .95rem; }
.opt { font-weight: 400; color: var(--muted); }
.field input, .field textarea { font: inherit; padding: .9rem 1rem; border-radius: var(--radius); border: 1.5px solid color-mix(in srgb, var(--muted) 35%, transparent); background: var(--bg); color: var(--text); transition: border-color .2s, box-shadow .2s; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent); }
.field.is-invalid input, .field.is-invalid textarea { border-color: #c0392b; }
.field__err { color: #c0392b; min-height: 1em; }
[hidden] { display: none !important; }
.form__ok { display: flex; gap: .5rem; align-items: center; color: var(--primary); font-weight: 600; margin: 0; animation: rise .5s var(--ease); }

/* Rodapé */
.footer { background: var(--dark); color: rgba(255,255,255,.75); padding: 4.5rem 0 2rem; }
.footer h3 { color: #fff; font-size: 1rem; text-transform: uppercase; letter-spacing: .14em; font-family: var(--font-body); }
.footer ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
.footer__grid { display: grid; gap: 2.5rem; grid-template-columns: 1.4fr 1fr 1fr; }
.brand--light { color: #fff; font-size: 1.6rem; margin-bottom: .5rem; }
.social { display: flex; gap: .75rem; }
.social a { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: #fff; background: rgba(255,255,255,.08); transition: background-color .25s, transform .25s var(--ease); }
.social a:hover { background: var(--primary); transform: translateY(-3px); }
.footer__bottom { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,.12); display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; font-size: .9rem; }
.credits summary { cursor: pointer; }
.credits ul { margin-top: .75rem; font-size: .8rem; max-width: 640px; }

/* Flutuantes */
.wa-float { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 60; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: #25d366; box-shadow: 0 14px 30px -10px rgba(0,0,0,.45); animation: pulse 2.6s infinite; transition: transform .25s var(--ease); }
.wa-float:hover { transform: scale(1.08); }
.to-top { position: fixed; right: 1.6rem; bottom: 6rem; z-index: 60; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--text); box-shadow: var(--shadow); opacity: 0; transform: translateY(12px); pointer-events: none; transition: opacity .3s, transform .3s var(--ease); }
.to-top.is-visible { opacity: 1; transform: none; pointer-events: auto; }

/* Revelar ao rolar */
.reveal { opacity: 0; transform: translateY(28px); transition: opacity .8s var(--ease), transform .8s var(--ease); transition-delay: var(--d, 0s); }
.reveal.is-visible { opacity: 1; transform: none; }
.no-js .reveal { opacity: 1; transform: none; }

@keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes zoom { from { transform: scale(1.12); } to { transform: scale(1); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes scrollcue { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: 1; } 80% { opacity: 0; transform: translateY(14px); } 100% { opacity: 0; } }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(37,211,102,.55); } 70% { box-shadow: 0 0 0 18px rgba(37,211,102,0); } 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); } }

@media (max-width: 960px) {
  .split, .contact { grid-template-columns: 1fr; }
  .split__badge { right: 1rem; }
  .footer__grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .menu-btn { display: inline-flex; }
  .menu { position: fixed; inset: 0 0 auto; top: 0; padding: 5.5rem 1.5rem 2rem; flex-direction: column; align-items: stretch; gap: 1.1rem; background: var(--surface); box-shadow: var(--shadow); transform: translateY(-105%); transition: transform .45s var(--ease); z-index: -1; }
  .menu.is-open { transform: none; }
  .menu a:not(.btn) { color: var(--text); font-size: 1.15rem; }
  .menu-btn[aria-expanded="true"] { color: var(--text); }
  .hero__content { padding: 7rem 0 5rem; }
  .footer__grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
  .reveal, .hero__in { opacity: 1; transform: none; }
}
`;
}

const JS = `// Gerado pelo NEXIA Site Kit (ADR-Q-04). Sem dependências.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  document.documentElement.classList.remove('no-js');

  // Cabeçalho que ganha fundo ao rolar + botão de voltar ao topo
  const topbar = $('.topbar');
  const toTop = $('.to-top');
  const onScroll = () => {
    const y = window.scrollY;
    if (topbar) topbar.classList.toggle('is-scrolled', y > 40);
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu do celular
  const btn = $('.menu-btn');
  const menu = $('#menu');
  if (btn && menu) {
    const set = open => { btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); menu.classList.toggle('is-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  // Revelar ao rolar e contadores
  const counters = new WeakSet();
  const countUp = el => {
    const m = /^(\\D*)([\\d.,]+)(.*)$/.exec(el.dataset.to || '');
    if (!m || counters.has(el)) return;
    counters.add(el);
    const raw = m[2], target = parseFloat(/[.,]\\d{3}$/.test(raw) ? raw.replace(/[.,]/g, '') : raw.replace(',', '.'));
    if (!isFinite(target)) return;
    const t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min((t - t0) / dur, 1), v = target * (1 - Math.pow(1 - k, 3));
      el.textContent = m[1] + (Number.isInteger(target) ? Math.round(v).toLocaleString('pt-BR') : v.toFixed(1).replace('.', ',')) + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      $$('.count', e.target).forEach(countUp);
      io.unobserve(e.target);
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Formulário: valida, mostra erros em português e envia pelo WhatsApp (ou e-mail)
  const form = $('.form');
  if (form) {
    const msgs = { valueMissing: 'Preencha este campo.', typeMismatch: 'Confira o formato.', tooShort: 'Escreva um pouco mais.', patternMismatch: 'Use só números, com DDD.' };
    const check = input => {
      const field = input.closest('.field');
      const err = $('.field__err', field);
      const v = input.validity;
      const key = Object.keys(msgs).find(k => v[k]);
      field.classList.toggle('is-invalid', !!key);
      err.textContent = key ? msgs[key] : '';
      return !key;
    };
    $$('input, textarea', form).forEach(i => i.addEventListener('blur', () => check(i)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = $$('input, textarea', form).map(check).every(Boolean);
      if (!ok) { const bad = $('.is-invalid input, .is-invalid textarea', form); if (bad) bad.focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      const text = \`Olá! Sou \${d.nome} (\${d.telefone}\${d.email ? ', ' + d.email : ''}).\\n\${d.mensagem}\`;
      const ok2 = $('.form__ok', form);
      if (ok2) ok2.hidden = false;
      if (form.dataset.whatsapp) window.open('https://wa.me/' + form.dataset.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (form.dataset.email) location.href = 'mailto:' + form.dataset.email + '?subject=' + encodeURIComponent('Contato pelo site') + '&body=' + encodeURIComponent(text);
      form.reset();
    });
  }

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
`;

function renderSite(spec, media = {}) {
  return {
    'index.html': html(spec, media).replace('<html lang="pt-BR">', '<html lang="pt-BR" class="no-js">'),
    'styles.css': css(spec),
    'script.js': JS,
  };
}

module.exports = { renderSite, esc };
