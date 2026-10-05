'use strict';
// TEMPORÁRIO (branch de exploração, não vai para a develop): abre o sistema de treino que o dono criou no
// Readdy, entra com o login de demonstração que ele passou, visita tela por tela e guarda fotos de tela,
// o HTML de cada tela e os arquivos (JS/CSS) que o navegador baixou, para recriarmos o sistema igual.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'https://readdy.cc/preview/41c6a956-2d1d-44f9-be36-37d640a665f3/14553482';
const OUT = path.resolve(process.env.OUT || 'out');
fs.mkdirSync(path.join(OUT, 'telas'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'arquivos'), { recursive: true });
const log = [];
const note = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
const slug = s => String(s).replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'raiz';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const saved = new Set();
  ctx.on('response', async r => {
    try {
      const u = r.url(); const ct = r.headers()['content-type'] || '';
      if (r.status() !== 200 || saved.has(u) || !/javascript|css|json|html|svg|font|image/.test(ct)) return;
      saved.add(u);
      const b = await r.body();
      if (b.length > 8e6) return;
      const name = `${saved.size.toString().padStart(4, '0')}-${slug(u.split('?')[0]).slice(-70)}`;
      fs.writeFileSync(path.join(OUT, 'arquivos', name), b);
      fs.appendFileSync(path.join(OUT, 'arquivos.txt'), `${name}\t${ct}\t${u}\n`);
    } catch { /* corpo indisponível */ }
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') log.push(`console: ${m.text().slice(0, 200)}`); });
  const shot = async name => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'telas', `${name}.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'telas', `${name}.html`), await page.content().catch(() => ''));
    fs.writeFileSync(path.join(OUT, 'telas', `${name}.txt`), await page.evaluate(() => document.body.innerText).catch(() => ''));
    note(`tela ${name}: ${page.url()}`);
  };

  // Página do código (pode mostrar o código-fonte sem login)
  await page.goto(`${BASE}/code`, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => note('code:', e.message));
  await shot('00-code');

  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => note('auth:', e.message));
  await shot('01-login');
  // O preview pode rodar dentro de um iframe
  const frames = page.frames();
  note('frames:', frames.map(f => f.url()).join(' | '));
  let target = page;
  for (const f of frames) { if (await f.locator('input').count().catch(() => 0)) { target = f; break; } }
  const inputs = target.locator('input:visible');
  const n = await inputs.count().catch(() => 0);
  note('inputs no login:', n);
  for (const pass of ['admin01', 'admin 01', 'admin']) {
    if (n < 2) break;
    await inputs.nth(0).fill('admin').catch(() => {});
    await inputs.nth(1).fill(pass).catch(() => {});
    await target.locator('button[type=submit], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")').first().click().catch(() => {});
    await page.waitForTimeout(4000);
    const still = await target.locator('input[type=password]:visible').count().catch(() => 0);
    note(`login com senha "${pass}": ${still ? 'ainda na tela de login' : 'entrou'} → ${page.url()}`);
    if (!still) break;
  }
  await shot('02-depois-login');

  // Tela por tela: links e itens de menu visíveis
  const seen = new Set();
  const collect = async () => {
    const t = page.frames().find(f => f !== page.mainFrame() && /readdy|preview/.test(f.url())) || page;
    return t.evaluate(() => [...document.querySelectorAll('a[href], nav button, aside button, [role=menuitem], [role=tab]')]
      .filter(e => e.offsetParent).map((e, i) => ({ i, text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), href: e.getAttribute('href') || '' }))).catch(() => []);
  };
  const items = await collect();
  note('itens de navegação:', JSON.stringify(items).slice(0, 3000));
  let k = 3;
  for (const it of items.slice(0, 40)) {
    const key = it.href || it.text;
    if (!key || seen.has(key) || /logout|sair/i.test(it.text)) continue;
    seen.add(key);
    try {
      if (it.href && !it.href.startsWith('#') && !/^https?:/.test(it.href)) await page.goto(new URL(it.href, page.url()).href, { waitUntil: 'networkidle', timeout: 60000 });
      else await page.getByText(it.text, { exact: true }).first().click({ timeout: 5000 });
    } catch (e) { note(`não abriu ${key}: ${e.message.slice(0, 120)}`); continue; }
    await shot(`${String(k++).padStart(2, '0')}-${slug(it.text || it.href)}`);
    // botões de ação na tela (ex.: "Novo", "Adicionar") → abre e fotografa o formulário
    const add = page.locator('button:visible', { hasText: /novo|nova|adicionar|criar|\+/i }).first();
    if (await add.count().catch(() => 0)) {
      await add.click({ timeout: 4000 }).catch(() => {});
      await shot(`${String(k++).padStart(2, '0')}-${slug(it.text || it.href)}-form`);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  // celular
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(`${String(k++).padStart(2, '0')}-celular`);
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  await browser.close();
})();
