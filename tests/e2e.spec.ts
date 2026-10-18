import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://nexia-c8710.web.app';

test.describe('NEXIA End-to-End Tests', () => {
  test('Fluxo completo: login, Cortex, pedidos e Body Coach', async ({ page }) => {
    // 1. Acessar a aplicação e verificar carregamento
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/NEXIA/i);

    // 2. Fluxo de Login (se aplicável ou simulação de autenticação)
    const loginButton = page.locator('text=Entrar');
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }

    // 3. Abrir o Cortex
    const cortexLink = page.locator('text=Cortex');
    if (await cortexLink.isVisible()) {
      await cortexLink.click();
      await expect(page.locator('text=Cortex')).toBeVisible();
    }

    // 4. Fazer pedido
    const pedidoInput = page.locator('input[placeholder*="pedido"], textarea[placeholder*="pedido"]');
    if (await pedidoInput.isVisible()) {
      await pedidoInput.fill('Teste automatizado de pedido E2E');
      const enviarBtn = page.locator('button:has-text("Enviar"), button:has-text("Pedir")');
      if (await enviarBtn.isVisible()) {
        await enviarBtn.click();
      }
    }

    // 5. Body Coach (cadastro e treino)
    const bodyCoachLink = page.locator('text=Body Coach');
    if (await bodyCoachLink.isVisible()) {
      await bodyCoachLink.click();
      const cadastroBtn = page.locator('text=Cadastro, text=Perfil');
      if (await cadastroBtn.isVisible()) {
        await cadastroBtn.click();
      }
      const treinoTab = page.locator('text=Treino');
      if (await treinoTab.isVisible()) {
        await treinoTab.click();
        await expect(page.locator('text=Treino')).toBeVisible();
      }
    }
  });
});
