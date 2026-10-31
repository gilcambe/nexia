'use strict';

const { test, expect } = require('@playwright/test');
const { handleDailyStatusScreen, fallbackToOldButton } = require('../../scripts/body-coach-helper');

test.describe('Body Coach Application', () => {
  test('should handle the new daily status screen and fall back to old button if needed', async ({ page }) => {
    // Navigate to the workout page
    await page.goto('/workout');

    // Try to handle the new daily status screen
    const handledStatusScreen = await handleDailyStatusScreen(page);

    if (!handledStatusScreen) {
      // If the new screen wasn't found, try the fallback button
      const usedFallback = await fallbackToOldButton(page);
      expect(usedFallback).toBe(true);
    }

    // Verify that we're on the workout page
    await expect(page).toHaveURL(/\/workout/);

    // Additional assertions to verify the workout page is working correctly
    await expect(page.getByRole('button', { name: /INICIAR TREINO/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /COMEÇAR EXERCÍCIOS/i })).toBeVisible();
  });

  test('should allow changing exercises and navigating through them', async ({ page }) => {
    // Navigate to the workout page
    await page.goto('/workout');

    // Handle the daily status screen if it appears
    await handleDailyStatusScreen(page).catch(() => {});

    // Start the workout
    await page.getByRole('button', { name: /INICIAR TREINO/i }).click();
    await page.getByRole('button', { name: /COMEÇAR EXERCÍCIOS/i }).click();

    // Get the initial exercise name
    const initialExerciseName = await page.locator('h2, h3').filter({ hasText: /\S/ }).nth(1).innerText();

    // Change the exercise
    await page.getByRole('button', { name: /Trocar exercício/i }).click();
    await page.locator('.fixed .space-y-2 button').first().click();

    // Verify the exercise changed
    const newExerciseName = await page.locator('h2, h3').filter({ hasText: /\S/ }).nth(1).innerText();
    expect(newExerciseName).not.toBe(initialExerciseName);

    // Navigate to the next exercise
    await page.getByRole('button', { name: /CONCLUIR → PRÓXIMO/i }).click();

    // Verify we moved to the next exercise
    const nextExerciseName = await page.locator('h2, h3').filter({ hasText: /\S/ }).nth(1).innerText();
    expect(nextExerciseName).not.toBe(newExerciseName);

    // Go back to the previous exercise
    await page.getByRole('button', { name: /voltar ao exercício anterior/i }).click();

    // Verify we're back to the previous exercise
    const previousExerciseName = await page.locator('h2, h3').filter({ hasText: /\S/ }).nth(1).innerText();
    expect(previousExerciseName).toBe(newExerciseName);
  });
});
