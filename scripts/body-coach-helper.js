'use strict';

/**
 * Helper functions for the Body Coach application testing.
 * These functions assist in testing the new "Como você está hoje?" screen
 * and maintain compatibility with the existing functionality.
 */

// Function to detect and handle the new "Como você está hoje?" screen
async function handleDailyStatusScreen(page) {
  const statusScreenTitle = await page.getByText(/Como você está hoje\?/i).count();
  if (statusScreenTitle > 0) {
    // Preenche os sliders de sono, comida e energia
    const sliders = await page.locator('.slider-container').all();
    for (const slider of sliders) {
      const input = await slider.locator('input[type="range"]').first();
      await input.fill('5', { timeout: 2000 }).catch(() => {});
    }

    // Clica no botão "Salvar" ou equivalente
    await page.getByRole('button', { name: /Salvar|Continuar|OK/i }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);

    return true; // Successfully handled the status screen
  }

  return false; // Status screen not found
}

// Function to fall back to the old button if the new screen is not found
async function fallbackToOldButton(page) {
  // Try to find and click the old button
  const oldButton = await page.getByRole('button', { name: /Montar Treino de Hoje|Come[cç]ar treino de hoje/i }).count();
  if (oldButton > 0) {
    await page.getByRole('button', { name: /Montar Treino de Hoje|Come[cç]ar treino de hoje/i }).click({ timeout: 8000 });
    return true;
  }

  return false;
}

// Export the helper functions
module.exports = {
  handleDailyStatusScreen,
  fallbackToOldButton
};
