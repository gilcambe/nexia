import { test, expect } from '@playwright/test';

test('Typing mode test', async ({ page }) => {
  // Navigate to the simulator page
  await page.goto('/simulador');

  // Select the typing mode
  await page.click('text=Modo Digitar');

  // Start the conversation
  await page.click('text=Iniciar Conversa');

  // Wait for the first question to appear
  await expect(page.locator('.question')).toBeVisible();

  // Type a correct answer and submit
  await page.fill('input[type="text"]', 'Resposta correta');
  await page.click('text=Enviar');

  // Wait for the next question to appear
  await expect(page.locator('.question')).toBeVisible();

  // Type an incorrect answer and submit
  await page.fill('input[type="text"]', 'Resposta incorreta');
  await page.click('text=Enviar');

  // Wait for the conversation to end
  await expect(page.locator('.conversation-end')).toBeVisible();

  // Check the final score
  const score = await page.locator('.score').textContent();
  expect(score).toContain('Nota: 50%');

  // Check the progress
  const progress = await page.locator('.progress').textContent();
  expect(progress).toContain('Progresso: 100%');
});
