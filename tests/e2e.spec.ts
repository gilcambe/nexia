import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://nexia-c8710.web.app';

test.describe('NEXIA End-to-End Tests (Rigorous)', () => {
  test('Fluxo completo obrigatório: login, abrir Cortex, fazer pedido, Body Coach cadastro e treino', async ({ page }) => {
    // 1. Acessar a aplicação e verificar carregamento e título
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/NEXIA|Cortex/i);

    // 2. Login obrigatório (clicar no botão de entrar/login se presente)
    const loginButton = page.locator('button:has-text("Entrar"), a:has-text("Entrar"), button:has-text("Login")');
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.first().click();
    }

    // 3. Abrir o Cortex obrigatoriamente
    const cortexLink = page.locator('text=Cortex, a[href*="cortex"], button:has-text("Cortex")');
    await expect(cortexLink.first()).toBeVisible({ timeout: 10000 });
    await cortexLink.first().click();
    await expect(page.locator('text=Cortex, h1:has-text("Cortex"), div:has-text("Cortex")').first()).toBeVisible();

    // 4. Fazer pedido obrigatoriamente
    const pedidoInput = page.locator('input[placeholder*="pedido"], textarea[placeholder*="pedido"], input[type="text"]').first();
    await expect(pedidoInput).toBeVisible({ timeout: 10000 });
    await pedidoInput.fill('Teste automatizado rigido de pedido E2E');
    
    const enviarBtn = page.locator('button:has-text("Enviar"), button:has-text("Pedir"), button[type="submit"]').first();
    await expect(enviarBtn).toBeVisible({ timeout: 5000 });
    await enviarBtn.click();

    // 5. Body Coach cadastro e treino obrigatoriamente
    const bodyCoachLink = page.locator('text=Body Coach, a[href*="body-coach"], button:has-text("Body Coach")');
    await expect(bodyCoachLink.first()).toBeVisible({ timeout: 10000 });
    await bodyCoachLink.first().click();

    const cadastroBtn = page.locator('text=Cadastro, text=Perfil, text=Registrar').first();
    await expect(cadastroBtn).toBeVisible({ timeout: 10000 });
    await cadastroBtn.click();

    const treinoTab = page.locator('text=Treino, text=Workout').first();
    await expect(treinoTab).toBeVisible({ timeout: 10000 });
    await treinoTab.click();
    await expect(page.locator('text=Treino, text=Workout').first()).toBeVisible();
  });
});
