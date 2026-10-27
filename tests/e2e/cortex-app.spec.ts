import { test, expect, chromium } from '@playwright/test';

// Configuração para mobile (iPhone 12)
test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
});

test.describe('Cortex App - Teste Ponta a Ponta Mobile', () => {
  let context;
  let page;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      slowMo: 1000,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await context.newPage();
    await page.goto('/cortex');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Cortex/i);
  });

  test.afterAll(async () => {
    await context.close();
  });

  // Helper: obter créditos como número (re-query sempre, evita stale element)
  async function getCredits() {
    const el = page.locator('[data-testid="credits-display"]');
    await expect(el).toBeVisible();
    const text = await el.textContent();
    const numero = parseInt(text?.replace(/\D/g, '') || '0', 10);
    return numero;
  }

  async function getChatInput() {
    const el = page.locator('[data-testid="chat-input"]');
    await expect(el).toBeVisible();
    return el;
  }

  async function esperarResposta(indice: number) {
    const resp = page.locator('[data-testid="cortex-response"]').nth(indice);
    await expect(resp).toBeVisible({ timeout: 30000 });
    return resp;
  }

  test('Fluxo completo de conversa com histórico e créditos', async () => {
    // 1. Estado inicial
    const creditosIniciais = await getCredits();
    console.log('Créditos iniciais:', creditosIniciais);

    // 2. Primeira mensagem
    const input = await getChatInput();
    const primeiraMensagem = 'Olá, preciso de ajuda com um projeto de site';
    await input.fill(primeiraMensagem);
    await input.press('Enter');

    await esperarResposta(0);

    const creditosDepoisPrimeira = await getCredits();
    expect(creditosDepoisPrimeira).toBeLessThan(creditosIniciais);

    // 3. Segunda mensagem
    const input2 = await getChatInput();
    const segundaMensagem = 'Quero criar um site para minha empresa';
    await input2.fill(segundaMensagem);
    await input2.press('Enter');

    await esperarResposta(1);

    const creditosDepoisSegunda = await getCredits();
    expect(creditosDepoisSegunda).toBeLessThan(creditosDepoisPrimeira);

    // 4. Recarregar para testar persistência do histórico e créditos
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="cortex-chat"]')).toBeVisible();

    const creditosDepoisReload = await getCredits();
    expect(creditosDepoisReload).toBe(creditosDepoisSegunda);

    // 5. Histórico persistido
    const historico = page.locator('[data-testid="chat-history"]');
    await expect(historico).toBeVisible();
    await expect(historico).toContainText(primeiraMensagem);
    await expect(historico).toContainText(segundaMensagem);

    // 6. Nova mensagem após recarregar
    const input3 = await getChatInput();
    const terceiraMensagem = 'Qual framework você recomenda?';
    await input3.fill(terceiraMensagem);
    await input3.press('Enter');

    await esperarResposta(2);

    const creditosFinais = await getCredits();
    expect(creditosFinais).toBeLessThan(creditosDepoisReload);

    await expect(historico).toContainText(terceiraMensagem);

    console.log('Fluxo concluído!');
    console.log('Créditos iniciais:', creditosIniciais);
    console.log('Créditos finais:', creditosFinais);
  });

  test('UI/UX responsiva e elementos acessíveis', async () => {
    await expect(page.locator('[data-testid="cortex-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-container"]')).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) return;

    const inputContainer = page.locator('[data-testid="input-container"]');
    const box = await inputContainer.boundingBox();
    if (box) {
      expect(box.bottom).toBeLessThanOrEqual(viewport.height);
    }

    // Scroll com conteúdo longo
    const input = await getChatInput();
    await input.fill('Mensagem longa para teste de scroll: ' + 'a'.repeat(200));
    await input.press('Enter');
    await esperarResposta(3);

    // Botão de limpar histórico (opcional)
    const limpar = page.locator('[data-testid="clear-history"]');
    if (await limpar.isVisible()) {
      await limpar.click();
      await expect(page.locator('[data-testid="chat-history"]')).not.toContainText(primeiraMensagem);
    }
  });

  test('Tratamento de erros e estados de carregamento', async () => {
    const input = await getChatInput();
    await input.fill('Teste de carregamento');
    await input.press('Enter');

    const spinner = page.locator('[data-testid="loading-spinner"]');
    if (await spinner.isVisible()) {
      await expect(spinner).toBeHidden({ timeout: 30000 });
    }

    const erro = page.locator('[data-testid="error-message"]');
    if (await erro.isVisible()) {
      await expect(erro).toContainText(/erro/i);
    }

    const respostas = page.locator('[data-testid="cortex-response"]');
    const quantidade = await respostas.count();
    expect(quantidade).toBeGreaterThan(0);
  });
});
