#!/usr/bin/env node
'use strict';
// Suporte NEXIA: teste de pessoa (celular). A dona (Carol, Studio Lima) usa o painel com a senha dela; o administrador
// da NEXIA entra no mesmo painel sem a senha (link de suporte), ajuda e sai; o Gilmar (Bezsan) idem, e o suporte chega
// até a Central de Leilões. A API roda aqui (handlers reais + banco em memória): nada de produção é tocado.
// Uso: node tests/e2e/suporte-nexia-humano.js [pasta-para-fotos]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const agenda = require('../../netlify/functions/agenda.js');
const leilao = require('../../netlify/functions/leilao.js');
const { AGENDAS } = require('../../clientes/agendas.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const RAIZ = path.join(__dirname, '../../sites');
const FOTOS = process.argv[2] || '';
const API = 'https://nexia.gcbezerra.workers.dev/api/';
// Os códigos reais das donas não ficam no repositório: o teste usa o código público da agenda de teste.
const teste = AGENDAS['agenda-teste'];
const CAD = {
  studiolima: { ...AGENDAS.studiolima, codigo_salt: teste.codigo_salt, codigo_hash: teste.codigo_hash },
  bezsan: { ...AGENDAS.bezsan, codigo_salt: teste.codigo_salt, codigo_hash: teste.codigo_hash },
};
const db = fakeDb();
// Authorization "Bearer master" = administrador da NEXIA; "Bearer dona" = login comum (não é master).
const mw = { verifyBearerToken: async (e) => { const a = (e.headers || {}).authorization || ''; return a === 'Bearer master' ? { ok: true, uid: 'adm', email: 'gcbezerra@gmail.com', role: 'master' } : a ? { ok: true, uid: 'u', role: 'user' } : { ok: false }; } };
const apiAgenda = agenda.createHandler({ getDb: () => db, getMw: () => mw, getCadastro: s => CAD[s], getLista: () => ({ ...CAD, 'agenda-teste': teste }) });
const apiLeilao = leilao.createHandler({ getDb: () => db, getMw: () => mw, getCadastro: s => CAD[s], env: {}, fetch: async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => '' }) });
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
function confere(cond, msg) { if (!cond) falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); }
const chamar = async (h, ev) => { const r = await h({ headers: {}, ...ev }); return { status: r.statusCode, json: JSON.parse(r.body || '{}') }; };
const amanha = new Date(Date.now() - 3 * 3600000 + 86400000).toISOString().slice(0, 10);

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const celular = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await ctx.route('**/*', async (route) => {
      const u = route.request().url();
      if (u.startsWith(API + 'agenda') || u.startsWith(API + 'leilao')) {
        const url = new URL(u);
        const h = u.startsWith(API + 'agenda') ? apiAgenda : apiLeilao;
        const r = await h({ httpMethod: route.request().method(), headers: { 'cf-connecting-ip': '127.0.0.' + (1 + Math.floor(Math.random() * 200)) }, queryStringParameters: Object.fromEntries(url.searchParams), body: route.request().postData() });
        return route.fulfill({ status: r.statusCode, headers: r.headers, body: r.isBase64Encoded ? Buffer.from(r.body, 'base64') : (r.body || '') });
      }
      if (u.startsWith(base) || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    page.erros = []; page.on('pageerror', e => page.erros.push(e.message));
    return page;
  };
  const foto = async (page, nome) => { if (FOTOS) await page.screenshot({ path: path.join(FOTOS, nome + '.png') }); };

  console.log('1. A Carol cria a senha dela (login master do Studio Lima)');
  const carol = await celular();
  await carol.goto(base + '/studiolima/agenda/');
  await carol.click('#aba-primeiro');
  await carol.fill('#codigo', 'TESTEAGENDA');
  await carol.fill('#nova1', 'carol-lima-2026');
  await carol.fill('#nova2', 'carol-lima-2026').catch(() => {});
  await carol.click('#form-primeiro button[type=submit]');
  await carol.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await carol.isVisible('#app'), 'a Carol entra no painel com a senha dela');
  confere(!(await carol.isVisible('#faixa-suporte')), 'no painel da Carol não aparece a faixa de suporte');

  console.log('2. Uma cliente pede horário pelo site');
  const r1 = await chamar(apiAgenda, { httpMethod: 'POST', body: JSON.stringify({ acao: 'agendar', site: 'studiolima', servico: 'limpeza-de-pele', data: amanha, inicio: '10:00', nome: 'Ana Cliente', whatsapp: '11988887777', consentimento: true }) });
  confere(r1.status === 201, `pedido pelo site (${r1.status} ${r1.json.error || ''})`);

  console.log('3. Só o administrador da NEXIA abre o suporte');
  const lista0 = await chamar(apiAgenda, { httpMethod: 'GET', headers: { authorization: 'Bearer dona' }, queryStringParameters: { suporte: 'lista' } });
  confere(lista0.status === 403, 'login comum não vê a lista de clientes (403)');
  const sup0 = await chamar(apiAgenda, { httpMethod: 'POST', headers: { authorization: 'Bearer dona' }, body: JSON.stringify({ acao: 'suporte', site: 'studiolima' }) });
  confere(sup0.status === 403, 'login comum não abre suporte (403)');
  const sup00 = await chamar(apiAgenda, { httpMethod: 'POST', body: JSON.stringify({ acao: 'suporte', site: 'studiolima' }) });
  confere(sup00.status === 403, 'sem login não abre suporte (403)');
  const lista = await chamar(apiAgenda, { httpMethod: 'GET', headers: { authorization: 'Bearer master' }, queryStringParameters: { suporte: 'lista' } });
  confere(lista.status === 200 && lista.json.agendas.map(a => a.site).join(',') === 'studiolima,bezsan', 'administrador vê Studio Lima e Bezsan (sem a agenda de teste)');
  const sup = await chamar(apiAgenda, { httpMethod: 'POST', headers: { authorization: 'Bearer master' }, body: JSON.stringify({ acao: 'suporte', site: 'studiolima' }) });
  confere(sup.status === 200 && /^[a-f0-9]{64}$/.test(sup.json.token), 'administrador recebe o link de suporte do Studio Lima');

  console.log('4. O administrador entra no painel da Carol pelo celular dele, sem senha');
  const adm = await celular();
  await adm.goto(base + '/studiolima/agenda/#suporte=' + sup.json.token);
  await adm.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await adm.isVisible('#app'), 'painel abre direto, sem pedir senha');
  confere(await adm.isVisible('#faixa-suporte'), 'faixa "suporte NEXIA" aparece');
  confere(!adm.url().includes('suporte='), 'o link de suporte some do endereço (não fica no histórico)');
  await adm.waitForSelector('#lista-pendentes .item, #lista-pendentes > *', { timeout: 8000 }).catch(() => {});
  confere((await adm.textContent('#caixa-pendentes')).includes('Ana Cliente'), 'suporte vê o pedido da cliente');
  await foto(adm, '01-suporte-no-painel-da-carol');
  await adm.reload();
  await adm.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await adm.isVisible('#app') && await adm.isVisible('#faixa-suporte'), 'recarregar continua no suporte');
  const reg = await db.collection(agenda.COLLECTION).doc('studiolima').collection('suporte').get();
  confere(reg.docs.length === 1 && reg.docs[0].data().por === 'gcbezerra@gmail.com', 'a entrada do suporte fica registrada na conta do Studio Lima');

  console.log('5. O suporte sai; a Carol continua com o login dela');
  await adm.click('#nav-ajustes');
  await adm.click('#btn-sair');
  await adm.waitForSelector('#tela-login:not(.oculto)', { timeout: 8000 }).catch(() => {});
  confere(await adm.isVisible('#tela-login'), 'suporte saiu e o painel pede senha de novo');
  confere(!(await adm.isVisible('#faixa-suporte')), 'faixa de suporte some depois de sair');
  const velho = await chamar(apiAgenda, { httpMethod: 'POST', body: JSON.stringify({ acao: 'listar', site: 'studiolima', token: sup.json.token, de: amanha, ate: amanha }) });
  confere(velho.status === 401, 'o link de suporte usado não serve mais depois de sair');
  await carol.reload();
  await carol.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await carol.isVisible('#app'), 'a Carol continua logada no celular dela');

  console.log('6. Bezsan: o Gilmar tem o login dele e o suporte chega até a Central de Leilões');
  const gilmar = await celular();
  await gilmar.goto(base + '/bezsan/agenda/');
  await gilmar.click('#aba-primeiro');
  await gilmar.fill('#codigo', 'TESTEAGENDA');
  await gilmar.fill('#nova1', 'gilmar-bezsan-2026');
  await gilmar.fill('#nova2', 'gilmar-bezsan-2026').catch(() => {});
  await gilmar.click('#form-primeiro button[type=submit]');
  await gilmar.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await gilmar.isVisible('#app'), 'o Gilmar entra no painel da Bezsan com a senha dele');
  const supB = await chamar(apiAgenda, { httpMethod: 'POST', headers: { authorization: 'Bearer master' }, body: JSON.stringify({ acao: 'suporte', site: 'bezsan' }) });
  confere(supB.status === 200 && supB.json.painel === 'https://bezsan.pages.dev/agenda/', 'link de suporte da Bezsan aponta para o painel dela');
  const adm2 = await celular();
  await adm2.goto(base + '/bezsan/agenda/#suporte=' + supB.json.token);
  await adm2.waitForSelector('#app:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await adm2.isVisible('#app') && await adm2.isVisible('#faixa-suporte'), 'suporte entra no painel da Bezsan sem senha');
  await adm2.click('#nav-extra');
  await adm2.waitForURL(/leiloes/, { timeout: 8000 }).catch(() => {});
  await adm2.waitForSelector('#app:not(.oculto), #tela-sem-login:not(.oculto)', { timeout: 10000 }).catch(() => {});
  confere(await adm2.isVisible('#app') && !(await adm2.isVisible('#tela-sem-login')), 'suporte abre a Central de Leilões do Gilmar');
  await foto(adm2, '02-suporte-na-central-de-leiloes');
  const outro = await chamar(apiAgenda, { httpMethod: 'POST', body: JSON.stringify({ acao: 'listar', site: 'studiolima', token: supB.json.token, de: amanha, ate: amanha }) });
  confere(outro.status === 401, 'o link de suporte da Bezsan não abre o Studio Lima');

  console.log('7. Telas');
  for (const [nome, p] of [['Carol', carol], ['Gilmar', gilmar], ['suporte', adm], ['suporte Bezsan', adm2]]) {
    confere(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nome}: sem rolagem de lado no celular`);
    confere(p.erros.length === 0, `${nome}: nenhum erro de JavaScript${p.erros.length ? ' (' + p.erros[0] + ')' : ''}`);
  }

  await browser.close(); servidor.close();
  console.log(`\n${falhas.length ? falhas.length + ' falha(s)' : 'Tudo certo.'}`);
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
