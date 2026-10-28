// Ponta a ponta no site no ar (#809), sem login e só leitura. Fluxos: abrir o site, a tela de login,
// o Cortex, o Body Coach (cadastro/entrada e a página de conhecer) e a API pública. "Fazer pedido" e
// "treino" pedem conta: aqui só confere que a API recusa sem login (401), sem gravar nada.
const { test, expect } = require('@playwright/test');

const CRASH = /SyntaxError|ReferenceError|is not a function|Cannot read properties of (undefined|null)/;

// Bloqueia escrita: qualquer pedido que não seja GET/HEAD/OPTIONS para o próprio site é abortado.
test.beforeEach(async ({ page, baseURL }) => {
  const origem = new URL(String(baseURL)).origin;
  await page.route('**/*', (route) => {
    const r = route.request();
    const mesmoSite = r.url().startsWith(origem);
    if (mesmoSite && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) return route.abort();
    return route.continue();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const nomeSanitizado = testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const screenshotPath = testInfo.outputPath(`falha-${nomeSanitizado}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  }
});

async function abrir(page, caminho) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  const res = await page.goto(caminho, { waitUntil: 'domcontentloaded' });
  expect(res, `${caminho} sem resposta`).toBeTruthy();
  expect(res.status(), `${caminho} status`).toBeLessThan(400);
  // Tela preta = nada desenhado. Espera algum texto aparecer.
  await expect.poll(async () => (await page.locator('body').innerText()).trim().length, { timeout: 20_000, message: `${caminho} ficou em branco` }).toBeGreaterThan(20);
  const crashes = erros.filter((m) => CRASH.test(m));
  expect(crashes, `${caminho} quebrou: ${crashes.join(' | ')}`).toEqual([]);
}

test('site principal abre', async ({ page }) => { await abrir(page, '/'); });

test('tela de login mostra o campo de e-mail (sem entrar)', async ({ page }) => {
  await abrir(page, '/login');
  await expect(page.locator('input[type="email"], input[name*="mail" i], input[autocomplete="email"]').first()).toBeVisible({ timeout: 20_000 });
});

test('Cortex abre (sem login mostra a entrada)', async ({ page }) => { await abrir(page, '/cortex-app'); });

test('Body Coach abre', async ({ page }) => { await abrir(page, '/body-coach/'); });

test('Body Coach: tela de cadastro/entrada abre (sem enviar)', async ({ page }) => {
  await abrir(page, '/body-coach/auth?modo=criar');
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('input[placeholder="voce@exemplo.com"]').first()).toBeVisible();
});

test('Body Coach: página "conheça" abre', async ({ page }) => { await abrir(page, '/body-coach/conheca'); });

test('API pública responde e a privada pede login', async ({ request }) => {
  const h = await request.get('/health');
  expect(h.status()).toBe(200);
  expect((await h.json()).status).toBe('ok');
  const cfg = await request.get('/api/firebase-config');
  expect([200, 503]).toContain(cfg.status());
  expect(cfg.headers()['content-type'] || '').toContain('json');
  // Pedido e treino exigem conta: sem login a API recusa (nada é gravado).
  for (const p of ['/api/nexia/me', '/api/nexia/projects']) {
    expect((await request.get(p)).status(), p).toBe(401);
  }
});
