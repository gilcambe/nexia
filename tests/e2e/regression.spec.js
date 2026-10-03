// Regressão E2E da Fase 1 — derivada de READDY/nexia.test.js (seções 1, 10 e 11),
// trocando as páginas /nexia/*.html (que não existem no nexia v60) pelas rotas atuais.
const { test, expect } = require('@playwright/test');

const SPA_ROUTES = ['/', '/login', '/cortex-app', '/sentinel', '/pipeline', '/codigo', '/docs',
  '/swarm-control', '/qa-center', '/projetos', '/aprovacoes', '/execucoes', '/ces', '/bezsan', '/vp', '/splash', '/privacidade', '/termos', '/lgpd', '/cookies'];
const TENANT_PAGES = ['/ces/landing', '/bezsan/landing', '/vp/landing', '/splash/landing', '/ces/admin', '/vp/guia'];

test.describe('1. Navegação — rotas principais', () => {
  for (const route of [...SPA_ROUTES, ...TENANT_PAGES]) {
    test(`${route} — HTTP 200, sem crash JS`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(res.status(), `${route} status`).toBe(200);
      await page.waitForTimeout(300);
      // Erros de Firebase/rede são esperados sem credenciais locais; crash de sintaxe/referência não
      const crashes = errors.filter(m => /SyntaxError|ReferenceError|is not a function|Cannot read properties of undefined/.test(m)
        && !/firebase|fetch|network|Failed to fetch/i.test(m));
      expect(crashes, `${route} crashou: ${crashes.join(' | ')}`).toEqual([]);
    });
  }
});

test.describe('10. APIs — sem crash e sempre JSON', () => {
  const GET_APIS = ['/api/sentinel', '/api/observability', '/api/models', '/api/usage', '/api/notifications', '/api/audit', '/api/sentinel-qa?action=ping', '/api/tenant?tenantId=nexia'];
  for (const ep of GET_APIS) {
    test(`GET ${ep} sem crash`, async ({ request }) => {
      const res = await request.get(ep);
      // 503 é aceito quando o ambiente de teste roda sem Firebase; 500 (crash) não
      expect([500, 502], `${ep} crashou`).not.toContain(res.status());
      expect(res.headers()['content-type'] || '', `${ep} retornou HTML`).toContain('json');
    });
  }
  const POST_APIS = [
    ['/api/auth', { action: 'check' }], ['/api/logs', { level: 'info' }], ['/api/events', { type: 'test' }],
    ['/api/tenant', { action: 'get' }], ['/api/cortex', { message: 'ping' }], ['/api/memory', { action: 'get' }],
    ['/api/nexia/tools/invoke', { project_id: 'prj_x', tool: 'github.create_pr', input: {} }], ['/api/sentinel-qa', { mode: 'heal', issues: [{}] }],
  ];
  for (const [ep, data] of POST_APIS) {
    test(`POST ${ep} sem token → erro JSON, sem crash`, async ({ request }) => {
      const res = await request.post(ep, { data });
      expect(res.status(), `${ep}`).toBeGreaterThanOrEqual(400);
      expect([500, 502], `${ep} crashou`).not.toContain(res.status());
      expect(res.headers()['content-type'] || '').toContain('json');
    });
  }
});

test.describe('Segurança — Fase 1', () => {
  test('cabeçalho x-netlify-event não libera o Sentinel', async ({ request }) => {
    const res = await request.post('/api/sentinel-qa', { data: { mode: 'heal', issues: [{ severity: 'CRITICAL' }] }, headers: { 'x-netlify-event': 'schedule' } });
    expect(res.status()).toBe(401);
  });
  test('token qualquer não vira master (demo mode removido)', async ({ request }) => {
    const res = await request.post('/api/nexia/tools/invoke', { data: { project_id: 'prj_x', tool: 'github.create_pr', input: {} }, headers: { authorization: 'Bearer demo' } });
    expect(res.status()).toBe(401);
  });
  for (const p of ['/server.js', '/package.json', '/.env', '/netlify/functions/middleware.js', '/firestore.rules', '/core/%2e%2e/server.js']) {
    test(`arquivo privado ${p} não é servido`, async ({ request }) => {
      const res = await request.get(p);
      expect(res.status()).toBeGreaterThanOrEqual(400);
      const body = await res.text();
      expect(body).not.toContain('require(');
      expect(body).not.toContain('"dependencies"');
    });
  }
  test('rota SPA inexistente cai no index.html', async ({ request }) => {
    const res = await request.get('/rota-que-nao-existe');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('<div id="root"');
  });
});

test.describe('NEXIA AI — Fase 3', () => {
  test('/projetos sem login pede login e não chama o Vault', async ({ page }) => {
    const calls = [];
    page.on('request', r => { if (r.url().includes('/api/nexia/')) calls.push(r.url()); });
    await page.goto('/projetos', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('projetos-title')).toHaveText('Projetos');
    await expect(page.getByTestId('projetos-login')).toBeVisible({ timeout: 15000 });
    expect(calls).toEqual([]);
  });
  test('/api/nexia/* sem token responde 401 em JSON', async ({ request }) => {
    for (const ep of ['/api/nexia/me', '/api/nexia/clients', '/api/nexia/projects/prj_x/snapshot']) {
      const res = await request.get(ep);
      expect(res.status(), ep).toBe(401);
      expect(res.headers()['content-type'] || '').toContain('json');
    }
    const post = await request.post('/api/nexia/clients', { data: { name: 'x', slug: 'xx', status: 'active' } });
    expect(post.status()).toBe(401);
  });
});

test.describe('NEXIA AI — Fase 5', () => {
  test('/api/cortex e /api/models sem token respondem 401 em JSON (nenhum stream é aberto)', async ({ request }) => {
    for (const ep of ['/api/cortex', '/api/models']) {
      const res = await request.post(ep, { data: { message: 'oi', stream: true, action: 'list' } });
      expect(res.status(), ep).toBe(401);
      expect(res.headers()['content-type'] || '', ep).toContain('json');
    }
  });
});

test.describe('NEXIA AI — Fase 6', () => {
  test('/aprovacoes sem login pede login e não chama a API', async ({ page }) => {
    const calls = [];
    page.on('request', r => { if (r.url().includes('/api/nexia/')) calls.push(r.url()); });
    await page.goto('/aprovacoes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aprovacoes-title')).toHaveText('Aprovações pendentes');
    await expect(page.getByTestId('aprovacoes-login')).toBeVisible({ timeout: 15000 });
    expect(calls).toEqual([]);
  });
  test('/api/nexia tools, approvals e tool-calls sem token respondem 401', async ({ request }) => {
    for (const [m, ep] of [['get', '/api/nexia/tools'], ['get', '/api/nexia/approvals'], ['get', '/api/nexia/tool-calls?project_id=prj_x'], ['post', '/api/nexia/tools/invoke'], ['post', '/api/nexia/approvals/tcl_x/approve']]) {
      const res = await request[m](ep);
      expect(res.status(), ep).toBe(401);
    }
  });
});

test.describe('NEXIA AI — Fase 8', () => {
  test('autocommit legado removido: /api/autocommit responde 404 JSON', async ({ request }) => {
    const res = await request.post('/api/autocommit', { data: { file: 'a.js', content: 'x', branch: 'nexia/x' } });
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type'] || '').toContain('json');
  });
  test('ferramentas de escrita do GitHub exigem login', async ({ request }) => {
    const res = await request.post('/api/nexia/tools/invoke', { data: { project_id: 'prj_x', tool: 'github.commit_files', input: { branch: 'nexia/x', message: 'm', files: [] } } });
    expect(res.status()).toBe(401);
  });
});

test.describe('NEXIA AI — Fase 10', () => {
  test('/execucoes sem login pede login e não chama a API', async ({ page }) => {
    const calls = [];
    page.on('request', r => { if (r.url().includes('/api/nexia/')) calls.push(r.url()); });
    await page.goto('/execucoes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('execucoes-title')).toHaveText('Execuções');
    await expect(page.getByTestId('execucoes-login')).toBeVisible({ timeout: 15000 });
    expect(calls).toEqual([]);
  });
  test('/api/nexia/executions sem token responde 401', async ({ request }) => {
    for (const [m, ep] of [['get', '/api/nexia/executions'], ['post', '/api/nexia/executions'], ['get', '/api/nexia/executions/exe_x'], ['post', '/api/nexia/executions/exe_x/refresh'], ['post', '/api/nexia/executions/exe_x/resume']]) {
      const res = await request[m](ep);
      expect(res.status(), ep).toBe(401);
    }
  });
});
