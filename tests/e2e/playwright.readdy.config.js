// @ts-check
// Config da suíte ORIGINAL do READDY (89 testes). BASE_URL obrigatório, sem fallback para produção.
const { defineConfig } = require('@playwright/test');

if (!process.env.BASE_URL) {
  throw new Error('Defina BASE_URL (ex.: BASE_URL=http://localhost:3000 npm run test:e2e:readdy). Não há URL padrão.');
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'readdy-original.spec.js',
  timeout: 90_000,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: '../../test-results/readdy-report.json' }]],
  outputDir: '../../test-results/readdy',
  use: {
    baseURL: process.env.BASE_URL,
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
});
