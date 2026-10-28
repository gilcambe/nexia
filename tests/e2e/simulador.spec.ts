import { test, expect } from '@playwright/test';

test('Simulador Component E2E Test', async ({ page }) => {
  await page.goto('/simulador');

  // Check if the script title and description are displayed
  await expect(page.getByText('Basic Customer Support Call')).toBeVisible();
  await expect(page.getByText('A script for a basic customer support call in English.')).toBeVisible();

  // Check if the customer message is displayed
  await expect(page.getByText('Hello, I need help with my internet connection.')).toBeVisible();

  // Click the "Hear Again" button
  await page.getByText('Hear Again').click();

  // Type a response and submit it
  await page.getByRole('textbox').fill('I need help with my internet connection.');
  await page.getByText('Submit').click();

  // Check if the feedback is displayed
  await expect(page.getByText('Great job! You matched all the expected keywords.')).toBeVisible();

  // Type a partial response and submit it
  await page.getByRole('textbox').fill('I need help with my internet.');
  await page.getByText('Submit').click();

  // Check if the feedback is displayed
  await expect(page.getByText('Good effort! You matched some of the expected keywords.')).toBeVisible();
});
