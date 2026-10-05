'use strict';
// ADR-CLONE-01: NEXIA Clone (partes puras) — URL segura, tokens de design, base visual do Site Kit,
// espelho (robots.txt, caminhos, reescrita, formulários) e o pedido "crie um site igual ao https://...".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const c = require('../../nexia-ai/cloner');
const kit = require('../../nexia-ai/site-kit');
const { classifyIntent, buildKind, planFor } = require('../../nexia-ai/orchestrator');

const ROOT = path.join(__dirname, '..', '..');

test('CL1. URL: só http(s) público; recusa file:, credenciais, portas, localhost e IPs internos (v4, v6, formas disfarçadas)', async () => {
  for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://x.com', 'http://localhost/', 'http://app.localhost', 'http://127.0.0.1', 'http://10.1.2.3',
    'http://172.16.0.1', 'http://192.168.0.1', 'http://169.254.169.254/latest', 'http://[::1]/', 'http://[fd00::1]/', 'http://[::ffff:7f00:1]/',
    'http://2130706433/', 'http://0x7f.1/', 'https://user:pw@example.com', 'https://example.com:22/', 'http://intranet', 'http://printer.local/', '']) {
    assert.strictEqual(c.validateUrl(bad).ok, false, bad);
  }
  const ok = c.validateUrl('exemplo.com.br/loja#topo');
  assert.deepStrictEqual([ok.ok, ok.url, ok.host], [true, 'https://exemplo.com.br/loja', 'exemplo.com.br']);
  assert.strictEqual((await c.checkResolved('x.com', async () => [{ address: '93.184.216.34' }])).ok, true);
  assert.strictEqual((await c.checkResolved('x.com', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }])).ok, false, 'DNS apontando para rede interna');
  assert.strictEqual((await c.checkResolved('x.com', async () => { throw new Error('ENOTFOUND'); })).ok, false);
  assert.strictEqual((await c.checkResolved('x.com', undefined)).ok, true, 'sem DNS (Worker): vale a checagem do texto');
});

const HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/css/site.css"><link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&amp;family=Open+Sans&display=swap" rel="stylesheet">
<style>:root{--color-primary:#c0392b;--bg:#fffdf8;--slogan:"Pão quentinho"} body{font-family:"Open Sans",Arial,sans-serif;color:#222;background:var(--bg)}
h1,h2{font-family:Lora,Georgia,serif;font-weight:700} .btn{background:var(--color-primary);border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.2);padding:12px 24px}
footer{background:#14161a} a{color:#0000ee}</style></head>
<body><header class="hero-banner"><h1>Padaria do Zé — o melhor pão</h1><img src="/logo.png"></header>
<section id="servicos" class="cards"></section><section class="depoimentos"></section><section id="faq"><details></details></section>
<section class="contato"><form action="https://exemplo.com/enviar" method="post"></form></section><footer class="mapa"></footer></body></html>`;

test('CL2. tokens: cores por papel, variáveis CSS (sem textos), fontes (sem genéricas/ícones), cantos, sombras, espaços e seções', () => {
  const { tokens, css, googleFonts } = c.parseHtml(HTML, 'https://exemplo.com/');
  assert.deepStrictEqual(css, ['https://exemplo.com/css/site.css']);
  assert.deepStrictEqual(googleFonts, ['Lora', 'Open Sans']);
  assert.strictEqual(tokens.custom_properties['--color-primary'], '#c0392b');
  assert.strictEqual(tokens.custom_properties['--slogan'], undefined, 'texto do site em variável não é guardado');
  assert.ok(tokens.colors['#c0392b'].button >= 1 && tokens.colors['#fffdf8'].bg >= 1 && tokens.colors['#222222'].text >= 1);
  assert.ok(tokens.fonts.heading.Lora && tokens.fonts.body['Open Sans']);
  assert.deepStrictEqual([Object.keys(tokens.radii), Object.keys(tokens.spacing).sort()], [['6px'], ['12px', '24px']]);
  assert.deepStrictEqual(tokens.layout, ['hero', 'services', 'testimonials', 'faq', 'contact']);
  c.parseCss('@media (max-width:600px){ .card{border-radius:1rem;color:hsl(210,50%,20%)} } @font-face{font-family:"Font Awesome 6"} .x{font-family:icomoon}', tokens);
  assert.ok(tokens.radii['1rem'] && tokens.colors['#1a334d'], 'regras dentro de @media e hsl() contam');
  assert.ok(!tokens.fonts.declared.some(f => /awesome|icomoon/i.test(f)), 'fontes de ícone ficam de fora');
  const s = JSON.stringify(c.summarize(tokens));
  for (const text of ['Padaria', 'Zé', 'pão', 'logo.png', 'enviar']) assert.ok(!s.includes(text), `nada de conteúdo no relatório: ${text}`);
  assert.deepStrictEqual(['#abc', 'rgb(10 20 30 / 40%)', 'rgba(255,0,0,.9)', 'transparent', 'white'].map(c.toHex), ['#aabbcc', null, '#ff0000', null, '#ffffff']);
});

test('CL3. base visual: paleta do kit com contraste, fontes curadas mais próximas, estilo e seções; aplicada sobre o spec validado', () => {
  const { tokens } = c.parseHtml(HTML, 'https://exemplo.com/');
  const base = c.designBase(tokens, { host: 'exemplo.com' });
  assert.deepStrictEqual(Object.keys(base.palette).sort(), ['accent', 'bg', 'dark', 'muted', 'primary', 'surface', 'text']);
  assert.ok(Object.values(base.palette).every(h => /^#[0-9a-f]{6}$/.test(h)));
  assert.deepStrictEqual([base.palette.primary, base.palette.bg, base.palette.text, base.palette.dark], ['#c0392b', '#fffdf8', '#222222', '#14161a']);
  assert.ok(c.contrast(base.palette.text, base.palette.bg) >= 4.5);
  assert.ok(c.HEADING_FONTS.includes(base.fonts.heading) && c.BODY_FONTS.includes(base.fonts.body));
  assert.deepStrictEqual([c.fontCategory(base.fonts.heading), base.fonts.body, base.style], ['serif', 'Inter', 'elegant']);
  assert.deepStrictEqual(base.sections.map(x => x.type), ['hero', 'services', 'testimonials', 'faq', 'about', 'gallery', 'contact']);
  // Fonte fora da lista vira a curada da mesma família visual.
  assert.deepStrictEqual(['Montserrat', 'Merriweather', 'Quicksand', 'Roboto', 'Fraunces', 'Fonte Desconhecida'].map(f => c.closestFont(f, c.HEADING_FONTS)),
    ['Sora', 'Fraunces', 'Sora', 'Plus Jakarta Sans', 'Fraunces', 'Plus Jakarta Sans']);
  assert.strictEqual(c.closestFont('Nunito', c.BODY_FONTS), 'Nunito Sans');
  // Site escuro: o kit pressupõe fundo claro; o escuro vai para "dark".
  const dark = c.designBase(c.parseCss(':root{--bg:#0b0d12;--text:#f5f5f5;--primary:#7c3aed} body{background:var(--bg);color:var(--text)}'));
  assert.ok(c.luminance(dark.palette.bg) > 0.8 && c.contrast(dark.palette.text, dark.palette.bg) >= 4.5 && dark.palette.dark === '#0b0d12');
  // Spec do kit + base: cores, fontes, estilo e ordem do site de referência; conteúdo continua o do spec.
  const { spec } = kit.normalizeSpec(require('../../nexia-ai/site-kit/prompt').SITE_EXAMPLE, { kind: 'site' });
  const out = c.applyDesignBase(spec, base);
  assert.deepStrictEqual([out.palette, out.fonts, out.style, out.name], [base.palette, base.fonts, 'elegant', spec.name]);
  assert.deepStrictEqual(out.sections.map(x => x.type).slice(0, 3), ['hero', 'services', 'testimonials']);
  assert.strictEqual(out.sections.at(-1).type, 'contact');
  assert.strictEqual(kit.normalizeSpec(out, { kind: 'site' }).errors.length, 0, 'o spec com a base continua válido para o kit');
  assert.match(c.designPrompt(base), /NÃO copie textos/);
});

test('CL4. modo design leve (sem navegador): HTML + CSS ligados, redirecionamento revalidado, falha vira null', async () => {
  const pages = {
    'https://exemplo.com/': { status: 301, headers: { location: 'https://www.exemplo.com/' } },
    'https://www.exemplo.com/': { status: 200, type: 'text/html', body: HTML.replace('/css/site.css', '/css/site.css?v=1') },
    'https://www.exemplo.com/css/site.css?v=1': { status: 200, type: 'text/css', body: '.btn-secondary{background:#2980b9} .card{border-radius:20px}' },
  };
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push([url, opts.redirect, opts.headers['User-Agent']]);
    const p = pages[url] || { status: 404 };
    const h = { 'content-type': p.type || '', ...(p.headers || {}) };
    return { status: p.status, headers: { get: k => h[k.toLowerCase()] || null }, text: async () => p.body || '' };
  };
  const r = await c.fetchDesign('https://exemplo.com/', { fetchImpl, lookup: null });
  assert.strictEqual(r.source.host, 'www.exemplo.com');
  assert.ok(r.tokens.colors.some(x => x.hex === '#2980b9'), 'CSS ligado foi lido');
  assert.strictEqual(r.base.palette.primary, '#c0392b');
  assert.ok(seen.every(([, redirect, ua]) => redirect === 'manual' && /^NEXIA-Clone\/1\.0/.test(ua)));
  // Redirecionamento para a rede interna é barrado.
  const evil = async url => (url === 'https://mal.example/' ? { status: 302, headers: { get: k => (k === 'location' ? 'http://169.254.169.254/' : null) } } : assert.fail(`não devia abrir ${url}`));
  assert.strictEqual(await c.fetchDesign('https://mal.example/', { fetchImpl: evil, lookup: null }), null);
  assert.strictEqual(await c.fetchDesign('https://x.example/', { fetchImpl: async () => { throw new Error('rede'); }, lookup: null }), null);
  assert.strictEqual(await c.fetchDesign('file:///etc/passwd', { fetchImpl: () => assert.fail('nada de rede') }), null);
});

test('CL5. espelho: autorização exata, robots.txt (agente próprio, Allow mais longo, Crawl-delay) e limites', () => {
  assert.deepStrictEqual(['SOU_DONO_OU_AUTORIZADO', ' SOU_DONO_OU_AUTORIZADO ', 'sim', '', undefined].map(c.isAuthorized), [true, true, false, false, false]);
  const r = c.parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: NEXIA-Clone\nDisallow: /privado\nAllow: /privado/publico\nCrawl-delay: 3\n');
  assert.deepStrictEqual(['/', '/sobre', '/privado/x', '/privado/publico/y'].map(r.allowed), [true, true, false, true]);
  assert.strictEqual(r.delay, 3);
  const all = c.parseRobots('User-agent: *\nDisallow: /\n');
  assert.strictEqual(all.allowed('/'), false);
  assert.strictEqual(c.parseRobots('').allowed('/qualquer'), true);
  assert.strictEqual(c.parseRobots('User-agent: *\nDisallow: /*.pdf$\n').allowed('/a.pdf'), false);
  assert.deepStrictEqual([c.maxPages(''), c.maxPages('5'), c.maxPages('9999'), c.maxPages('-1')], [20, 5, 200, 20]);
  assert.deepStrictEqual([c.targetFolder('', 'www.Exemplo.com'), c.targetFolder('../x', 'a.com'), c.targetFolder('clones/meu', 'a.com'), c.targetFolder('.github/x', 'a.com')],
    ['clones/www.exemplo.com', 'clones/a.com', 'clones/meu', 'clones/a.com']);
  assert.ok(c.backoffMs('7', 0) === 7000 && c.backoffMs(undefined, 2) === 20000 && c.backoffMs('999', 0) === 60000);
});

test('CL6. espelho: caminhos locais, links e mídias relativos (src, href, srcset, poster, style, <style>, CSS url()), formulários neutralizados', () => {
  const O = 'https://exemplo.com';
  assert.deepStrictEqual([c.localPath(`${O}/`, O, { page: true }), c.localPath(`${O}/sobre`, O, { page: true }), c.localPath(`${O}/a/b.html`, O, { page: true }),
    c.localPath(`${O}/img/x`, O, { type: 'image/png' }), c.localPath('https://cdn.x.com/f/a.woff2', O)],
  ['index.html', 'sobre/index.html', 'a/b.html', 'img/x.png', '_ext/cdn.x.com/f/a.woff2']);
  assert.match(c.localPath(`${O}/s.css?v=2`, O), /^s-[0-9a-f]{8}\.css$/);
  assert.ok(!c.localPath(`${O}/../../etc/passwd`, O).includes('..'));
  const map = { [`${O}/sobre`]: 'sobre/index.html', [`${O}/img/a.png`]: 'img/a.png', [`${O}/img/b.png`]: 'img/b.png', [`${O}/v.mp4`]: 'v.mp4', [`${O}/s.css`]: 's.css',
    'https://cdn.x.com/f/a.woff2': '_ext/cdn.x.com/f/a.woff2' };
  const lookup = u => map[u];
  const { html, forms } = c.rewriteHtml(`<!doctype html><html><head><base href="/"><meta charset="iso-8859-1"><link rel="stylesheet" href="/s.css" integrity="sha384-x">
<style>.h{background:url('/img/a.png')}</style></head><body><a href="/sobre#equipe">S</a><a href="/nao-copiada">N</a><a href="mailto:a@b.c">m</a>
<img src="../../img/a.png" srcset="/img/a.png 1x, /img/b.png 2x"><video poster="/img/b.png" src="/v.mp4"></video><div style="background:url(&quot;/img/a.png&quot;)"></div>
<form action="https://exemplo.com/api/lead" method="POST"><button formaction="/x">Enviar</button></form></body></html>`, `${O}/blog/post`, 'blog/post/index.html', lookup);
  assert.strictEqual(forms, 1);
  for (const want of ['href="../../s.css"', "url('../../img/a.png')", 'href="../../sobre/index.html#equipe"', 'href="https://exemplo.com/nao-copiada"', 'href="mailto:a@b.c"',
    'src="../../img/a.png"', 'srcset="../../img/a.png 1x, ../../img/b.png 2x"', 'poster="../../img/b.png"', 'src="../../v.mp4"', 'url(&quot;../../img/a.png&quot;)',
    'data-nexia-form-neutralizado="1"', 'Formulário desativado nesta cópia', '<meta charset="utf-8">']) assert.ok(html.includes(want), want);
  for (const gone of ['<base', 'integrity=', 'action=', 'method=', 'formaction', 'iso-8859-1']) assert.ok(!html.includes(gone), gone);
  assert.strictEqual(c.rewriteCss('@font-face{src:url(https://cdn.x.com/f/a.woff2)} @import "/s.css"; .a{background:url(data:image/png;base64,AA)}', `${O}/s.css`, 's.css', lookup),
    '@font-face{src:url(_ext/cdn.x.com/f/a.woff2)} @import "s.css"; .a{background:url(data:image/png;base64,AA)}');
  assert.deepStrictEqual(c.sameOriginLinks('<a href="/a">1</a><a href="https://outro.com/b">2</a><a href="/c.pdf">3</a><a href="/login">4</a><a href="/a#x">5</a>', `${O}/`, O), [`${O}/a`]);
});

test('CL7. Cortex: "crie um site igual/com o design de <URL>" → site novo com base visual; URL não muda a intenção', () => {
  assert.strictEqual(c.designRequest('Crie um site igual ao https://exemplo.com.br/, para minha padaria.'), 'https://exemplo.com.br/');
  assert.strictEqual(c.designRequest('crie um site com o design de www.loja.com'), 'https://www.loja.com/');
  assert.strictEqual(c.designRequest('clone o site https://exemplo.com'), 'https://exemplo.com/');
  assert.strictEqual(c.designRequest('crie um site para https://minhaloja.com'), null, 'URL sem pedir o design não é referência');
  assert.strictEqual(c.designRequest('crie um site igual ao http://192.168.0.10/'), null);
  for (const m of ['Crie um site igual ao https://app.exemplo.com/workflow para a padaria', 'clone o site https://exemplo.com']) {
    assert.deepStrictEqual([classifyIntent(m), buildKind(m)], ['change', 'site'], m);
    assert.ok(planFor('change', m).some(p => p.action === 'design_spec'));
  }
});

test('CL8. workflow clonar-site.yml: entradas, ações fixadas por SHA iguais às do preview-site, entradas só por variável de ambiente', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/clonar-site.yml'), 'utf8');
  const preview = fs.readFileSync(path.join(ROOT, '.github/workflows/preview-site.yml'), 'utf8');
  for (const input of ['url:', 'modo:', 'autorizado:', 'pasta:', 'max_paginas:']) assert.ok(y.includes(`      ${input}`), input);
  const uses = [...y.matchAll(/uses: (\S+)/g)].map(m => m[1]);
  assert.ok(uses.length >= 2 && uses.every(u => /@[0-9a-f]{40}$/.test(u) && preview.includes(u)), uses.join(' '));
  assert.ok(y.includes('playwright@1.59.1'));
  assert.doesNotMatch(y.split('\n').filter(l => /^\s+(run:|[^:]*\$\(|.*node |.*git |.*gh )/.test(l)).join('\n'), /\$\{\{\s*inputs\./, 'inputs nunca dentro de comandos');
  assert.match(y, /repositório é público/);
  assert.match(y, /-F draft=true/);
});
