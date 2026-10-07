'use strict';
// Teste de pessoa: abre o site/app em celular e computador, passa por todas as páginas que acha,
// clica em cada botão e link, preenche e envia cada formulário, e anota tudo que quebra
// (erro de JavaScript, arquivo que não carrega, resposta 4xx/5xx, botão que some, tela em branco).
// Nunca roda contra produção: serve uma pasta (site estático ou app já compilado) numa porta local.
// STORAGE='{"chave":"valor"}' grava no navegador antes de abrir (ex.: modo local do app); LOGIN_USER/LOGIN_PASS entram pela tela de login.
// Uso: ROOT=pasta BASE=/body-coach/ OUT=/tmp/relatorio node scripts/teste-humano.js  (precisa do Playwright com Chromium)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.env.ROOT || '.');
const BASE = (process.env.BASE || '/').replace(/\/?$/, '/');
const OUT = path.resolve(process.env.OUT || 'relatorio-teste-humano');
const MAX_PAGINAS = Number(process.env.MAX_PAGINAS || 25);
const MAX_CLIQUES = Number(process.env.MAX_CLIQUES || 40);
const PERIGOSO = /excluir|apagar|deletar|remover conta|sair|logout|delete|encerrar/i;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (BASE !== '/' && rel.startsWith(BASE)) rel = '/' + rel.slice(BASE.length);
  else if (BASE !== '/' && rel + '/' === BASE) rel = '/';
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    // app de página única: rota desconhecida cai no index.html (como o hosting faz)
    if (path.extname(rel)) { res.writeHead(404); return res.end(); }
    file = path.join(ROOT, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const falhas = [];
const feitos = [];
const nota = (tela, onde, msg) => { const f = `${tela} · ${onde}: ${msg}`; if (!falhas.includes(f)) falhas.push(f); };

async function testarPagina(browser, base, rota, viewport, fila, vistos) {
  const tela = `${viewport.nome} ${rota}`;
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, deviceScaleFactor: 1 });
  if (process.env.STORAGE) await ctx.addInitScript(kv => { for (const [k, v] of Object.entries(kv)) try { window.localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }, JSON.parse(process.env.STORAGE));
  const page = await ctx.newPage();
  let onde = 'ao abrir';
  page.on('pageerror', e => nota(tela, onde, `erro de JavaScript: ${e.message.slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) nota(tela, onde, `erro no console: ${m.text().slice(0, 160)}`); });
  page.on('requestfailed', r => { if (r.url().startsWith(base)) nota(tela, onde, `não carregou ${r.url().slice(base.length).slice(0, 100)}`); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400 && !/favicon/.test(r.url())) nota(tela, onde, `${r.status()} em ${r.url().slice(base.length).slice(0, 100)}`); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  if (process.env.LOGIN_USER) {
    // entra como uma pessoa entraria (conta de teste / modo local), para exercitar as áreas de dentro
    onde = 'login';
    await page.goto(base + 'auth', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.locator('input[type=email], input[type=text]').first().fill(process.env.LOGIN_USER, { timeout: 3000 }).catch(() => {});
    await page.locator('input[type=password]').first().fill(process.env.LOGIN_PASS || '', { timeout: 3000 }).catch(() => {});
    await page.locator('button[type=submit]').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  try {
    await page.goto(base + rota.replace(/^\//, ''), { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(800);
    const texto = (await page.evaluate(() => document.body.innerText || '')).trim();
    if (texto.length < 5) nota(tela, onde, 'tela em branco');
    const nome = `${viewport.nome}-${rota.replace(/[^a-z0-9]+/gi, '_') || 'inicio'}`.slice(0, 80);
    await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: true }).catch(() => {});

    // links da própria página entram na fila
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
    for (const h of hrefs) {
      if (!h || /^(mailto:|tel:|javascript:|#$)/.test(h)) continue;
      let u; try { u = new URL(h, page.url()); } catch { continue; }
      if (u.origin !== new URL(base).origin) continue;
      const r = (u.pathname + u.hash).slice(BASE.length - 1) || '/';
      const k = r.startsWith('/') ? r : `/${r}`;
      if (!vistos.has(k) && vistos.size < MAX_PAGINAS) { vistos.add(k); fila.push(k); }
    }

    // formulários: preenche com dados de teste e envia
    const nForms = await page.locator('form').count();
    for (let i = 0; i < nForms; i++) {
      onde = `formulário ${i + 1}`;
      const form = page.locator('form').nth(i);
      for (const inp of await form.locator('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=submit]), textarea').all()) {
        const tipo = (await inp.getAttribute('type')) || 'text';
        const valor = tipo === 'email' ? 'teste.humano@example.com' : tipo === 'password' ? 'Teste#12345' : tipo === 'number' ? '70' : tipo === 'date' ? '1990-01-15' : tipo === 'tel' ? '11999990000' : 'Teste automático';
        await inp.fill(valor, { timeout: 1500 }).catch(() => {});
      }
      const enviar = form.locator('button[type=submit], input[type=submit], button:not([type])').first();
      if (await enviar.count()) {
        const rotulo = ((await enviar.innerText().catch(() => '')) || '').trim();
        if (!PERIGOSO.test(rotulo)) { await enviar.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(800); }
      }
      if (new URL(page.url()).pathname !== new URL(base + rota.replace(/^\//, '')).pathname) await page.goto(base + rota.replace(/^\//, ''), { waitUntil: 'networkidle' }).catch(() => {});
    }

    // botões: clica em cada um e confere se a página continua viva
    onde = 'botões';
    const botoes = page.locator('button:visible, [role=button]:visible');
    const total = Math.min(await botoes.count(), MAX_CLIQUES);
    for (let i = 0; i < total; i++) {
      const b = botoes.nth(i);
      const rotulo = (((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label').catch(() => '')) || '') + '').trim().slice(0, 40);
      if (PERIGOSO.test(rotulo) || !(await b.isEnabled().catch(() => false))) continue;
      onde = `botão "${rotulo || i + 1}"`;
      await b.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      const vivo = (await page.evaluate(() => (document.body.innerText || '').trim().length).catch(() => 0)) > 5;
      if (!vivo) nota(tela, onde, 'a tela ficou em branco depois do clique');
      if (new URL(page.url()).origin !== new URL(base).origin) await page.goto(base + rota.replace(/^\//, ''), { waitUntil: 'networkidle' }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
    feitos.push(`${tela}: ${nForms} formulário(s), ${total} botão(ões)`);
  } catch (e) {
    nota(tela, onde, `não abriu: ${e.message.slice(0, 160)}`);
  }
  await ctx.close();
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}${BASE}`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const visoes = [{ nome: 'celular', w: 390, h: 844 }, { nome: 'computador', w: 1280, h: 800 }];
  for (const v of visoes) {
    const vistos = new Set(['/']);
    const fila = ['/'];
    while (fila.length) await testarPagina(browser, base, fila.shift(), v, fila, vistos);
  }
  await browser.close();
  server.close();
  const md = [`# Teste de pessoa`, '', `Páginas e ações exercitadas:`, ...feitos.map(f => `- ${f}`), '', falhas.length ? `## ${falhas.length} problema(s)\n${falhas.map(f => `- ${f}`).join('\n')}` : '## Nenhum problema encontrado'].join('\n');
  fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  if (falhas.length) { for (const f of falhas.slice(0, 40)) console.log(`::error::${f}`); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
