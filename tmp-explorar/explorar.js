'use strict';
// TEMPORÁRIO (branch de exploração, não vai para a develop): abre o sistema de treino que o dono criou no
// Readdy, entra pelo botão "Entrar como demo" (login local admin/admin01, sem backend), visita cada rota do
// app e clica nos botões e abas de cada tela, guardando foto (computador e celular), HTML e texto de cada estado.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'https://readdy.cc/preview/41c6a956-2d1d-44f9-be36-37d640a665f3/14553482';
const ROTAS = ['', 'workout', 'nutrition', 'evolution', 'plan', 'profile', 'team', 'exams', 'antidoping', 'code'];
const OUT = path.resolve(process.env.OUT || 'out');
fs.mkdirSync(path.join(OUT, 'telas'), { recursive: true });
const log = [];
const note = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
const slug = s => String(s).normalize('NFD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'raiz';
const PERIGO = /sair|logout|excluir|apagar|deletar|remover|delete|get one|made with|readdy/i;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('console', m => { if (m.type() === 'error') log.push(`console: ${m.text().slice(0, 200)}`); });
  let k = 0;
  const shot = async name => {
    await page.waitForTimeout(1200);
    const f = `${String(k++).padStart(3, '0')}-${name}`;
    await page.screenshot({ path: path.join(OUT, 'telas', `${f}.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'telas', `${f}.html`), await page.content().catch(() => ''));
    fs.writeFileSync(path.join(OUT, 'telas', `${f}.txt`), await page.evaluate(() => document.body.innerText).catch(() => ''));
    note(`tela ${f}: ${page.url()}`);
  };
  const go = async r => page.goto(`${BASE}/${r}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => note('goto', r, e.message.slice(0, 100)));

  // Antes do login: início e onboarding
  await go(''); await shot('inicio-deslogado');
  await go('onboarding'); await shot('onboarding');
  await go('auth'); await shot('login');
  await page.getByRole('button', { name: /Criar conta/ }).first().click({ timeout: 4000 }).catch(() => {});
  await shot('criar-conta');
  await go('auth');
  await page.getByRole('button', { name: /Entrar como demo/ }).first().click({ timeout: 8000 }).catch(e => note('demo:', e.message.slice(0, 100)));
  await page.waitForTimeout(3000);
  note('depois do demo:', page.url());
  await shot('depois-login');
  if (/onboarding/.test(page.url())) {
    for (let i = 0; i < 8 && /onboarding/.test(page.url()); i++) {
      const b = page.locator('button:visible', { hasText: /continuar|próximo|avançar|começar|concluir|finalizar/i }).last();
      if (!(await b.count())) break;
      await b.click({ timeout: 3000 }).catch(() => {});
      await shot(`onboarding-passo-${i + 1}`);
    }
  }

  for (const r of ROTAS) {
    const nome = r || 'dashboard';
    await go(r); await shot(nome);
    // clica em cada botão/aba visível da área principal (não navega para fora)
    const labels = await page.evaluate(() => [...document.querySelectorAll('main button, main [role=tab], [role=tablist] button, button')]
      .filter(e => e.offsetParent && !e.closest('nav,aside,header'))
      .map(e => (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 50))
      .filter(Boolean)).catch(() => []);
    const uniq = [...new Set(labels)].filter(t => !PERIGO.test(t)).slice(0, 18);
    note(`botões em ${nome}:`, JSON.stringify(uniq));
    for (const t of uniq) {
      try {
        await page.getByRole('button', { name: t, exact: true }).first().click({ timeout: 3000 });
      } catch { continue; }
      await shot(`${nome}--${slug(t)}`);
      if (!page.url().endsWith(`/${r}`) && r) await go(r);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  // menu lateral/topo (para registrar os nomes do menu)
  await go('');
  note('menu:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('nav a, aside a, header a, nav button, aside button')]
    .map(e => `${(e.innerText || e.getAttribute('aria-label') || '').trim()} -> ${e.getAttribute('href') || ''}`)).catch(() => [])));
  // celular
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of ROTAS) { await go(r); await shot(`celular-${r || 'dashboard'}`); }
  await page.locator('button:visible[aria-label*=menu i], header button:visible').first().click({ timeout: 3000 }).catch(() => {});
  await shot('celular-menu-aberto');
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  await browser.close();
})();
