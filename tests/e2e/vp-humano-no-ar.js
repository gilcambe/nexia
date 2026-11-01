'use strict';
// Teste de pessoa no Viajante Pro NO AR: cotação no site, painel, viagem, app do viajante, chat, editor.
// Cria dados de teste marcados "TESTE AUTOMATICO" e apaga a viagem no fim.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const B = process.env.URL || 'https://nexia.gcbezerra.workers.dev';
const OUT = process.env.OUT || 'relatorio';
const SENHA = process.env.SENHA || 'ADMIN01';
fs.mkdirSync(OUT, { recursive: true });
const R = []; const ok = (n, v, extra) => { R.push({ passo: n, ok: !!v, extra: extra || '' }); console.log((v ? 'OK   ' : 'FALHA') + ' ' + n + (extra ? ' — ' + extra : '')); };

async function rodar(perfil, nome) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...perfil, permissions: ['clipboard-read', 'clipboard-write'] });
  const erros = [];
  const nova = async () => { const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept()); return p; };
  const foto = async (p, f) => p.screenshot({ path: `${OUT}/${nome}-${f}.png`, fullPage: false });
  try {
    // 1. Site
    const p = await nova();
    await p.goto(B + '/viajante-pro/landing', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(3500);
    await foto(p, '1-site');
    ok(`[${nome}] site abre sem rolagem lateral`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= (perfil.viewport ? perfil.viewport.width : 1280) + 1);
    const quebradas = await p.$$eval('img', im => im.filter(i => i.complete && i.naturalWidth === 0).length);
    ok(`[${nome}] nenhuma imagem quebrada`, quebradas === 0, quebradas + ' quebradas');
    ok(`[${nome}] logo oficial presente`, (await p.$$eval('img', im => im.some(i => /vp-oficial|vp-sem-aviao/.test(i.src)))));
    const abas = await p.$$eval('#destinos .tab-btn', e => e.length);
    if (abas > 1) { await p.locator('#destinos .tab-btn').nth(1).click(); await p.waitForTimeout(300); }
    ok(`[${nome}] filtro de destinos`, abas > 1, abas + ' abas');
    // 2. Cotação por etapas
    await p.locator('#orcamento').scrollIntoViewIfNeeded();
    const V = { orcDestino: 'Lisboa', orcOrigem: 'São Paulo', orcPeriodo: 'Dezembro 2026', orcObs: 'TESTE AUTOMATICO - pode ignorar', orcNome: 'TESTE AUTOMATICO ' + nome, orcEmail: 'teste@exemplo.com', orcTelefone: '11999990000' };
    let resp = null;
    p.on('response', async r => { if (r.url().includes('/api/viajante-pro') && r.request().method() === 'POST') { try { resp = await r.json(); } catch (e) {} } });
    for (let i = 0; i < 6; i++) {
      for (const el of await p.$$('#orcamento .form-step input, #orcamento .form-step select, #orcamento .form-step textarea')) {
        if (!(await el.isVisible())) continue;
        const id = await el.getAttribute('id'); const tag = await el.evaluate(e => e.tagName); const tipo = await el.getAttribute('type');
        if (tag === 'SELECT') await el.selectOption({ index: 1 }); else if (tipo === 'checkbox' || tipo === 'radio') { if (!(await el.isChecked())) await el.check().catch(() => {}); } else if (!(await el.inputValue())) await el.fill(V[id] || '2');
      }
      if (await p.isVisible('.step-btn.submit')) { await p.click('.step-btn.submit'); break; }
      await p.click('.step-btn.next'); await p.waitForTimeout(300);
    }
    await p.waitForTimeout(4000);
    await foto(p, '2-cotacao');
    const codigo = resp && (resp.codigo || (resp.cotacao && resp.cotacao.codigo));
    ok(`[${nome}] cotação enviada com código`, !!codigo, codigo || JSON.stringify(resp).slice(0, 150));
    // 3. Painel de cotações
    const c = await nova();
    await c.goto(B + '/viajante-pro/cotacoes'); await c.waitForTimeout(3000);
    if (await c.isVisible('#senha')) { await c.fill('#senha', SENHA); await c.click('#login button'); }
    await c.waitForTimeout(3000);
    ok(`[${nome}] cotação aparece no painel`, codigo ? (await c.innerText('#itens')).includes(codigo) : false);
    if (codigo) { const sel = c.locator(`.card:has-text("${codigo}") select`); if (await sel.count()) { await sel.selectOption('perdida'); await c.waitForTimeout(1500); } }
    await foto(c, '3-painel-cotacoes');
    // 4. Viagens: criar
    const v = await nova();
    await v.goto(B + '/viajante-pro/viagens'); await v.waitForTimeout(3000);
    if (await v.isVisible('#senha')) { await v.fill('#senha', SENHA); await v.click('#login button'); await v.waitForTimeout(2000); }
    await v.fill('#vNome', 'TESTE AUTOMATICO ' + nome); await v.fill('#vDestino', 'Gramado'); await v.fill('#vInicio', '2026-12-20'); await v.fill('#vFim', '2026-12-27');
    await v.fill('#vWhats', '11999990000'); await v.fill('#vRoteiro', 'Chegada\nSnowland');
    await v.click('#salvar'); await v.waitForTimeout(3000);
    ok(`[${nome}] viagem criada`, (await v.innerText('#formMsg')).includes('criada'));
    const card = v.locator(`#viagens .card:has-text("TESTE AUTOMATICO ${nome}")`).first();
    await card.locator('[data-copiar]').click(); await v.waitForTimeout(500);
    const link = await v.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    ok(`[${nome}] link do app copiado`, /\/viajante-pro\/app\?v=/.test(link));
    await foto(v, '4-viagens');
    // 5. App do viajante + chat
    const a = await nova();
    await a.goto(link); await a.waitForTimeout(4000);
    ok(`[${nome}] app abre a viagem pelo link`, (await a.innerText('body')).includes('Gramado'));
    await a.evaluate(() => { const t = document.getElementById('tab-conversa'); if (t) t.click(); }); await a.waitForTimeout(1500);
    await a.fill('#input-mensagem', 'Oi, é um teste automático'); await a.click('#btn-enviar-mensagem'); await a.waitForTimeout(2500);
    await foto(a, '5-app-chat');
    await v.click('#abaConversas'); await v.waitForTimeout(2500);
    await v.locator(`#conversas [data-nome="TESTE AUTOMATICO ${nome}"]`).first().click(); await v.waitForTimeout(2500);
    ok(`[${nome}] agência recebe a mensagem`, (await v.innerText('#msgs')).includes('teste automático'));
    await v.fill('#texto', 'Resposta da agência (teste)'); await v.click('#formMsgChat button'); await v.waitForTimeout(2500);
    await foto(v, '6-conversa-agencia');
    await a.waitForTimeout(11000);
    ok(`[${nome}] viajante recebe a resposta`, (await a.innerText('body')).includes('Resposta da agência'));
    // 6. Editor (só abre e confere; não salva para não mexer no site)
    const e = await nova();
    await e.goto(B + '/viajante-pro/editar'); await e.waitForTimeout(4000);
    if (await e.isVisible('#senha')) { await e.fill('#senha', SENHA); await e.click('#login button'); await e.waitForTimeout(3000); }
    const n = await e.$$eval('#lista [data-i]', x => x.length);
    ok(`[${nome}] editor abre com os destinos`, n > 0, n + ' destinos');
    await foto(e, '7-editor');
    // limpar: excluir a viagem de teste
    await v.click('#voltar').catch(() => {}); await v.click('#abaViagens'); await v.waitForTimeout(800);
    await v.locator(`#viagens .card:has-text("TESTE AUTOMATICO ${nome}") [data-excluir]`).first().click(); await v.waitForTimeout(2500);
    ok(`[${nome}] viagem de teste apagada`, !(await v.innerText('#viagens')).includes('TESTE AUTOMATICO ' + nome));
  } catch (err) { ok(`[${nome}] erro inesperado`, false, err.message.split('\n')[0]); }
  const reais = erros.filter(x => !/tailwind|firebase|gstatic/i.test(x));
  ok(`[${nome}] sem erros de JavaScript`, reais.length === 0, reais.slice(0, 3).join(' | '));
  await b.close();
}

(async () => {
  await rodar(devices['Pixel 7'], 'celular');
  await rodar({ viewport: { width: 1366, height: 800 } }, 'computador');
  fs.writeFileSync(`${OUT}/resultado.json`, JSON.stringify(R, null, 1));
  const falhas = R.filter(r => !r.ok);
  console.log(`\n${R.length - falhas.length}/${R.length} passos OK`);
  process.exit(falhas.length ? 1 : 0);
})();
