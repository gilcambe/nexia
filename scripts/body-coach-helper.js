'use strict';

/**
 * Detecta e responde à tela "Como você está hoje?" (sono, comida, energia) no Body Coach,
 * garantindo que o botão antigo ainda funcione como fallback.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>} Retorna true se encontrou e clicou no botão de iniciar/montar treino.
 */
async function responderComoVoceEstaHoje(page) {
  // Verifica se a seção "Como você está hoje" está presente
  const temTela = await page.getByText(/Como você está hoje/i).first().isVisible({ timeout: 2000 }).catch(() => false);

  if (temTela) {
    // Sono (ex: "Dormi bem" ou "Bem")
    const btnSono = page.getByRole('button', { name: /Dormi bem|Bem/i }).first();
    if (await btnSono.isVisible().catch(() => false)) {
      await btnSono.click().catch(() => {});
    }

    // Alimentação / Comida (ex: "Comi bem" ou "Bem")
    const btnComida = page.getByRole('button', { name: /Comi bem|Bem/i }).first();
    if (await btnComida.isVisible().catch(() => false)) {
      await btnComida.click().catch(() => {});
    }

    // Energia (nível 3 ou 4)
    const btnEnergia = page.getByRole('button', { name: /^[34]$/ }).first();
    if (await btnEnergia.isVisible().catch(() => false)) {
      await btnEnergia.click().catch(() => {});
    }

    // Avançar / Submeter o formulário
    const btnSubmit = page.getByRole('button', { name: /Come[cç]ar treino|Montar Treino de Hoje/i }).first();
    if (await btnSubmit.isVisible().catch(() => false)) {
      await btnSubmit.click({ timeout: 8000 });
      return true;
    }
  }

  // Fallback: se a tela não foi detectada ou se o botão antigo está visível diretamente
  const btnAntigo = page.getByRole('button', { name: /Montar Treino de Hoje|Come[cç]ar treino de hoje/i }).first();
  if (await btnAntigo.isVisible().catch(() => false)) {
    await btnAntigo.click({ timeout: 8000 });
    return true;
  }

  return false;
}

module.exports = {
  responderComoVoceEstaHoje,
};
