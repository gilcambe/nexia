'use strict';
// Fotos de tela de um site/sistema gerado pelo Cortex (pasta estática), em computador e celular.
// Uso: PREVIEW_DIR=demos/x OUT=/tmp/shots node scripts/preview-site.js  (precisa do Playwright com Chromium)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.env.PREVIEW_DIR || '.');
const OUT = path.resolve(process.env.OUT || 'shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(OUT, { recursive: true });
  const isApp = fs.existsSync(path.join(ROOT, 'app.js'));
  const browser = await chromium.launch();
  const problems = [];
  const shots = isApp
    ? [['painel', '/', 1440, 900], ['cadastro', `/#/${(JSON.parse((fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/id="app-config">([^<]*)</) || [0, '{"entities":[{"key":""}]}'])[1]).entities[0] || {}).key}`, 1440, 900], ['celular', '/', 390, 844]]
    : [['computador', '/', 1440, 900, true], ['celular', '/', 390, 844, false]];
  for (const [name, url, width, height, full] of shots) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => problems.push(`${name}: ${e.message}`));
    page.on('requestfailed', r => problems.push(`${name}: não carregou ${r.url().slice(0, 120)}`));
    await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => problems.push(`${name}: ${e.message}`));
    if (full) {
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!full });
    await page.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, 'problemas.txt'), problems.join('\n') || 'nenhum');
  console.log(problems.length ? `Problemas:\n${problems.join('\n')}` : 'Sem erros no navegador.');
})().catch(e => { console.error(e); process.exit(1); });
