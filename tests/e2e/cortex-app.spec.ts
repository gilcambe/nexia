import { test, expect, chromium } from '@playwright/test';

// Configuração para mobile (iPhone 12)
test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
});

test.describe('Cortex App - Teste Ponta a Ponta Mobile', () => {
  let page;
  let context;

  test.beforeAll(async () => {
    // Criar novo contexto para limpeza entre testes
    context = await chromium.launchPersistentContext('', {
      headless: false,
      slowMo: 1000,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await context.newPage();
    
    // Navegar para a página do cortex
    await page.goto('/cortex');
    
    // Esperar a página carregar completamente
    await page.waitForLoadState('networkidle');
    
    // Verificar se estamos na página correta
    await expect(page).toHaveTitle(/Cortex/i);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Fluxo completo de conversa com histórico e créditos', async () => {
    // 1. Verificar estado inicial
    const initialCreditsElement = page.locator('[data-testid="credits-display"]');
    await expect(initialCreditsElement).toBeVisible();
    const initialCredits = await initialCreditsElement.textContent();
    console.log('Créditos iniciais:', initialCredits);
    
    // 2. Iniciar conversa
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    
    // Enviar primeira mensagem
    const firstMessage = 'Olá, preciso de ajuda com um projeto de site';
    await chatInput.fill(firstMessage);
    await chatInput.press('Enter');
    
    // Esperar resposta do cortex
    const responseLocator = page.locator('[data-testid="cortex-response"]');
    await expect(responseLocator.first()).toBeVisible();
    await expect(responseLocator.first()).toContainText(/Olá/);
    
    // Verificar se créditos foram descontados após primeira mensagem
    const creditsAfterFirst = await initialCreditsElement.textContent();
    expect(creditsAfterFirst).toBeLessThan(parseInt(initialCredits));
    
    // 3. Enviar segunda mensagem
    const secondMessage = 'Quero criar um site para minha empresa';
    await chatInput.fill(secondMessage);
    await chatInput.press('Enter');
    
    // Esperar resposta
    await expect(responseLocator.nth(1)).toBeVisible();
    await expect(responseLocator.nth(1)).toContainText(/site/);
    
    // Verificar créditos após segunda mensagem
    const creditsAfterSecond = await initialCreditsElement.textContent();
    expect(creditsAfterSecond).toBeLessThan(parseInt(creditsAfterFirst));
    
    // 4. Recarregar a página para testar persistência do histórico
    await page.reload();
    
    // Esperar o carregamento completo
    await page.waitForLoadState('networkidle');
    
    // Verificar se a tela do cortex ainda está visível
    await expect(page.locator('[data-testid="cortex-chat"]')).toBeVisible();
    
    // Verificar se os créditos continuam os mesmos
    const creditsAfterReload = await initialCreditsElement.textContent();
    expect(creditsAfterReload).toBe(creditsAfterSecond);
    
    // 5. Verificar se o histórico persistiu
    const chatHistory = page.locator('[data-testid="chat-history"]');
    await expect(chatHistory).toBeVisible();
    
    // Verificar se as mensagens anteriores estão no histórico
    await expect(chatHistory).toContainText(firstMessage);
    await expect(chatHistory).toContainText(secondMessage);
    
    // 6. Enviar nova mensagem após recarregar
    const thirdMessage = 'Qual framework você recomenda?';
    await chatInput.fill(thirdMessage);
    await chatInput.press('Enter');
    
    // Esperar resposta
    await expect(responseLocator.nth(2)).toBeVisible();
    
    // Verificar créditos finais
    const finalCredits = await initialCreditsElement.textContent();
    expect(finalCredits).toBeLessThan(parseInt(creditsAfterReload));
    
    // 7. Verificar se todas as mensagens estão visíveis
    await expect(chatHistory).toContainText(thirdMessage);
    
    console.log('Fluxo concluído com sucesso!');
    console.log('Créditos iniciais:', initialCredits);
    console.log('Créditos finais:', finalCredits);
  });

  test('UI/UX responsiva e elementos acessíveis', async () => {
    // Verificar elementos principais
    const header = page.locator('[data-testid="cortex-header"]');
    await expect(header).toBeVisible();
    
    const chatContainer = page.locator('[data-testid="chat-container"]');
    await expect(chatContainer).toBeVisible();
    
    const inputContainer = page.locator('[data-testid="input-container"]');
    await expect(inputContainer).toBeVisible();
    
    // Testar responsividade - verificar elementos não estão fora da tela
    const viewportWidth = await page.viewportSize().width;
    const viewportHeight = await page.viewportSize().height;
    
    // Verificar que o input não está cortado
    const inputBoundingBox = await inputContainer.boundingBox();
    expect(inputBoundingBox.bottom).toBeLessThanOrEqual(viewportHeight);
    
    // Testar scroll
    const chatContent = page.locator('[data-testid="chat-content"]');
    const initialScrollPosition = await chatContent.evaluate(el => el.scrollTop);
    
    // Simular conteúdo longo
    await chatInput.fill('Mensagem muito longa para testar scroll: ' + 'a'.repeat(200));
    await chatInput.press('Enter');
    
    // Esperar resposta
    await expect(page.locator('[data-testid="cortex-response"]').last()).toBeVisible();
    
    // Verificar que o scroll funciona
    const finalScrollPosition = await chatContent.evaluate(el => el.scrollTop);
    expect(finalScrollPosition).toBeGreaterThan(initialScrollPosition);
    
    // Testar botão de limpar histórico
    const clearButton = page.locator('[data-testid="clear-history"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(page.locator('[data-testid="chat-history"]')).not.toContainText('Olá');
    }
  });

  test('Tratamento de erros e estados de carregamento', async () => {
    // Verificar loading spinner
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    
    // Enviar mensagem para disparar loading
    await chatInput.fill('Teste de carregamento');
    await chatInput.press('Enter');
    
    // Verificar spinner aparece
    await expect(loadingSpinner).toBeVisible();
    
    // Esperar spinner desaparecer
    await expect(loadingSpinner).toBeHidden();
    
    // Verificar mensagem de erro se houver
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      expect(errorMessage).toContainText(/erro/i);
    }
    
    // Testar timeout
    await chatInput.fill('Mensagem que pode demorar muito');
    await chatInput.press('Enter');
    
    // Esperar timeout se configurado
    await page.waitForTimeout(5000);
    
    // Verificar se houve timeout ou resposta
    const responses = page.locator('[data-testid="cortex-response"]');
    const responseCount = await responses.count();
    expect(responseCount).toBeGreaterThan(0);
  });
});