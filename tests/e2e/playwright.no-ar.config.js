// @ts-check
// Teste ponta a ponta no endereço real, depois de cada deploy (#809). SEM login e SÓ leitura:
// abre as páginas como uma pessoa, não envia formulário e bloqueia qualquer POST/PUT/DELETE ao site.
// BASE_URL é obrigatório (o workflow e2e-no-ar.yml passa o endereço do Worker).
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Defina BASE_URL (ex.: BASE_URL=https://nexia.gcbezerra.workers.dev).');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'no-ar.spec.js',
  timeout: 45_000,
  retries: 1, // rede real: 1 nova tentativa antes de acusar
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report-no-ar' }]],
  outputDir: '../../test-results-no-ar',
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'celular', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'computador', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
