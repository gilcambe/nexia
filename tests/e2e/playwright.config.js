// @ts-check
// Suíte E2E derivada do READDY (nexia.test.js), adaptada às rotas do nexia v60.
// BASE_URL é OBRIGATÓRIO e não há fallback para produção.
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('Defina BASE_URL (ex.: BASE_URL=http://localhost:3000 npm run test:e2e). Não há URL padrão.');
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
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
