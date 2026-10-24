// Diagnóstico temporário: abre o site do Splash NO AR como um celular e mostra vinheta, música e erros.
const { chromium, devices } = require('playwright');
(async () => {
  const r = await fetch('https://nexia.gcbezerra.workers.dev/api/locacao?site=splash&t=' + Date.now());
  const cfg = await r.json().catch(() => ({}));
  console.log('API status', r.status, 'musica =', JSON.stringify(cfg.musica));
  const b = await chromium.launch();
  for (const cen of ['toque-cedo', 'toque-tarde']) {
    const c = await b.newContext({ ...devices['Pixel 5'] });
    await c.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.__msgs = [];
      addEventListener('message', e => { try { const s = String(e.data); if (/onStateChange|onReady|infoDelivery|initialDelivery/.test(s)) window.__msgs.push(s.slice(0, 160)); } catch (x) {} });
    });
    const pg = await c.newPage();
    pg.on('pageerror', e => console.log(cen, 'ERRO JS', e.message));
    pg.on('console', m => { if (m.type() === 'error') console.log(cen, 'console', m.text().slice(0, 200)); });
    await pg.goto('https://splasheventos.pages.dev/?diag=' + Date.now(), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(cen === 'toque-cedo' ? 500 : 6000);
    console.log(cen, 'vinheta na tela:', await pg.evaluate(() => !!document.getElementById('nexia-abertura')));
    console.log(cen, 'script vinheta carregado:', await pg.evaluate(() => !!window.KernexAbertura));
    await pg.touchscreen.tap(200, 500);
    await pg.waitForTimeout(9000);
    const st = await pg.evaluate(() => ({
      iframe: (document.querySelector('iframe[title="Música de fundo"]') || {}).src || null,
      ativa: typeof Musica !== 'undefined' ? Musica.ativa() : 'sem Musica',
      botao: (document.getElementById('btn-musica') || {}).className,
      msgs: window.__msgs.slice(-6),
      som: (() => { try { return localStorage.getItem('splash_som'); } catch (e) { return 'x'; } })(),
    }));
    console.log(cen, JSON.stringify(st, null, 1));
    await pg.screenshot({ path: `diag-${cen}.png` });
    await c.close();
  }
  await b.close();
})();
