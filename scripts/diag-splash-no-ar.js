// Diagnóstico temporário v2: o vídeo do painel aceita tocar embutido? O YouTube toca no robô (controle)?
const { chromium, devices } = require('playwright');
(async () => {
  for (const v of ['TK63WM2ibc0', 'jNQXAC9IVRw']) {
    const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v));
    console.log('oembed', v, o.status, (await o.text()).slice(0, 160));
  }
  const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const c = await b.newContext({ ...devices['Pixel 5'] });
  await c.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.__msgs = [];
    addEventListener('message', e => { try { const s = String(e.data); if (/youtube|playerState|onError|onReady|onStateChange/.test(s) || /^\{"event"/.test(s)) window.__msgs.push(s.replace(/"(videoData|playlist|apiInterfaces|options|videoUrl|availableQualityLevels|debugText|progressState|videoBytesLoaded|mediaReferenceTime)":(\[[^\]]*\]|\{[^}]*\}|"[^"]*"|[\d.]+),?/g, '').slice(0, 220)); } catch (x) {} });
  });
  const pg = await c.newPage();
  await pg.goto('https://splasheventos.pages.dev/?diag=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  await pg.touchscreen.tap(200, 500);
  await pg.waitForTimeout(10000);
  const msgs = await pg.evaluate(() => window.__msgs);
  console.log('SITE estados:', JSON.stringify(msgs.map(m => (m.match(/"playerState":-?\d|onError[^,}]*,?"info":\d+|"event":"onReady"/g) || []).join(' ')).filter(Boolean)));
  console.log('SITE amostra:', JSON.stringify(msgs.slice(0, 4)));
  // Controle: mesmo site, iframes de teste mudos com autoplay (permitido pelos navegadores).
  for (const v of ['TK63WM2ibc0', 'jNQXAC9IVRw']) {
    await pg.evaluate(v => { window.__msgs = []; document.querySelectorAll('iframe').forEach(f => f.remove()); const f = document.createElement('iframe'); f.allow = 'autoplay; encrypted-media'; f.src = 'https://www.youtube.com/embed/' + v + '?autoplay=1&mute=1&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin); f.onload = () => f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); document.body.appendChild(f); }, v);
    await pg.waitForTimeout(9000);
    const m = await pg.evaluate(() => window.__msgs);
    console.log('CONTROLE', v, JSON.stringify(m.map(x => (x.match(/"playerState":-?\d|onError[^,}]*,?"info":\d+|"event":"onReady"/g) || []).join(' ')).filter(Boolean)));
  }
  await b.close();
})();
