#!/usr/bin/env node
'use strict';
// NEXIA Agenda: teste de pessoa (celular). Abre o site do Studio Lima e o painel /agenda num navegador de
// verdade, clica em cada botão e confere o resultado. A API roda aqui mesmo (handler real + banco em memória),
// então não toca em nada de produção. Uso: node tests/e2e/agenda-humano.js [pasta-para-fotos]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createHandler } = require('../../netlify/functions/agenda.js');
const { AGENDAS } = require('../../clientes/agendas.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const RAIZ = path.join(__dirname, '../../sites/studiolima');
const FOTOS = process.argv[2] || '';
const API_PROD = 'https://nexia.gcbezerra.workers.dev/api/agenda';
// O código real do Studio Lima não fica no repositório: aqui o teste usa o código público da agenda de teste.
const CADASTRO = { ...AGENDAS.studiolima, codigo_salt: AGENDAS['agenda-teste'].codigo_salt, codigo_hash: AGENDAS['agenda-teste'].codigo_hash };
const db = fakeDb();
const api = createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), getCadastro: s => (s === 'studiolima' ? CADASTRO : undefined) });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});

const falhas = [];
const ok = [];
function confere(cond, msg) { (cond ? ok : falhas).push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); }
const amanha = () => new Date(Date.now() - 3 * 3600000 + 86400000).toISOString().slice(0, 10);
const depois = n => new Date(Date.now() - 3 * 3600000 + n * 86400000).toISOString().slice(0, 10);

// Sem internet, o Tailwind do site é compilado aqui (mesma configuração da página) e entra no lugar do CDN.
let _tw = null;
async function tailwindLocal() {
  if (_tw) return _tw;
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const m = html.match(/tailwind\.config = (\{[\s\S]*?\n {2}\});/);
  const cfg = m ? new Function('return ' + m[1])() : {};
  const postcss = require('postcss');
  const tailwind = require('tailwindcss');
  const css = (await postcss([tailwind({ ...cfg, content: [{ raw: html, extension: 'html' }] })]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })).css;
  _tw = `window.tailwind={};document.head.insertAdjacentHTML('afterbegin',${JSON.stringify('<style>' + css + '</style>')});`;
  return _tw;
}

async function foto(page, nome) { if (FOTOS) await page.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: false }); }

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  // A API de produção é atendida aqui pelo handler real; o resto da internet é cortado (teste rápido e fechado).
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(API_PROD)) {
      const url = new URL(u);
      const r = await api({ httpMethod: route.request().method(), headers: { 'cf-connecting-ip': '127.0.0.1' }, queryStringParameters: Object.fromEntries(url.searchParams), body: route.request().postData() });
      return route.fulfill({ status: r.statusCode, headers: r.headers, body: r.body || '' });
    }
    if (u.startsWith(base) || u.startsWith('data:')) return route.continue();
    if (/fonts\.(googleapis|gstatic)\.com|cdn\.tailwindcss\.com/.test(u) && process.env.INTERNET === '1') return route.continue();
    // Sem internet, o Tailwind não carrega: o mínimo para "hidden" esconder de verdade.
    if (u.startsWith('https://cdn.tailwindcss.com')) return route.fulfill({ contentType: 'text/javascript', body: await tailwindLocal() });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errosJs = [];
  page.on('pageerror', e => errosJs.push(e.message));
  page.on('dialog', d => d.accept());

  console.log('Site do Studio Lima');
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.click('#btn-agendar');
  await page.waitForSelector('#modal-agendar:not(.hidden)');
  confere(await page.locator('#ag-procedimento option').count() === 20, 'formulário mostra os 20 procedimentos');
  confere((await page.textContent('#ag-politica')).includes('24 horas'), 'mostra o aviso de cancelamento');
  await page.fill('#ag-data', amanha());
  await page.dispatchEvent('#ag-data', 'change');
  await page.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 2);
  const horas = await page.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
  confere(horas[0] === '06:00' && horas.includes('22:00') && !horas.includes('22:30'), `horários de amanhã de 06:00 a 22:00 (${horas.length})`);
  await page.selectOption('#ag-horario', '10:00');
  await page.fill('#ag-nome', 'Ana Teste');
  await page.fill('#ag-telefone', '11 98888-7777');
  await page.fill('#ag-obs', 'Primeira vez');
  await foto(page, '01-site-formulario');
  await page.click('#ag-submit');
  confere(await page.isVisible('#ag-sucesso') === false, 'sem aceitar o contato, não envia');
  await page.check('#ag-consentimento');
  await page.click('#ag-submit');
  await page.waitForSelector('#ag-sucesso:not(.hidden)');
  confere((await page.textContent('#ag-sucesso-detalhe')).includes('10:00'), 'pedido enviado com dia e hora');
  confere((await page.getAttribute('#ag-sucesso-zap', 'href')).startsWith('https://wa.me/5511960324530?text='), 'botão de avisar a Carolina no WhatsApp');
  await foto(page, '02-site-pedido-enviado');
  await page.click('#ag-sucesso-fechar');
  confere(await page.isHidden('#modal-agendar'), 'fecha o formulário');

  // Mesmo horário de novo: tem que recusar.
  await page.locator('#procedures-grid a[href="#agendamento"]').first().click();
  await page.waitForSelector('#modal-agendar:not(.hidden)');
  confere(await page.$eval('#ag-procedimento', s => s.options[s.selectedIndex].text) === 'Limpeza de Pele', '"Agendar este procedimento" já escolhe o procedimento');
  await page.fill('#ag-data', amanha());
  await page.dispatchEvent('#ag-data', 'change');
  await page.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 2);
  const horas2 = await page.$$eval('#ag-horario option', os => os.map(o => o.value));
  confere(!horas2.includes('10:00') && !horas2.includes('09:30') && horas2.includes('11:00'), 'horário pedido some do site');
  await page.click('#modal-agendar-fechar');

  console.log('Painel da Carolina');
  await page.goto(base + '/agenda/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tela-login:not(.oculto)');
  await foto(page, '03-painel-entrar');
  await page.fill('#senha', 'qualquer');
  await page.click('#form-entrar button');
  await page.waitForSelector('#form-primeiro:not(.oculto)');
  confere(true, 'sem senha criada, leva para "Primeiro acesso"');
  await page.fill('#codigo', 'ERRADO1234');
  await page.fill('#nova1', 'rosa2026'); await page.fill('#nova2', 'rosa2026');
  await page.click('#form-primeiro button');
  await page.waitForSelector('#erro-primeiro:not(.oculto)');
  confere((await page.textContent('#erro-primeiro')).includes('Código'), 'código errado é recusado');
  await page.fill('#codigo', 'TESTE-AGENDA');
  await page.fill('#nova2', 'rosa2027');
  await page.click('#form-primeiro button');
  confere((await page.textContent('#erro-primeiro')).includes('iguais'), 'senhas diferentes são recusadas');
  await page.fill('#nova2', 'rosa2026');
  await page.click('#form-primeiro button');
  await page.waitForSelector('#app:not(.oculto)');
  await page.waitForSelector('#caixa-pendentes:not(.oculto)');
  confere((await page.textContent('#lista-pendentes')).includes('Ana Teste'), 'pedido do site aparece em "Pedidos para responder"');
  confere(await page.textContent('#nav-pend') === '1', 'contador de pedidos no menu');
  await foto(page, '04-painel-pedido-novo');

  await page.click('#lista-pendentes button[data-status="confirmado"]');
  await page.waitForSelector('#caixa-pendentes.oculto', { state: 'attached' });
  confere(true, 'Confirmar tira o pedido da lista de espera');
  await page.click('#dia-prox');
  await page.waitForSelector('#lista-dia .item.confirmado');
  confere((await page.textContent('#lista-dia')).includes('Confirmado'), 'amanhã mostra o horário confirmado');
  const zap = await page.getAttribute('#lista-dia .item.confirmado a', 'href');
  confere(zap.startsWith('https://wa.me/5511988887777') && decodeURIComponent(zap).includes('confirmado'), 'WhatsApp com mensagem de confirmação pronta');
  await foto(page, '05-painel-amanha');

  // Marcar à mão
  await page.click('#fab');
  await page.click('#abrir-novo');
  await page.waitForSelector('#n-horas button');
  await page.fill('#n-nome', 'Bia Manual');
  await page.fill('#n-whats', '11977776666');
  await page.click('#n-horas button[data-h="14:00"]');
  await foto(page, '06-painel-marcar');
  await page.click('#n-salvar');
  await page.waitForSelector('#folha-novo.oculto', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#lista-dia').textContent.includes('Bia Manual'));
  confere(true, 'Marcar horário à mão aparece na agenda');
  confere(await page.locator('#faixa-dias .dia.ativo i').textContent() === '2 marc.', 'faixa de dias conta 2 marcados');

  // Atendido e Faltou
  const bia = page.locator('#lista-dia .item', { hasText: 'Bia Manual' });
  await bia.locator('button[data-status="concluido"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#lista-dia .item')].some(i => i.textContent.includes('Bia Manual') && i.classList.contains('concluido')));
  confere(true, 'Atendido');
  await page.locator('#lista-dia .item', { hasText: 'Bia Manual' }).locator('button[data-status="confirmado"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#lista-dia .item')].some(i => i.textContent.includes('Bia Manual') && i.classList.contains('confirmado')));
  await page.locator('#lista-dia .item', { hasText: 'Bia Manual' }).locator('button[data-status="faltou"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#lista-dia .item')].some(i => i.textContent.includes('Bia Manual') && i.classList.contains('faltou')));
  confere(true, 'Voltar para confirmado e Faltou');

  // Cancelar libera o horário no site
  await page.locator('#lista-dia .item', { hasText: 'Ana Teste' }).locator('button[data-status="cancelado"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#lista-dia .item')].some(i => i.textContent.includes('Ana Teste') && i.classList.contains('cancelado')));
  const livres = JSON.parse((await api({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'studiolima', data: amanha(), servico: 'limpeza-de-pele' } })).body).horarios;
  confere(livres.includes('10:00'), 'Cancelar devolve o horário para o site');

  // Bloquear o dia inteiro depois de amanhã
  await page.click('#fab');
  await page.click('#abrir-bloq');
  await page.fill('#b-data', depois(2));
  await page.fill('#b-motivo', 'Folga');
  await foto(page, '07-painel-bloquear');
  await page.click('#form-bloq button[type=submit]');
  await page.waitForSelector('#lista-dia .item.bloqueio');
  confere((await page.textContent('#dia-titulo')).includes(depois(2).slice(8, 10)), 'vai para o dia bloqueado');
  const bloq = JSON.parse((await api({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'studiolima', data: depois(2) } })).body).horarios;
  confere(bloq.length === 0, 'dia bloqueado não oferece horário no site');
  await foto(page, '08-painel-dia-bloqueado');
  await page.click('#lista-dia button[data-acao="desbloquear"]');
  await page.waitForFunction(() => !document.querySelector('#lista-dia .item.bloqueio'));
  confere(true, 'Desbloquear');

  // Bloquear um intervalo
  await page.click('#fab'); await page.click('#abrir-bloq');
  await page.uncheck('#b-todo');
  await page.fill('#b-ini', '12:00'); await page.fill('#b-fim', '13:30');
  await page.click('#form-bloq button[type=submit]');
  await page.waitForSelector('#lista-dia .item.bloqueio');
  confere((await page.textContent('#lista-dia .item.bloqueio')).includes('12:00–13:30'), 'bloqueio de intervalo');

  // Navegação
  await page.click('#btn-hoje');
  confere((await page.textContent('#dia-titulo')).startsWith('Hoje'), 'botão Hoje');
  await page.click('#dia-ant');
  await page.waitForFunction(() => !document.querySelector('#dia-titulo').textContent.startsWith('Hoje'));
  confere(true, 'dia anterior');
  await page.locator('#faixa-dias .dia').nth(5).click();
  confere(await page.locator('#faixa-dias .dia.ativo').count() === 1, 'toque num dia da faixa');
  await page.click('#btn-atualizar');
  await page.waitForSelector('#toast:not(.oculto)');
  confere(true, 'Atualizar');
  // Fechar folha pelo X e tocando fora
  await page.click('#fab'); await page.click('#folha-menu [data-fechar]');
  confere(await page.isHidden('#folha-menu'), 'fecha pelo X');
  await page.click('#fab'); await page.mouse.click(195, 40);
  confere(await page.isHidden('#folha-menu'), 'fecha tocando fora');

  // Ajustes
  await page.click('#nav-ajustes');
  await page.waitForSelector('#pag-ajustes:not(.oculto)');
  confere(await page.locator('#cfg-servicos .serv').count() === 20, 'ajustes mostram os 20 serviços');
  await foto(page, '09-painel-ajustes');
  await page.fill('#cfg-aviso', 'Chegue 10 minutos antes.');
  await page.click('#add-serv');
  await page.locator('#cfg-servicos .serv').last().locator('.s-nome').fill('Design de Sobrancelha');
  await page.locator('#cfg-servicos .serv').last().locator('.s-dur').fill('30');
  await page.locator('#cfg-servicos .serv').first().locator('.s-del').click();
  await page.uncheck('#cfg-semana .linha-dia[data-w="0"] .d-on');
  await page.fill('#cfg-semana .linha-dia[data-w="6"] .d-fim', '14:00');
  await page.click('#form-config button[type=submit]');
  await page.waitForSelector('#msg-config.ok');
  const pub = JSON.parse((await api({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'studiolima' } })).body);
  confere(pub.servicos.some(s => s.nome === 'Design de Sobrancelha' && s.duracao === 30) && !pub.servicos.some(s => s.nome === 'Limpeza de Pele'), 'serviço novo e removido valem no site');
  confere(pub.aviso === 'Chegue 10 minutos antes.', 'aviso novo vale no site');
  confere(!pub.dias.some(d => new Date(d + 'T12:00:00Z').getUTCDay() === 0), 'domingo desligado some do site');
  await page.fill('#s-atual', 'errada'); await page.fill('#s-nova', 'lirio2026');
  await page.click('#form-senha button');
  await page.waitForSelector('#msg-senha.erro');
  confere(true, 'senha atual errada é recusada');
  await page.fill('#s-atual', 'rosa2026');
  await page.click('#form-senha button');
  await page.waitForSelector('#msg-senha.ok');
  confere(true, 'Trocar senha');
  await page.click('#nav-agenda');
  confere(await page.isVisible('#pag-agenda'), 'volta para a agenda');
  await page.click('#nav-ajustes');
  await page.click('#btn-sair');
  await page.waitForSelector('#tela-login:not(.oculto)');
  confere(true, 'Sair');
  await page.fill('#senha', 'rosa2026'); await page.click('#form-entrar button');
  await page.waitForSelector('#erro-entrar:not(.oculto)');
  confere((await page.textContent('#erro-entrar')).includes('errada'), 'senha antiga não entra mais');
  await page.fill('#senha', 'lirio2026'); await page.click('#form-entrar button');
  await page.waitForSelector('#app:not(.oculto)');
  confere(true, 'entra com a senha nova');

  // O site recebe o serviço novo
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.click('#btn-agendar');
  await page.waitForSelector('#modal-agendar:not(.hidden)');
  confere((await page.textContent('#ag-procedimento')).includes('Design de Sobrancelha'), 'site mostra o serviço criado no painel');

  // Computador
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '/agenda/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not(.oculto)');
  await foto(page, '10-painel-computador');
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  confere(largura <= 1280, 'sem rolagem de lado no computador');
  await page.setViewportSize({ width: 360, height: 740 });
  confere(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'sem rolagem de lado em celular pequeno');

  confere(errosJs.length === 0, 'nenhum erro de JavaScript' + (errosJs.length ? ': ' + errosJs.join(' | ') : ''));
  await browser.close();
  servidor.close();
  console.log(`\n${ok.length} ok, ${falhas.length} falha(s)`);
  if (falhas.length) { console.log(falhas.map(f => ' - ' + f).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
