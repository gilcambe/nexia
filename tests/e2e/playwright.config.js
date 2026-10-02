// @ts-check
// Suíte de regressão da Fase 1 (48 testes) sobre as rotas do nexia v60. A suíte original
// do READDY (89 testes) roda sem alteração por playwright.readdy.config.js.
// BASE_URL é OBRIGATÓRIO e não há fallback para produção.
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('Defina BASE_URL (ex.: BASE_URL=http://localhost:3000 npm run test:e2e). Não há URL padrão.');
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'regression.spec.js',
  timeout: 30_000,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report' }]],
  outputDir: '../../test-results',
  use: {
    baseURL: BASE_URL,
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
});
