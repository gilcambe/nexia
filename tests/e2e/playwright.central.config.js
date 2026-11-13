// @ts-check
// 13/11/2026: abre a Central (build de teste com usuário falso) e passa por TODAS as telas do menu.
// Respostas do servidor são falsas e incompletas de propósito: nenhuma tela pode quebrar por dado faltando.
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Defina BASE_URL (ex.: http://127.0.0.1:4173). Nunca produção.');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'central-telas.spec.js',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '../../test-results-central',
  use: {
    baseURL: BASE_URL,
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
});
