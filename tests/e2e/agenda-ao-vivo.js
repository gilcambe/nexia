#!/usr/bin/env node
'use strict';
// NEXIA Agenda: teste no ar. 1) Fluxo completo na agenda de teste (dados de mentira) contra a API publicada.
// 2) Abre o site do Studio Lima publicado no celular e confere que o formulário mostra serviços e horários
//    de verdade, sem enviar pedido (para não sujar a agenda da Carolina), e que o painel abre.
// 3) Como cliente: pede horário pelo site publicado (apontado para a agenda de teste), Carolina recusa um e
//    confirma outro no painel publicado, e o site volta a mostrar o horário recusado.
// Uso: node tests/e2e/agenda-ao-vivo.js [https://<site>.pages.dev] [pasta-para-fotos]
const fs = require('fs');
const path = require('path');

const API = process.env.AGENDA_API || 'https://nexia.gcbezerra.workers.dev/api/agenda';
const SITE_URL = (process.argv[2] || 'https://studiolima.pages.dev').replace(/\/$/, '');
const FOTOS = process.argv[3] || '';
const SENHA_TESTE = 'agenda-teste-2026'; // agenda de teste: código e senha públicos de propósito

const falhas = [];
function confere(cond, msg) { if (!cond) falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); }
async function post(corpo) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: 'agenda-teste', ...corpo }) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
const get = async q => { const r = await fetch(API + '?' + new URLSearchParams({ site: 'agenda-teste', ...q })); return { status: r.status, json: await r.json().catch(() => ({})) }; };

(async () => {
  console.log('API no ar (agenda de teste)');
  const cfg = await get({});
  confere(cfg.status === 200 && cfg.json.servicos && cfg.json.servicos.length === 2, `GET serviços (${cfg.status})`);
  let ent = await post({ acao: 'primeiro-acesso', codigo: 'TESTEAGENDA', senha_nova: SENHA_TESTE });
  if (ent.status !== 200) ent = await post({ acao: 'entrar', senha: SENHA_TESTE });
  confere(ent.status === 200 && ent.json.token, `entrar no painel de teste (${ent.status} ${ent.json.error || ''})`);
  const token = ent.json.token;
  const dia = cfg.json.dias.find(d => d > cfg.json.dias[0]) || cfg.json.dias[0];
  const h = await get({ data: dia, servico: 'corte' });
  confere(h.status === 200 && h.json.horarios.length > 0, `horários livres em ${dia}: ${h.json.horarios && h.json.horarios.length}`);
  const hora = h.json.horarios[h.json.horarios.length - 1];
  const ped = await post({ acao: 'agendar', servico: 'corte', data: dia, inicio: hora, nome: 'Teste Automático', whatsapp: '11999990000', consentimento: true });
  confere(ped.status === 201, `pedido pelo site (${ped.status} ${ped.json.error || ''})`);
  const h2 = await get({ data: dia, servico: 'corte' });
  confere(!h2.json.horarios.includes(hora), 'horário pedido some');
  const dup = await post({ acao: 'agendar', servico: 'corte', data: dia, inicio: hora, nome: 'Outra Pessoa', whatsapp: '11999990001', consentimento: true });
  confere(dup.status === 409, 'mesmo horário de novo é recusado');
  const lista = await post({ acao: 'listar', token, de: dia, ate: dia });
  const meu = (lista.json.itens || []).find(i => i.id === ped.json.id);
  confere(meu && meu.status === 'pendente', 'pedido aparece no painel como pendente');
  confere((await post({ acao: 'status', token, id: ped.json.id, status: 'confirmado' })).status === 200, 'confirmar');
  confere((await post({ acao: 'status', token, id: ped.json.id, status: 'cancelado' })).status === 200, 'cancelar');
  confere((await get({ data: dia, servico: 'corte' })).json.horarios.includes(hora), 'cancelado volta a ficar livre');
  const b = await post({ acao: 'bloquear', token, data: dia, motivo: 'teste' });
  confere(b.status === 201 && (await get({ data: dia })).json.horarios.length === 0, 'bloquear dia');
  confere((await post({ acao: 'desbloquear', token, id: b.json.id })).status === 200, 'desbloquear');
  confere((await post({ acao: 'sair', token })).status === 200, 'sair');

  console.log('Site publicado: ' + SITE_URL);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })).newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const foto = async n => { if (FOTOS) await page.screenshot({ path: path.join(FOTOS, n + '.png') }); };
  await page.goto(SITE_URL + '/', { waitUntil: 'networkidle' });
  await foto('01-site');
  await page.click('#btn-agendar');
  await page.waitForSelector('#modal-agendar:not(.hidden)', { timeout: 15000 });
  const nServ = await page.locator('#ag-procedimento option').count();
  confere(nServ >= 1, `formulário com ${nServ} serviços vindos da agenda`);
  const amanha = new Date(Date.now() - 3 * 3600000 + 86400000).toISOString().slice(0, 10);
  await page.fill('#ag-data', amanha);
  await page.dispatchEvent('#ag-data', 'change');
  await page.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 1 || /Sem horários/.test(document.querySelector('#ag-horario').textContent), null, { timeout: 15000 });
  const horas = await page.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
  confere(horas.length > 0, `horários de amanhã no site: ${horas.length}`);
  await foto('02-site-formulario');
  await page.goto(SITE_URL + '/agenda/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#tela-login:not(.oculto)', { timeout: 15000 });
  confere((await page.textContent('#login-nome')).includes('Studio Lima'), 'painel /agenda abre com o nome do estúdio');
  await foto('03-painel-entrar');

  // 3) Como cliente de verdade: o site publicado, só que apontando para a agenda de teste (para não sujar a da Carolina).
  console.log('Cliente pelo site publicado + Carolina no painel publicado (agenda de teste)');
  const ctx = page.context();
  await ctx.route(u => u.href.startsWith(API), async route => {
    const req = route.request();
    const url = req.url().replace(/([?&]site=)[^&]*/, '$1agenda-teste');
    let postData = req.postData();
    if (postData) { try { const j = JSON.parse(postData); j.site = 'agenda-teste'; postData = JSON.stringify(j); } catch (e) {} }
    await route.continue(postData ? { url, postData } : { url });
  });
  page.on('dialog', d => d.accept());
  const pedir = async (nome, fone) => {
    await page.goto(SITE_URL + '/', { waitUntil: 'networkidle' });
    await page.click('#btn-agendar');
    await page.waitForSelector('#modal-agendar:not(.hidden)');
    await page.fill('#ag-data', dia);
    await page.dispatchEvent('#ag-data', 'change');
    await page.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 1, null, { timeout: 15000 });
    const livres = await page.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
    const hh = livres[0];
    await page.selectOption('#ag-horario', hh);
    await page.fill('#ag-nome', nome);
    await page.fill('#ag-telefone', fone);
    await page.check('#ag-consentimento');
    await page.click('#ag-submit');
    await page.waitForSelector('#ag-sucesso:not(.hidden)', { timeout: 15000 });
    return { hh, livres };
  };
  const horasDoSite = async () => {
    await page.goto(SITE_URL + '/', { waitUntil: 'networkidle' });
    await page.click('#btn-agendar');
    await page.waitForSelector('#modal-agendar:not(.hidden)');
    await page.fill('#ag-data', dia);
    await page.dispatchEvent('#ag-data', 'change');
    await page.waitForFunction(() => document.querySelectorAll('#ag-horario option').length > 1, null, { timeout: 15000 });
    return page.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
  };
  const p1 = await pedir('Cliente Recusa', '11 97777-0001');
  confere((await page.textContent('#ag-sucesso-detalhe')).includes(p1.hh), `cliente pede ${p1.hh} pelo site e vê "pedido enviado"`);
  await foto('04-cliente-pedido-enviado');
  const p2 = await pedir('Cliente Confirma', '11 97777-0002');
  confere(p2.hh !== p1.hh, `segunda cliente pede ${p2.hh} (o horário da primeira já não aparece)`);

  // Carolina abre o painel publicado e responde
  await page.goto(SITE_URL + '/agenda/?site=agenda-teste', { waitUntil: 'networkidle' });
  await page.waitForSelector('#tela-login:not(.oculto)');
  await page.fill('#senha', SENHA_TESTE);
  await page.click('#form-entrar button');
  await page.waitForSelector('#caixa-pendentes:not(.oculto)', { timeout: 15000 });
  const pend = await page.textContent('#lista-pendentes');
  confere(pend.includes('Cliente Recusa') && pend.includes('Cliente Confirma'), 'os dois pedidos aparecem em "Pedidos para responder"');
  await foto('05-painel-pedidos');
  await page.locator('#lista-pendentes .item', { hasText: 'Cliente Recusa' }).locator('button[data-status="cancelado"]').click();
  await page.waitForFunction(() => !document.querySelector('#lista-pendentes').textContent.includes('Cliente Recusa'), null, { timeout: 15000 });
  confere(true, 'Carolina toca em Recusar e o pedido sai da lista');
  await page.locator('#lista-pendentes .item', { hasText: 'Cliente Confirma' }).locator('button[data-status="confirmado"]').click();
  await page.waitForSelector('#caixa-pendentes.oculto', { state: 'attached', timeout: 15000 });
  confere(true, 'Carolina toca em Confirmar no outro pedido');
  await page.click(`#faixa-dias [data-dia="${dia}"]`);
  await page.waitForFunction(() => document.querySelector('#lista-dia .item.cancelado') && document.querySelector('#lista-dia .item.confirmado'), null, { timeout: 15000 });
  const zapRec = decodeURIComponent(await page.locator('#lista-dia .item.cancelado', { hasText: 'Cliente Recusa' }).locator('a').getAttribute('href'));
  confere(zapRec.startsWith('https://wa.me/5511977770001') && zapRec.includes('não vou conseguir atender'), 'recusado: botão WhatsApp abre a conversa da cliente com o aviso pronto');
  const zapOk = decodeURIComponent(await page.locator('#lista-dia .item.confirmado', { hasText: 'Cliente Confirma' }).locator('a').getAttribute('href'));
  confere(zapOk.startsWith('https://wa.me/5511977770002') && zapOk.includes('está confirmado'), 'confirmado: botão WhatsApp abre a conversa com a confirmação pronta');
  await foto('06-painel-recusado-e-confirmado');

  // De volta ao site: o horário recusado voltou a ficar livre, o confirmado continua ocupado
  const depois = await horasDoSite();
  confere(depois.includes(p1.hh), `horário recusado (${p1.hh}) volta a aparecer no site`);
  confere(!depois.includes(p2.hh), `horário confirmado (${p2.hh}) continua ocupado no site`);
  await foto('07-site-horario-liberado');

  // Limpa: cancela o confirmado e sai do painel
  await page.goto(SITE_URL + '/agenda/?site=agenda-teste', { waitUntil: 'networkidle' });
  await page.waitForSelector('#pag-agenda', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#faixa-dias [data-dia]'), null, { timeout: 15000 });
  await page.click(`#faixa-dias [data-dia="${dia}"]`);
  await page.waitForSelector('#lista-dia .item.confirmado', { timeout: 15000 });
  await page.locator('#lista-dia .item.confirmado', { hasText: 'Cliente Confirma' }).locator('button[data-status="cancelado"]').click();
  await page.waitForFunction(() => !document.querySelector('#lista-dia .item.confirmado'), null, { timeout: 15000 });
  confere(true, 'limpeza: horário de teste cancelado');

  confere(erros.length === 0, 'sem erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await browser.close();
  console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo no ar.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
