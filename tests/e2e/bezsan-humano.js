#!/usr/bin/env node
'use strict';
// NEXIA: teste de pessoa do site da BEZSAN (celular e computador). Um investidor usa cada botão do site
// (menu, links, agendar reunião, assistente) e pede uma reunião; o Gilmar entra no painel, vê o pedido com
// capital e objetivo, confirma, e muda o site pelo editor (texto, foto, seção). A API roda aqui (handler real +
// banco em memória), então não toca em nada de produção.
// Uso: node tests/e2e/bezsan-humano.js [pasta-para-fotos]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createHandler } = require('../../netlify/functions/agenda.js');
const { AGENDAS } = require('../../clientes/agendas.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const RAIZ = path.join(__dirname, '../../sites/bezsan');
const FOTOS = process.argv[2] || '';
const API_PROD = 'https://nexia.gcbezerra.workers.dev/api/agenda';
// Mesmo cadastro da Bezsan, só com o código público da agenda de teste (o código real nunca fica no repositório).
const CADASTRO = { ...AGENDAS.bezsan, codigo_salt: AGENDAS['agenda-teste'].codigo_salt, codigo_hash: AGENDAS['agenda-teste'].codigo_hash };
const db = fakeDb();
const api = createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), getCadastro: s => (s === 'bezsan' ? CADASTRO : undefined) });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});

const falhas = [];
let nOk = 0;
function confere(cond, msg) { if (cond) nOk++; else falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); return cond; }
// Próximo dia útil (de 2 a 8 dias à frente), no fuso de Brasília.
function proximoDiaUtil(min = 2) {
  for (let i = min; i < min + 8; i++) {
    const d = new Date(Date.now() - 3 * 3600000 + i * 86400000);
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) return d.toISOString().slice(0, 10);
  }
}

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const celular = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' };
  const erros = [];
  const rotas = async ctx => ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(API_PROD)) {
      const url = new URL(u);
      const r = await api({ httpMethod: route.request().method(), headers: { 'cf-connecting-ip': '127.0.0.' + (1 + Math.floor(Math.random() * 200)) }, queryStringParameters: Object.fromEntries(url.searchParams), body: route.request().postData() });
      return route.fulfill({ status: r.statusCode, headers: r.headers, body: r.isBase64Encoded ? Buffer.from(r.body, 'base64') : (r.body || '') });
    }
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort(); // fontes do Google e o resto da internet: fora do teste
  });
  const ctx = await browser.newContext(celular);
  await rotas(ctx);
  const nova = async (c = ctx) => { const p = await c.newPage(); p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept()); return p; };
  const cli = await nova();
  const car = await nova();
  let n = 0;
  const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, String(++n).padStart(2, '0') + '-' + nome + '.png') }); };
  const site = async () => { await cli.goto(base + '/', { waitUntil: 'load' }); await cli.waitForFunction(() => !document.documentElement.classList.contains('nx-carregando')); };
  const modalAberto = () => cli.isVisible('#modal-agendar');
  // Espera a rolagem suave terminar (a posição fica parada por um instante).
  const parouDeRolar = async (p = cli) => { let antes = -1; for (let i = 0; i < 40; i++) { const y = await p.evaluate(() => scrollY); if (y === antes) return; antes = y; await p.waitForTimeout(150); } };
  const esperaModal = () => cli.waitForSelector('#modal-agendar:not(.hidden)', { timeout: 10000 }).then(() => true, () => false);

  console.log('1. Investidor no celular: menu e links');
  await cli.bringToFront(); // aba de trás não anima a rolagem
  await site();
  await foto(cli, 'site-topo');
  confere((await cli.textContent('[data-ed="inicio-2"]')).includes('patrimônio'), 'site abre com o título da Bezsan');
  confere(await cli.isHidden('nav'), 'no celular o menu de cima fica recolhido');
  await cli.click('#menu-btn');
  confere(await cli.isVisible('#mobile-menu'), 'botão ☰ abre o menu');
  await foto(cli, 'menu-aberto');
  for (const [texto, alvo] of [['Mercado', 'mercado'], ['Processo', 'processo'], ['Retornos', 'retornos'], ['Equipe', 'equipe'], ['Contato', 'agendamento']]) {
    if (await cli.isHidden('#mobile-menu')) await cli.click('#menu-btn');
    await cli.click(`#mobile-menu a:has-text("${texto}")`);
    await parouDeRolar();
    const topo = await cli.$eval('#' + alvo, e => e.getBoundingClientRect().top);
    confere(Math.abs(topo) < 160 && await cli.isHidden("#mobile-menu"), `menu "${texto}" leva até a seção e fecha o menu (topo ${Math.round(topo)})`);
  }
  await cli.click('#menu-btn');
  await cli.click('#mobile-menu button.js-agendar');
  confere(await esperaModal(), 'menu "Agendar Reunião" abre o formulário');
  await cli.click('#modal-agendar-fechar');
  confere(!(await modalAberto()), 'botão × fecha o formulário');
  await cli.evaluate(() => scrollTo(0, 0));
  await cli.click('.hero-ctas .js-agendar');
  confere(await esperaModal(), '"Agendar Apresentação" do topo abre o formulário');
  await cli.mouse.click(10, 10);
  confere(!(await modalAberto()), 'tocar fora fecha o formulário');
  await cli.click('.hero-ctas a.btn-sec');
  await parouDeRolar();
  confere(Math.abs(await cli.$eval('#processo', e => e.getBoundingClientRect().top)) < 160, '"Como funciona" leva até o processo');
  confere(await cli.getAttribute('#agendamento a.btn-sec', 'href') === 'https://wa.me/5511917665454', 'botão WhatsApp aponta para o número da Bezsan');
  confere(await cli.getAttribute('#agendamento a[href^="tel:"]', 'href') === 'tel:+5511917665454', 'telefone abre a ligação');
  confere(await cli.getAttribute('#agendamento a[href^="mailto:"]', 'href') === 'mailto:contato@bezsan.com.br', 'e-mail abre o e-mail');
  const fotosOk = await cli.$$eval('.team-photo img', ims => ims.map(i => i.complete && i.naturalWidth > 100));
  confere(fotosOk.length === 3 && fotosOk.every(Boolean), 'as 3 fotos da equipe aparecem');
  const largura = await cli.evaluate(() => document.documentElement.scrollWidth);
  confere(largura <= 390, `nada passa da largura do celular (${largura}px)`);
  for (const [s, nome] of [['#equipe', 'equipe'], ['#retornos', 'retornos'], ['#comparativo', 'comparativo']]) { await cli.$eval(s, e => e.scrollIntoView()); await cli.waitForTimeout(800); await foto(cli, nome); }

  console.log('2. Pedir uma reunião');
  const D1 = proximoDiaUtil();
  await cli.click('#btn-agendar');
  confere(await esperaModal(), '"Escolher dia e horário" abre o formulário');
  const servs = await cli.$$eval('#ag-procedimento option', os => os.map(o => o.textContent));
  confere(servs.join('|') === 'Reunião por vídeo|Reunião presencial|Ligação rápida', `tipos de reunião vêm da agenda (${servs.join(', ')})`);
  confere((await cli.textContent('#ag-politica')).includes('confirma a reunião'), 'mostra o aviso da Bezsan');
  await cli.fill('#ag-data', D1);
  await cli.dispatchEvent('#ag-data', 'change');
  await cli.waitForFunction(() => !/Carregando|Escolha a data/.test(document.querySelector('#ag-horario').textContent), null, { timeout: 10000 });
  const horas = await cli.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
  confere(horas[0] === '09:00' && horas.includes('17:00') && !horas.includes('17:30'), `horários de ${D1}: 09:00 a 17:00 (${horas.length})`);
  const domingo = (() => { for (let i = 1; i < 9; i++) { const d = new Date(Date.now() - 3 * 3600000 + i * 86400000); if (d.getUTCDay() === 0) return d.toISOString().slice(0, 10); } })();
  await cli.fill('#ag-data', domingo); await cli.dispatchEvent('#ag-data', 'change');
  await cli.waitForFunction(() => !/Carregando/.test(document.querySelector('#ag-horario').textContent), null, { timeout: 10000 });
  confere(/Sem horários/.test(await cli.textContent('#ag-horario')), 'domingo não tem horário');
  await cli.selectOption('#ag-procedimento', { label: 'Reunião presencial' });
  await cli.fill('#ag-data', D1); await cli.dispatchEvent('#ag-data', 'change');
  await cli.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 2, null, { timeout: 10000 });
  await cli.selectOption('#ag-horario', '10:00');
  await cli.fill('#ag-nome', 'Marcos Investidor');
  await cli.fill('#ag-telefone', '11 98888-7777');
  await cli.fill('#ag-email', 'marcos@exemplo.com');
  await cli.selectOption('#ag-capital', 'R$ 1M – R$ 3M');
  await cli.selectOption('#ag-objetivo', 'Renda passiva');
  await cli.fill('#ag-obs', 'Prefiro de manhã');
  await foto(cli, 'formulario-preenchido');
  await cli.click('#ag-submit');
  await cli.waitForTimeout(400);
  confere(await cli.isHidden('#ag-sucesso'), 'sem marcar "Aceito", o pedido não sai');
  await cli.check('#ag-consentimento');
  await cli.click('#ag-submit');
  const enviado = await cli.waitForSelector('#ag-sucesso:not(.hidden)', { timeout: 10000 }).then(() => true, () => false);
  confere(enviado && (await cli.textContent('#ag-sucesso-detalhe')).includes('Reunião presencial') && (await cli.textContent('#ag-sucesso-detalhe')).includes('10:00'), 'pedido enviado: mostra "Reunião presencial" e 10:00');
  const zap = decodeURIComponent(await cli.getAttribute('#ag-sucesso-zap', 'href'));
  confere(zap.startsWith('https://wa.me/5511917665454') && zap.includes('Marcos Investidor'), 'botão "Avisar a Bezsan no WhatsApp" abre a conversa com o pedido escrito');
  await foto(cli, 'pedido-enviado');
  await cli.click('#ag-sucesso-fechar');
  confere(!(await modalAberto()), 'Fechar fecha o formulário');
  await cli.click('#btn-agendar'); await esperaModal();
  await cli.selectOption('#ag-procedimento', { label: 'Reunião presencial' });
  await cli.fill('#ag-data', D1); await cli.dispatchEvent('#ag-data', 'change');
  await cli.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 2, null, { timeout: 10000 });
  const depois = await cli.$$eval('#ag-horario option', os => os.map(o => o.value));
  confere(!depois.includes('10:00') && !depois.includes('09:30'), '10:00 some para o próximo investidor (e 09:30, que bateria nele)');
  await cli.keyboard.press('Escape');
  confere(!(await modalAberto()), 'tecla Esc fecha o formulário');

  console.log('3. Assistente');
  await cli.click('#chat-toggle');
  confere(await cli.isVisible('#chat-win'), 'botão 💬 abre o assistente');
  const respostas = { 'Qual o retorno?': '22% a 28%', 'Como funciona?': '6 etapas', 'Valor mínimo?': 'R$ 250 mil', 'Taxas': '7%', 'Riscos': 'diligência' };
  for (const [botao, trecho] of Object.entries(respostas)) {
    const antes = await cli.locator('.chat-msg.bot').count();
    await cli.click(`.chat-sug:has-text("${botao}")`);
    await cli.waitForFunction(k => document.querySelectorAll('.chat-msg.bot').length > k, antes);
    confere((await cli.locator('.chat-msg.bot').last().textContent()).includes(trecho), `pergunta "${botao}" tem resposta`);
  }
  await cli.fill('#chat-inp', 'vocês aceitam bitcoin?');
  await cli.press('#chat-inp', 'Enter');
  await cli.waitForTimeout(400);
  confere((await cli.locator('.chat-msg.bot').last().textContent()).includes('WhatsApp'), 'pergunta que ele não sabe vai para o WhatsApp');
  await foto(cli, 'assistente');
  await cli.click('#chat-fechar');
  confere(await cli.isHidden('#chat-win'), '× fecha o assistente');
  await cli.click('#chat-toggle');
  await cli.click('.chat-sug:has-text("Agendar reunião")');
  confere(await esperaModal(), '"Agendar reunião" no assistente abre o formulário');
  await cli.click('#modal-agendar-fechar');

  console.log('4. Computador');
  const ctxPc = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await rotas(ctxPc);
  const pc = await nova(ctxPc);
  await pc.bringToFront();
  await pc.goto(base + '/', { waitUntil: 'load' });
  await pc.waitForFunction(() => !document.documentElement.classList.contains('nx-carregando'));
  confere(await pc.isVisible('nav') && await pc.isHidden('#menu-btn'), 'no computador o menu aparece em cima');
  await pc.click('nav a:has-text("Retornos")'); await parouDeRolar(pc);
  confere(Math.abs(await pc.$eval('#retornos', e => e.getBoundingClientRect().top)) < 160, 'menu "Retornos" leva até a seção');
  await pc.evaluate(() => scrollTo(0, 0)); await pc.waitForTimeout(300);
  await foto(pc, 'computador');
  await pc.click('nav .js-agendar');
  confere(await pc.waitForSelector('#modal-agendar:not(.hidden)', { timeout: 10000 }).then(() => true, () => false), '"Agendar Reunião" do menu abre o formulário');
  await foto(pc, 'computador-formulario');
  await ctxPc.close();

  console.log('5. Gilmar no painel');
  await car.bringToFront();
  await cli.click('footer a:has-text("Área da Bezsan")');
  await cli.waitForSelector('#tela-login:not(.oculto)', { timeout: 10000 });
  confere((await cli.textContent('#login-nome')).includes('Bezsan'), 'link "Área da Bezsan" no rodapé abre o painel com o nome da Bezsan');
  await car.goto(base + '/agenda/', { waitUntil: 'load' });
  await car.click('#aba-primeiro');
  await car.fill('#codigo', 'TESTEAGENDA'); await car.fill('#nova1', 'leilao2026'); await car.fill('#nova2', 'leilao2026');
  await car.click('#form-primeiro button');
  await car.waitForSelector('#app:not(.oculto)');
  confere(true, 'primeiro acesso com o código e senha nova');
  await car.waitForFunction(() => /Marcos/.test(document.querySelector('#lista-pendentes').textContent), null, { timeout: 10000 }).catch(() => {});
  const pend = await car.textContent('#lista-pendentes');
  confere(pend.includes('Marcos Investidor') && pend.includes('Capital: R$ 1M – R$ 3M') && pend.includes('Renda passiva') && pend.includes('marcos@exemplo.com'), 'pedido aparece com e-mail, capital e objetivo');
  await foto(car, 'painel-pedido');
  await car.locator('#lista-pendentes .item', { hasText: 'Marcos' }).locator('button[data-status="confirmado"]').click();
  await car.waitForFunction(() => !document.querySelector('#lista-pendentes').textContent.includes('Marcos'), null, { timeout: 10000 });
  confere(true, 'Confirmar a reunião');

  console.log('6. Gilmar muda o site pelo painel');
  const fotoArq = path.join(require('os').tmpdir(), 'nexia-foto-bezsan.png');
  const tmp = await nova();
  await tmp.setContent('<body style="margin:0;background:linear-gradient(45deg,#334,#c9a84c)"><h1 style="font:80px serif;margin:60px;color:#fff">Foto</h1></body>');
  fs.writeFileSync(fotoArq, await tmp.screenshot({ clip: { x: 0, y: 0, width: 390, height: 390 } }));
  await tmp.close();
  await car.click('#nav-site');
  await car.waitForSelector('#site-msg.oculto', { state: 'attached', timeout: 20000 });
  confere(true, 'aba Site abre a cópia do site');
  confere(await car.isHidden('#site-procs'), 'botão "Procedimentos" não aparece (a Bezsan não tem essa lista)');
  const q = car.frameLocator('#site-quadro');
  await foto(car, 'painel-site');
  await q.locator('[data-ed="inicio-2"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere((await car.inputValue('#t-valor')) === 'Transforme\noportunidades\nem patrimônio', 'tocar no título abre o texto atual');
  await car.fill('#t-valor', 'Leilões com\nsegurança');
  await car.click('#form-texto button[type=submit]');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached' });
  await site();
  confere((await cli.innerText('[data-ed="inicio-2"]')).includes('segurança'), 'investidor vê o título novo');
  await q.locator('[data-ed="agendamento-3"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere(await car.isVisible('#t-link-caixa'), 'botão do WhatsApp mostra o campo do link');
  await car.click('#folha-texto [data-fechar]');
  await q.locator('[data-ed="equipe-foto-1"]').click();
  await car.waitForSelector('#folha-foto:not(.oculto)');
  await car.check('#f-autorizo');
  await car.setInputFiles('#f-arquivo', fotoArq);
  await car.waitForSelector('#folha-foto.oculto', { state: 'attached', timeout: 20000 });
  await site();
  await cli.locator('[data-ed="equipe-foto-1"]').scrollIntoViewIfNeeded();
  confere(await cli.waitForFunction(() => { const im = document.querySelector('[data-ed="equipe-foto-1"]'); return /foto=/.test(im.src) && im.complete && im.naturalWidth > 100; }, null, { timeout: 10000 }).then(() => true, () => false), 'foto nova do Gilmar aparece no site');
  await q.locator('[data-secao-botao="retornos"]').click();
  await car.waitForFunction(() => /mostrar/.test(document.querySelector('#site-quadro').contentDocument.querySelector('[data-secao-botao="retornos"]').textContent), null, { timeout: 10000 });
  await site();
  confere(await cli.isHidden('#retornos'), 'esconder a seção Retornos: some do site');
  await q.locator('[data-secao-botao="retornos"]').click();
  await car.waitForFunction(() => /esconder/.test(document.querySelector('#site-quadro').contentDocument.querySelector('[data-secao-botao="retornos"]').textContent), null, { timeout: 10000 });
  await site();
  confere(await cli.isVisible('#retornos'), 'mostrar de novo: volta para o site');
  await foto(cli, 'site-editado');

  confere(erros.length === 0, 'sem erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await browser.close();
  servidor.close();
  console.log(falhas.length ? `\n${falhas.length} falha(s) de ${nOk + falhas.length}` : `\nTudo certo (${nOk} conferências).`);
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
