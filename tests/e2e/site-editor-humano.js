#!/usr/bin/env node
'use strict';
// NEXIA: teste de pessoa do EDITOR DO SITE (celular). A Carolina abre o painel → Site, toca nas partes da
// cópia do site e muda textos, links, fotos, seções, procedimentos, galeria, journal, cuidados, "Sobre" e as
// fotos do topo; uma cliente abre o site em outra aba e vê cada mudança. A API roda aqui (handler real +
// banco em memória), então não toca em nada de produção.
// Uso: node tests/e2e/site-editor-humano.js [pasta-para-fotos]
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
let nOk = 0;
function confere(cond, msg) { if (cond) nOk++; else falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); }

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

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(API_PROD)) {
      const url = new URL(u);
      const r = await api({ httpMethod: route.request().method(), headers: { 'cf-connecting-ip': '127.0.0.1' }, queryStringParameters: Object.fromEntries(url.searchParams), body: route.request().postData() });
      return route.fulfill({ status: r.statusCode, headers: r.headers, body: r.isBase64Encoded ? Buffer.from(r.body, 'base64') : (r.body || '') });
    }
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    if (u.startsWith('https://cdn.tailwindcss.com')) return route.fulfill({ contentType: 'text/javascript', body: await tailwindLocal() });
    return route.abort();
  });
  const erros = [];
  const nova = async () => { const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept()); return p; };
  const car = await nova();
  const cli = await nova();
  let n = 0;
  const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, String(++n).padStart(2, '0') + '-' + nome + '.png') }); };

  // Foto de teste (como se fosse do celular dela)
  const fotoArq = path.join(require('os').tmpdir(), 'nexia-foto-teste.png');
  await car.setContent('<body style="margin:0;background:linear-gradient(45deg,#c99,#fed)"><h1 style="font:80px serif;margin:60px">Foto real</h1></body>');
  fs.writeFileSync(fotoArq, await car.screenshot({ clip: { x: 0, y: 0, width: 390, height: 300 } }));

  // Cliente: site como está agora
  const site = async () => { await cli.goto(base + '/', { waitUntil: 'load' }); await cli.waitForFunction(() => !document.documentElement.classList.contains('nx-carregando')); };
  await site();
  confere((await cli.textContent('[data-ed="inicio-2"]')).includes('Studio'), 'site abre com o conteúdo original');

  console.log('Carolina entra e abre o Site');
  await car.goto(base + '/agenda/', { waitUntil: 'load' });
  await car.click('#aba-primeiro');
  await car.fill('#codigo', 'TESTEAGENDA'); await car.fill('#nova1', 'rosa2026'); await car.fill('#nova2', 'rosa2026');
  await car.click('#form-primeiro button');
  await car.waitForSelector('#app:not(.oculto)');
  confere(await car.isVisible('#nav-site'), 'menu de baixo tem "Site"');
  await car.click('#nav-site');
  await car.waitForSelector('#site-msg.oculto', { state: 'attached', timeout: 20000 });
  confere(true, 'a cópia do site abre dentro do painel');
  const q = car.frameLocator('#site-quadro');
  await foto(car, 'painel-site');

  // Texto
  console.log('Textos e links');
  await q.locator('[data-ed="inicio-2"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere((await car.inputValue('#t-valor')) === 'Studio\nLima', 'tocar no título abre o texto atual');
  await car.fill('#t-valor', 'Studio Lima\nEstética <img src=x onerror=alert(1)>');
  await foto(car, 'folha-texto');
  await car.click('#form-texto button[type=submit]');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached' });
  await q.locator('[data-ed="inicio-2"]', { hasText: 'Estética' }).waitFor();
  confere(true, 'a cópia no painel muda na hora');
  await site();
  const h1 = await cli.$eval('[data-ed="inicio-2"]', e => ({ t: e.innerText, imgs: e.querySelectorAll('img').length }));
  confere(h1.t.includes('Studio Lima') && h1.t.includes('<img') && h1.imgs === 0, 'cliente vê o título novo (e código vira texto, sem risco)');
  await q.locator('[data-ed="agendamento-4"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere(await car.isVisible('#t-link-caixa'), 'botão com link mostra o campo do link');
  await car.fill('#t-link', 'javascript:alert(1)');
  await car.click('#form-texto button[type=submit]');
  confere(await car.isVisible('#erro-texto'), 'link inseguro é recusado');
  await car.fill('#t-valor', 'Chamar no WhatsApp'); await car.fill('#t-link', 'https://wa.me/5511911112222');
  await car.click('#form-texto button[type=submit]');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached' });
  await site();
  confere((await cli.textContent('[data-ed="agendamento-4"]')).trim() === 'Chamar no WhatsApp' && (await cli.getAttribute('[data-ed="agendamento-4"]', 'href')) === 'https://wa.me/5511911112222', 'cliente vê o botão com texto e link novos');
  await q.locator('[data-ed="inicio-7"]').click();
  await car.click('#t-esconder');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached' });
  await site();
  confere(await cli.isHidden('[data-ed="inicio-7"]'), 'Esconder do site: cliente não vê mais');
  await q.locator('[data-ed="inicio-7"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere((await car.textContent('#t-esconder')) === 'Mostrar no site', 'escondido aparece apagado na cópia e oferece "Mostrar"');
  await car.click('#t-original');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached' });
  await site();
  confere(await cli.isVisible('[data-ed="inicio-7"]'), 'Voltar ao original: aparece de novo');

  // Foto fixa
  console.log('Fotos');
  await q.locator('[data-ed="procedimentos-foto-1"]').click();
  await car.waitForSelector('#folha-foto:not(.oculto)');
  await car.setInputFiles('#f-arquivo', fotoArq);
  await car.waitForSelector('#erro-foto:not(.oculto)');
  confere((await car.textContent('#erro-foto')).includes('autorização'), 'sem marcar a autorização, a foto não sobe');
  await car.check('#f-autorizo');
  await foto(car, 'folha-foto');
  await car.setInputFiles('#f-arquivo', fotoArq);
  await car.waitForSelector('#folha-foto.oculto', { state: 'attached', timeout: 15000 });
  await site();
  const src = await cli.getAttribute('[data-ed="procedimentos-foto-1"]', 'src');
  confere(/[?&]foto=[a-f0-9]{24}/.test(src), 'foto nova no site (guardada na NEXIA)');
  await cli.locator('[data-ed="procedimentos-foto-1"]').scrollIntoViewIfNeeded();
  const carregou = await cli.waitForFunction(() => { const im = document.querySelector('[data-ed="procedimentos-foto-1"]'); return im.complete && im.naturalWidth > 100; }, null, { timeout: 10000 }).then(() => true, () => false);
  confere(carregou, 'a foto abre de verdade no site');

  // Seções
  console.log('Seções');
  await q.locator('[data-secao-botao="journal"]').click();
  await car.waitForFunction(() => document.querySelector('#site-quadro').contentDocument.querySelector('[data-secao-botao="journal"]').textContent.includes('mostrar'));
  await site();
  confere(await cli.isHidden('#journal'), 'esconder a seção Journal: some do site');
  await q.locator('[data-secao-botao="journal"]').click();
  await car.waitForFunction(() => document.querySelector('#site-quadro').contentDocument.querySelector('[data-secao-botao="journal"]').textContent.includes('esconder'));
  await site();
  confere(await cli.isVisible('#journal'), 'mostrar a seção: volta');

  // Procedimentos oferecidos
  console.log('Procedimentos');
  const servicos = async () => JSON.parse((await api({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'studiolima' } })).body).servicos.map(s => s.nome);
  await car.click('#site-procs');
  await car.waitForSelector('#folha-procs:not(.oculto)');
  confere(await car.locator('#p-lista .proc').count() === 19, 'lista os 19 procedimentos');
  await foto(car, 'procedimentos-oferecidos');
  await car.locator('#p-lista .proc', { hasText: 'Criolipólise' }).locator('input').uncheck();
  await car.waitForSelector('#toast:has-text("saiu do site")');
  await site();
  confere(!(await cli.textContent('#procedures-grid')).includes('Criolipólise'), 'desmarcado: some do site');
  confere(!(await servicos()).includes('Criolipólise') && (await servicos()).includes('Avaliação'), 'desmarcado: some da agenda (Avaliação continua)');
  await car.locator('#p-lista .proc', { hasText: 'Criolipólise' }).locator('input').check();
  await car.waitForSelector('#toast:has-text("voltou")');
  await site();
  confere((await cli.textContent('#procedures-grid')).includes('Criolipólise') && (await servicos()).includes('Criolipólise'), 'marcado de novo: volta ao site e à agenda');
  await car.click('#folha-procs [data-fechar]');

  // Editar um procedimento tocando no cartão
  await q.locator('[data-lista="procedimentos"][data-i="0"]').click();
  await car.waitForSelector('#folha-item:not(.oculto)');
  confere((await car.inputValue('#i-nome')) === 'Limpeza de Pele', 'tocar no cartão abre o procedimento');
  await car.fill('#i-nome', 'Limpeza de Pele Profunda');
  await car.fill('#i-benef', 'Pele limpa\nPoros menores');
  await car.check('#i-campos [data-autorizo]');
  await car.setInputFiles('#i-campos [data-arquivo]', fotoArq);
  await car.waitForSelector('#toast:has-text("Foto enviada")');
  await foto(car, 'editar-procedimento');
  await car.click('#i-salvar');
  await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await site();
  const card0 = cli.locator('#procedures-grid > div').first();
  confere((await card0.textContent()).includes('Limpeza de Pele Profunda') && (await card0.textContent()).includes('Poros menores'), 'cliente vê o procedimento editado');
  confere(/foto=/.test(await card0.locator('img').getAttribute('src')), 'com a foto real nova');
  const sv = await servicos();
  confere(sv.includes('Limpeza de Pele Profunda') && !sv.includes('Limpeza de Pele'), 'agenda acompanha o nome novo');
  // Novo
  await q.locator('.nx-add[data-lista="procedimentos"]').click();
  await car.waitForSelector('#folha-item:not(.oculto)');
  await car.fill('#i-nome', 'Massagem Relaxante'); await car.selectOption('#i-cat', 'Corporal'); await car.fill('#i-desc', 'Uma hora de relaxamento.');
  await car.click('#i-salvar');
  await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await site();
  confere((await cli.textContent('#procedures-grid')).includes('Massagem Relaxante'), 'procedimento novo aparece no site');
  confere((await servicos()).includes('Massagem Relaxante'), 'e já dá para agendar');
  await cli.click('#btn-agendar');
  await cli.waitForSelector('#modal-agendar:not(.hidden)');
  confere((await cli.textContent('#ag-procedimento')).includes('Massagem Relaxante'), 'cliente encontra o novo no formulário de agendamento');
  // Subir, excluir
  await q.locator('#procedures-grid [data-lista="procedimentos"]', { hasText: 'Massagem Relaxante' }).click();
  await car.click('#i-subir');
  await car.waitForSelector('#toast:has-text("Ordem")');
  await car.click('[id="folha-item"] [data-fechar]');
  await site();
  const nomes = await cli.$$eval('#procedures-grid h3', hs => hs.map(h => h.textContent));
  confere(nomes.indexOf('Massagem Relaxante') === nomes.length - 2, 'Subir muda a ordem no site');
  await q.locator('#procedures-grid [data-lista="procedimentos"]', { hasText: 'Hidragloss' }).click();
  await car.click('#i-excluir');
  await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await site();
  confere(!(await cli.textContent('#procedures-grid')).includes('Hidragloss') && !(await servicos()).includes('Hidragloss'), 'Excluir tira do site e da agenda');

  // Galeria, journal, cuidados, sobre, topo
  console.log('Galeria, journal, cuidados, Sobre e fotos do topo');
  await q.locator('[data-lista="galeria"][data-i="1"]').click();
  await car.fill('#i-alt', 'Nossa sala nova'); await car.selectOption('#i-tam', 'grande');
  await car.click('#i-salvar'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('.nx-add[data-lista="galeria"]').click();
  await car.click('#i-salvar');
  confere((await car.textContent('#erro-item')).includes('foto'), 'galeria nova sem foto: pede a foto');
  await car.check('#i-campos [data-autorizo]'); await car.setInputFiles('#i-campos [data-arquivo]', fotoArq);
  await car.waitForSelector('#toast:has-text("Foto enviada")');
  await car.fill('#i-alt', 'Antes e depois (autorizado)');
  await car.click('#i-salvar'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('[data-lista="galeria"][data-i="0"]').click();
  await car.click('#i-excluir'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('[data-lista="journal"][data-i="0"]').click();
  await car.fill('#i-titulo2', 'Meu artigo novo'); await car.click('#i-salvar'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('.nx-add[data-lista="cuidados"]').click();
  await car.fill('#i-titulo3', 'Durma bem'); await car.fill('#i-desc3', 'O sono ajuda a pele.');
  await car.click('#i-salvar'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('#bio-titulo').click();
  await car.waitForSelector('#folha-item:not(.oculto)');
  confere((await car.inputValue('#i-btitulo')) === 'Carolina Martins', 'tocar no "Sobre" abre nome, textos e destaques');
  await car.fill('#i-btitulo', 'Carolina Lima'); await car.fill('#i-btags', 'Pele\nCorpo');
  await car.click('#i-salvar'); await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await q.locator('[data-lista="hero"]').click();
  await car.waitForSelector('#folha-item:not(.oculto)');
  confere(await car.locator('#i-campos .mini').count() === 4, 'fotos do topo: mostra as 4');
  await car.check('#i-campos [data-autorizo]'); await car.setInputFiles('#i-campos [data-arquivo]', fotoArq);
  await car.waitForFunction(() => document.querySelectorAll('#i-campos .mini').length === 5);
  await car.locator('#i-campos [data-h="4"][data-d="-1"]').click();
  await car.waitForSelector('#toast:has-text("Ordem")');
  await car.locator('#i-campos [data-h="0"][data-d="x"]').click();
  await car.waitForFunction(() => document.querySelectorAll('#i-campos .mini').length === 4);
  await foto(car, 'fotos-do-topo');
  await car.click('[id="folha-item"] [data-fechar]');
  await site();
  const gal = await cli.$$eval('#gallery-grid img', is => is.map(i => i.alt));
  confere(gal.includes('Nossa sala nova') && gal.includes('Antes e depois (autorizado)') && gal.length === 6, 'galeria: legenda nova, foto nova, uma excluída');
  confere((await cli.textContent('#journal-grid')).includes('Meu artigo novo'), 'journal com título novo');
  confere((await cli.textContent('#cuidados-grid')).includes('Durma bem') && (await cli.textContent('#cuidados-grid')).includes('05'), 'cuidado novo, numerado sozinho');
  confere((await cli.textContent('#bio-titulo')) === 'Carolina Lima' && (await cli.textContent('#bio-tags')).includes('Corpo'), '"Sobre" com nome e destaques novos');
  const hero = await cli.$$eval('.hero-slide', is => is.map(i => i.getAttribute('src')));
  confere(hero.length === 4 && hero.filter(s => /foto=/.test(s)).length === 1 && /foto=/.test(hero[2]), 'topo: foto nova adicionada, movida e uma excluída');
  await foto(cli, 'cliente-site-editado');

  // Voltar a lista original
  await q.locator('[data-lista="procedimentos"][data-i="0"]').click();
  await car.click('#i-padrao');
  await car.waitForSelector('#folha-item.oculto', { state: 'attached' });
  await site();
  const nomes2 = await cli.$$eval('#procedures-grid h3', hs => hs.map(h => h.textContent));
  confere(nomes2.length === 19 && nomes2[0] === 'Limpeza de Pele' && !nomes2.includes('Massagem Relaxante'), '"Voltar a lista original" devolve os procedimentos do começo');
  const sv2 = await servicos();
  confere(sv2.includes('Limpeza de Pele') && sv2.includes('Hidragloss') && !sv2.includes('Massagem Relaxante') && sv2.includes('Avaliação'), 'e a agenda acompanha');

  // Cliente agenda o procedimento depois de tudo
  await cli.click('#btn-agendar');
  await cli.waitForSelector('#modal-agendar:not(.hidden)');
  confere((await cli.locator('#ag-procedimento option').count()) === 20, 'formulário: 19 procedimentos + Avaliação');

  // Telas
  for (const w of [360, 1280]) {
    await car.setViewportSize({ width: w, height: 800 });
    confere(await car.evaluate(() => document.documentElement.scrollWidth) <= w, `painel Site sem rolagem de lado (${w}px)`);
  }
  confere(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await browser.close();
  servidor.close();
  console.log(falhas.length ? `\n${falhas.length} falha(s):\n - ${falhas.join('\n - ')}` : `\nEditor do site: ${nOk} conferências certas.`);
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
