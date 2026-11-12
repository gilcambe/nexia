// @ts-check
// 13/11/2026: o dono abriu a Central e ela quebrou logo após o login ("reading 'length'"). Este teste pega isso
// ANTES de publicar: entra com o usuário de teste (só existe no build VITE_E2E_USUARIO_TESTE=1) e abre cada tela
// do menu, com o servidor respondendo vazio ({}) e depois com listas vazias. Nenhuma tela pode mostrar o ErroNaTela.
const { test, expect } = require('@playwright/test');

const RESPOSTAS = {
  vazio: () => ({}),
  listas: () => ({ itens: [], tarefas: [], maquinas: [], projetos: [], produtos: [], modulos: [], modelos: [], ias: [], prs: [], ligado: true, contagens: {} }),
};

for (const [nome, resposta] of Object.entries(RESPOSTAS)) {
  test(`Central: todas as telas abrem sem erro (servidor ${nome})`, async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e && e.message || e)));
    await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resposta()) }));
    await page.route(/firebase|googleapis|gstatic/, (r) => r.abort());
    await page.goto('/central');
    await expect(page.getByTestId('kx-casca')).toBeVisible({ timeout: 30_000 });
    const telas = await page.locator('[data-testid^="kx-menu-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(telas.length).toBeGreaterThan(5);
    for (const t of telas) {
      await page.evaluate((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) (b).click(); }, t);
      await page.waitForTimeout(400);
      await expect(page.getByTestId('kx-erro-na-tela'), `tela ${t}`).toHaveCount(0);
    }
    expect(erros.filter((e) => !/Failed to fetch|NetworkError|aborted|ERR_FAILED/i.test(e)), 'erros de página').toEqual([]);
  });
}
