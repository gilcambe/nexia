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
    // só sites externos: o app tem pedaços chamados firebase-*.js no próprio servidor (bloquear eles deixava a tela vazia)
    await page.route((u) => /firebase|googleapis|gstatic/.test(u.hostname), (r) => r.abort());
    // dist/central/ existe (logos), então o servidor de teste não devolve o app em /central: entra por / e troca a rota.
    await page.goto('/');
    await page.evaluate(() => { history.pushState(null, '', '/central'); dispatchEvent(new PopStateEvent('popstate')); });
    try {
      await expect(page.getByTestId('kx-casca')).toBeVisible({ timeout: 30_000 });
    } catch (e) {
      console.log('URL:', page.url(), '\nTELA:', (await page.locator('body').innerText()).slice(0, 800), '\nERROS:', erros.join(' | '));
      throw e;
    }
    const telas = await page.locator('[data-testid^="kx-menu-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(telas.length).toBeGreaterThan(5);
    for (const t of telas) {
      await page.evaluate((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) (b).click(); }, t);
      await page.waitForTimeout(400);
      await expect(page.getByTestId('kx-erro-na-tela'), `tela ${t}`).toHaveCount(0);
      // C2-F1: menu de 7 itens; as outras telas viram abas no topo. Abre cada aba também.
      const abas = await page.locator('[data-testid^="kx-aba-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      for (const a of abas) {
        await page.evaluate((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) (b).click(); }, a);
        await page.waitForTimeout(400);
        await expect(page.getByTestId('kx-erro-na-tela'), `aba ${a}`).toHaveCount(0);
      }
    }
    expect(erros.filter((e) => !/Failed to fetch|NetworkError|aborted|ERR_FAILED/i.test(e)), 'erros de página').toEqual([]);
  });
}
