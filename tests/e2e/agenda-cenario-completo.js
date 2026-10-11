#!/usr/bin/env node
'use strict';
// NEXIA Agenda: o cenário inteiro, no ar, como pessoas de verdade no celular.
// Usa o site e o painel PUBLICADOS do cliente, mas apontados para a agenda de teste (nada chega na agenda real):
// a cliente pede pelo site; a dona faz o primeiro acesso, confirma, recusa, marca à mão, marca atendido/faltou,
// cancela, bloqueia dia e intervalo, muda serviços/horários/aviso, troca a senha e sai. Depois de cada ação o
// teste volta ao site e confere o que a cliente vê. No fim desfaz tudo (agenda de teste volta como estava).
// Uso: node tests/e2e/agenda-cenario-completo.js [https://<site>.pages.dev] [pasta-para-fotos]
const fs = require('fs');
const path = require('path');

const API_PROD = 'https://nexia.gcbezerra.workers.dev/api/agenda'; // o endereço que o site e o painel usam
const API = process.env.AGENDA_API || API_PROD;
const SITE_URL = (process.argv[2] || 'https://studiolima.pages.dev').replace(/\/$/, '');
const FOTOS = process.argv[3] || '';
const SLUG = 'agenda-teste';
const CODIGO = 'TESTEAGENDA'; // agenda de teste: código e senha públicos de propósito
const SENHA = 'agenda-teste-2026';
const SENHA_TEMP = 'agenda-temp-2026';
const RUN = String(Date.now()).slice(-5);
// O que muda de um site para outro no passo do editor (foto que troca, seção que esconde, lista de procedimentos).
const PERFIS = {
  studiolima: { foto: 'procedimentos-foto-1', secao: 'journal', nomeSecao: 'Journal', procs: true },
  bezsan: { foto: 'equipe-foto-1', secao: 'retornos', nomeSecao: 'Retornos', procs: false },
};
const PERFIL = PERFIS[new URL(SITE_URL).hostname.split('.')[0]] || PERFIS.studiolima;

const falhas = [];
function confere(cond, msg) { if (!cond) falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); return cond; }
async function post(corpo) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SLUG, ...corpo }) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
async function get(q) { const r = await fetch(API + '?' + new URLSearchParams({ site: SLUG, ...q })); return r.json().catch(() => ({})); }
const semana = d => new Date(d + 'T12:00:00Z').getUTCDay();

(async () => {
  // Estado inicial: config original (para devolver no fim) e dias de trabalho para o teste.
  const ini = await post({ acao: 'primeiro-acesso', codigo: CODIGO, senha_nova: SENHA });
  if (!confere(ini.status === 200, `agenda de teste pronta (${ini.status} ${ini.json.error || ''})`)) process.exit(1);
  const tokenApi = ini.json.token; // também serve para a limpeza no fim
  const original = (await post({ acao: 'listar', token: tokenApi })).json.config;
  const pub0 = await get({});
  const uteis = pub0.dias.filter(d => semana(d) >= 1 && semana(d) <= 5);
  const D1 = uteis[1], D2 = uteis[2];
  const SAB = pub0.dias.find(d => semana(d) === 6 && d > pub0.dias[0]);
  console.log(`Dias do teste: ${D1} (pedidos) · ${D2} (bloqueio) · sábado ${SAB} · rodada ${RUN}`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let livres1 = [];
  let cli = null, car = null;
  try {
  const erros = [];
  const abrir = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    // O site do cliente fala com a agenda dele; aqui troca para a agenda de teste.
    await ctx.route(u => u.href.startsWith(API_PROD), async route => {
      const req = route.request();
      const url = req.url().replace(API_PROD, API).replace(/([?&]site=)[^&]*/, '$1' + SLUG);
      let body = req.postData();
      if (body) { try { const j = JSON.parse(body); j.site = SLUG; body = JSON.stringify(j); } catch (e) {} }
      const r = await fetch(url, { method: req.method(), headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body || undefined });
      await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body: Buffer.from(await r.arrayBuffer()) });
    });
    // Só para rodar fora da internet (teste local): o Tailwind do site vem de um arquivo.
    if (process.env.TAILWIND_LOCAL_JS) await ctx.route('https://cdn.tailwindcss.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.TAILWIND_LOCAL_JS, 'utf8') }));
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push(e.message));
    p.on('response', async r => { if (r.url().startsWith(API_PROD) && r.status() >= 400) console.log(`    (API respondeu ${r.status()}: ${(await r.text().catch(() => '')).slice(0, 200)})`); });
    p.on('dialog', d => d.accept());
    return p;
  };
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  let nFoto = 0;
  const foto = async (p, n) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, String(++nFoto).padStart(2, '0') + '-' + n + '.png') }); };

  cli = await abrir();
  car = await abrir();

  // ---------- Site (cliente) ----------
  const abrirForm = async () => {
    await cli.goto(SITE_URL + '/', { waitUntil: 'networkidle' });
    await cli.click('#btn-agendar');
    await cli.waitForSelector('#modal-agendar:not(.hidden)', { timeout: 15000 });
  };
  const horasNoSite = async (data, servico = 'corte') => {
    await abrirForm();
    await cli.selectOption('#ag-procedimento', servico);
    await cli.fill('#ag-data', data);
    await cli.dispatchEvent('#ag-data', 'change');
    await cli.waitForFunction(() => { const t = document.querySelector('#ag-horario').textContent; return !/Carregando|Escolha a data/.test(t); }, null, { timeout: 15000 });
    return cli.$$eval('#ag-horario option', os => os.map(o => o.value).filter(Boolean));
  };
  const pedir = async (data, hora, nome, fone, aceitar = true) => {
    const livres = await horasNoSite(data);
    if (!livres.includes(hora)) return { ok: false, livres };
    await cli.selectOption('#ag-horario', hora);
    await cli.fill('#ag-nome', nome);
    await cli.fill('#ag-telefone', fone);
    await cli.fill('#ag-obs', 'teste ' + RUN);
    if (aceitar) await cli.check('#ag-consentimento');
    await cli.click('#ag-submit');
    if (!aceitar) return { ok: await cli.isVisible('#ag-sucesso') };
    await cli.waitForSelector('#ag-sucesso:not(.hidden)', { timeout: 15000 });
    return { ok: true };
  };

  console.log('\n1. Cliente no site');
  await abrirForm();
  const servs = await cli.$$eval('#ag-procedimento option', os => os.map(o => o.textContent));
  confere(servs.join('|') === original.servicos.map(s => s.nome).join('|'), `formulário mostra os serviços da agenda (${servs.join(', ')})`);
  confere((await cli.textContent('#ag-politica')).trim() === (original.aviso || '').trim(), 'mostra o aviso da agenda');
  await foto(cli, 'site-formulario');
  livres1 = await horasNoSite(D1);
  confere(livres1.length > 6, `horários livres em ${D1}: ${livres1.length}`);
  const [hA, hB, hC] = [livres1[0], livres1[1], livres1[2]];
  const hMao = livres1.find(h => h >= '14:00') || livres1[5];
  const fechado = await horasNoSite(pub0.dias.find(d => semana(d) === 0) || D1);
  confere(!pub0.dias.some(d => semana(d) === 0) || fechado.length === 0, 'domingo (fechado) não aparece como dia de atendimento');
  const semAceite = await pedir(D1, hA, 'Ana ' + RUN, '11 97777-1001', false);
  confere(!semAceite.ok, 'sem marcar "Aceito", o pedido não sai');
  const pA = await pedir(D1, hA, 'Ana ' + RUN, '11 97777-1001');
  confere(pA.ok && (await cli.textContent('#ag-sucesso-detalhe')).includes(hA), `Ana pede ${hA} e vê "Pedido enviado"`);
  const zapCli = decodeURIComponent(await cli.getAttribute('#ag-sucesso-zap', 'href'));
  confere(zapCli.startsWith('https://wa.me/' + original.whatsapp.replace(/\D/g, '')) && zapCli.includes('Ana ' + RUN), 'botão "Avisar no WhatsApp" abre a conversa do estúdio com o pedido escrito');
  await foto(cli, 'site-pedido-enviado');
  await cli.click('#ag-sucesso-fechar');
  confere(await cli.isHidden('#modal-agendar'), 'botão Fechar fecha o formulário');
  confere(!(await horasNoSite(D1)).includes(hA), `${hA} some do site para a próxima cliente`);
  confere((await pedir(D1, hB, 'Bia ' + RUN, '11 97777-1002')).ok, `Bia pede ${hB}`);
  confere((await pedir(D1, hC, 'Cris ' + RUN, '11 97777-1003')).ok, `Cris pede ${hC}`);

  // ---------- Painel (dona) ----------
  console.log('\n2. Dona do estúdio: entrar e primeiro acesso');
  await car.goto(SITE_URL + '/agenda/?site=' + SLUG, { waitUntil: 'networkidle' });
  await car.waitForSelector('#tela-login:not(.oculto)', { timeout: 15000 });
  await car.fill('#senha', 'senha-errada-1');
  await car.click('#form-entrar button');
  await car.waitForSelector('#erro-entrar:not(.oculto)', { timeout: 15000 });
  confere((await car.textContent('#erro-entrar')).includes('errada'), 'senha errada não entra');
  await car.click('#aba-primeiro');
  await car.fill('#codigo', 'ERRADO1234'); await car.fill('#nova1', SENHA); await car.fill('#nova2', SENHA);
  await car.click('#form-primeiro button');
  await car.waitForSelector('#erro-primeiro:not(.oculto)', { timeout: 15000 });
  confere((await car.textContent('#erro-primeiro')).includes('Código'), 'código errado é recusado');
  await car.fill('#codigo', CODIGO); await car.fill('#nova2', SENHA + 'x');
  await car.click('#form-primeiro button');
  confere((await car.textContent('#erro-primeiro')).includes('iguais'), 'senhas diferentes são recusadas');
  await foto(car, 'painel-primeiro-acesso');
  await car.fill('#nova2', SENHA);
  await car.click('#form-primeiro button');
  await car.waitForSelector('#app:not(.oculto)', { timeout: 15000 });
  confere(true, 'código certo + senha nova: entra no painel');

  console.log('\n3. Responder os pedidos');
  await car.waitForSelector('#caixa-pendentes:not(.oculto)', { timeout: 15000 });
  const pend = await car.textContent('#lista-pendentes');
  confere(['Ana', 'Bia', 'Cris'].every(n => pend.includes(n + ' ' + RUN)), 'os 3 pedidos aparecem em "Pedidos para responder"');
  confere(Number(await car.textContent('#nav-pend')) >= 3, 'contador de pedidos no menu');
  await foto(car, 'painel-pedidos');
  const cartaoPend = n => car.locator('#lista-pendentes .item', { hasText: n + ' ' + RUN });
  await cartaoPend('Ana').locator('button[data-status="confirmado"]').click();
  await car.waitForFunction(n => !document.querySelector('#lista-pendentes').textContent.includes(n), 'Ana ' + RUN, { timeout: 15000 });
  confere(true, 'Confirmar (Ana)');
  await cartaoPend('Bia').locator('button[data-status="cancelado"]').click();
  await car.waitForFunction(n => !document.querySelector('#lista-pendentes').textContent.includes(n), 'Bia ' + RUN, { timeout: 15000 });
  confere(true, 'Recusar (Bia)');
  await cartaoPend('Cris').locator('button[data-status="confirmado"]').click();
  await car.waitForSelector('#caixa-pendentes.oculto', { state: 'attached', timeout: 15000 });
  confere(true, 'Confirmar (Cris): lista de pedidos fica vazia');

  const irDia = async d => {
    await car.click('#nav-agenda');
    for (let i = 0; i < 15 && !(await car.$(`#faixa-dias [data-dia="${d}"]`)); i++) await car.click('#dia-prox');
    await car.click(`#faixa-dias [data-dia="${d}"]`);
    await car.waitForFunction(() => !document.querySelector('#lista-dia').textContent.includes('Carregando'), null, { timeout: 15000 });
  };
  const cartao = n => car.locator('#lista-dia .item', { hasText: n + ' ' + RUN });
  const temStatus = (n, st) => car.waitForFunction(([n, st]) => [...document.querySelectorAll('#lista-dia .item')].some(i => i.textContent.includes(n) && i.classList.contains(st)), [n + ' ' + RUN, st], { timeout: 15000 });
  await irDia(D1);
  await temStatus('Ana', 'confirmado'); await temStatus('Bia', 'cancelado'); await temStatus('Cris', 'confirmado');
  confere(true, `no dia ${D1}: Ana e Cris confirmadas, Bia recusada`);
  const zap = async n => decodeURIComponent(await cartao(n).locator('a').getAttribute('href'));
  const zA = await zap('Ana'), zB = await zap('Bia');
  confere(zA.startsWith('https://wa.me/5511977771001') && zA.includes('está confirmado'), 'WhatsApp da confirmada: conversa dela com a confirmação pronta');
  confere(zB.startsWith('https://wa.me/5511977771002') && zB.includes('não vou conseguir atender'), 'WhatsApp da recusada: conversa dela com o aviso e convite para outro horário');
  await foto(car, 'painel-dia-respondido');
  let site = await horasNoSite(D1);
  confere(site.includes(hB) && !site.includes(hA) && !site.includes(hC), `site: ${hB} (recusado) volta livre; ${hA} e ${hC} (confirmados) ocupados`);

  console.log('\n4. Marcar à mão, Atendido, Faltou, Cancelar');
  await car.click('#fab');
  await car.click('#abrir-novo');
  await car.fill('#n-data', D1);
  await car.dispatchEvent('#n-data', 'change');
  await car.waitForSelector(`#n-horas button[data-h="${hMao}"]`, { timeout: 15000 });
  await car.fill('#n-nome', 'Duda ' + RUN);
  await car.fill('#n-whats', '11977771004');
  await car.click(`#n-horas button[data-h="${hMao}"]`);
  await foto(car, 'painel-marcar-a-mao');
  await car.click('#n-salvar');
  await car.waitForSelector('#folha-novo.oculto', { state: 'attached', timeout: 15000 });
  await temStatus('Duda', 'confirmado');
  confere(true, `Marcar um horário à mão (Duda, ${hMao}) já entra confirmado`);
  confere(!(await horasNoSite(D1)).includes(hMao), `site: ${hMao} ocupado pelo horário marcado à mão`);
  await cartao('Ana').locator('button[data-status="concluido"]').click(); await temStatus('Ana', 'concluido');
  confere(true, 'Atendido (Ana)');
  await cartao('Ana').locator('button[data-status="confirmado"]').click(); await temStatus('Ana', 'confirmado');
  confere(true, 'Voltar para confirmado (Ana)');
  await cartao('Duda').locator('button[data-status="faltou"]').click(); await temStatus('Duda', 'faltou');
  confere(true, 'Faltou (Duda)');
  await cartao('Cris').locator('button[data-status="cancelado"]').click(); await temStatus('Cris', 'cancelado');
  confere(true, 'Cancelar um confirmado (Cris)');
  site = await horasNoSite(D1);
  confere(site.includes(hC), `site: ${hC} cancelado volta a ficar livre`);
  await cartao('Bia').locator('button[data-status="confirmado"]').click(); await temStatus('Bia', 'confirmado');
  confere(!(await horasNoSite(D1)).includes(hB), `recusou por engano: "Voltar para confirmado" ocupa ${hB} de novo no site`);

  console.log('\n5. Bloquear');
  await car.click('#fab'); await car.click('#abrir-bloq');
  await car.fill('#b-data', D2); await car.fill('#b-motivo', 'Folga ' + RUN);
  await foto(car, 'painel-bloquear');
  await car.click('#form-bloq button[type=submit]');
  await car.waitForSelector('#lista-dia .item.bloqueio', { timeout: 15000 });
  confere((await car.textContent('#lista-dia .item.bloqueio')).includes('Dia todo'), `dia ${D2} bloqueado`);
  confere((await horasNoSite(D2)).length === 0 && /Sem horários/.test(await cli.textContent('#ag-horario')), 'site: dia bloqueado mostra "Sem horários livres"');
  await foto(cli, 'site-dia-bloqueado');
  await irDia(D2);
  await car.click('#lista-dia button[data-acao="desbloquear"]');
  await car.waitForFunction(() => !document.querySelector('#lista-dia .item.bloqueio'), null, { timeout: 15000 });
  confere((await horasNoSite(D2)).length > 6, 'Desbloquear: site volta a mostrar horários');
  await irDia(D1);
  await car.click('#fab'); await car.click('#abrir-bloq');
  await car.fill('#b-data', D1); await car.uncheck('#b-todo');
  await car.fill('#b-ini', '16:00'); await car.fill('#b-fim', '17:00'); await car.fill('#b-motivo', 'Almoço ' + RUN);
  await car.click('#form-bloq button[type=submit]');
  await car.waitForSelector('#lista-dia .item.bloqueio', { timeout: 15000 });
  site = await horasNoSite(D1);
  confere(!site.includes('16:00') && !site.includes('16:30') && site.includes('17:00'), 'bloqueio 16:00–17:00: site some com 16:00 e 16:30, mantém 17:00');
  await irDia(D1);
  await car.click('#lista-dia button[data-acao="desbloquear"]');
  await car.waitForFunction(() => !document.querySelector('#lista-dia .item.bloqueio'), null, { timeout: 15000 });
  confere((await horasNoSite(D1)).includes('16:00'), 'desbloquear intervalo devolve 16:00 ao site');

  console.log('\n6. Navegar no painel');
  await car.click('#btn-hoje');
  confere((await car.textContent('#dia-titulo')).startsWith('Hoje'), 'botão Hoje');
  await car.click('#dia-prox');
  confere((await car.textContent('#dia-titulo')).startsWith('Amanhã'), 'próximo dia (›)');
  await car.click('#dia-ant');
  confere((await car.textContent('#dia-titulo')).startsWith('Hoje'), 'dia anterior (‹)');
  await car.click('#btn-atualizar');
  await car.waitForSelector('#toast:not(.oculto)');
  confere(true, 'Atualizar');
  await car.click('#fab'); await car.click('#folha-menu [data-fechar]');
  confere(await car.isHidden('#folha-menu'), 'menu + fecha no X');

  console.log('\n7. Ajustes: serviços, horários e aviso');
  const sabAntes = SAB ? (await horasNoSite(SAB)).length : 0;
  confere(!SAB || sabAntes > 0, `site: sábado (${SAB}) tem horários antes do ajuste (${sabAntes})`);
  await car.click('#nav-ajustes');
  await car.waitForSelector('#pag-ajustes:not(.oculto)');
  confere(await car.locator('#cfg-servicos .serv').count() === original.servicos.length, 'Ajustes mostram os serviços');
  await car.fill('#cfg-aviso', 'Aviso novo ' + RUN);
  await car.click('#add-serv');
  await car.locator('#cfg-servicos .serv').last().locator('.s-nome').fill('Escova ' + RUN);
  await car.locator('#cfg-servicos .serv').last().locator('.s-dur').fill('45');
  await car.uncheck('#cfg-semana .linha-dia[data-w="6"] .d-on');
  await car.fill('#cfg-semana .linha-dia[data-w="1"] .d-fim', '17:00');
  await foto(car, 'painel-ajustes');
  await car.click('#form-config button[type=submit]');
  await car.waitForSelector('#msg-config.ok', { timeout: 15000 });
  confere(true, 'Salvar ajustes');
  await abrirForm();
  confere((await cli.textContent('#ag-procedimento')).includes('Escova ' + RUN), 'site: serviço novo aparece');
  confere((await cli.textContent('#ag-politica')).includes('Aviso novo ' + RUN), 'site: aviso novo aparece');
  await foto(cli, 'site-depois-dos-ajustes');
  confere(!SAB || (await horasNoSite(SAB)).length === 0, `site: sábado desligado (${SAB}) fica sem horários`);
  const seg = pub0.dias.find(d => semana(d) === 1 && d > D1) || pub0.dias.find(d => semana(d) === 1);
  const hSeg = await horasNoSite(seg);
  confere(hSeg.length > 0 && !hSeg.includes('17:00') && hSeg.includes('16:30'), `site: segunda (${seg}) agora termina às 17:00`);
  // devolve a configuração original pelo painel: tira o serviço novo e religa o sábado
  await car.click('#nav-ajustes');
  await car.evaluate(n => [...document.querySelectorAll('#cfg-servicos .serv')].find(l => l.querySelector('.s-nome').value === n).querySelector('.s-del').click(), 'Escova ' + RUN);
  await car.fill('#cfg-aviso', original.aviso || '');
  await car.check('#cfg-semana .linha-dia[data-w="6"] .d-on');
  await car.fill('#cfg-semana .linha-dia[data-w="6"] .d-fim', original.semana[6][0][1]);
  await car.fill('#cfg-semana .linha-dia[data-w="1"] .d-fim', original.semana[1][0][1]);
  await car.click('#form-config button[type=submit]');
  await car.waitForSelector('#msg-config.ok', { timeout: 15000 });
  confere(!(await horasNoSite(D1).then(() => cli.textContent('#ag-procedimento'))).includes('Escova'), 'remover serviço: some do site');

  console.log('\n8. Editar o site pelo painel (aba Site)');
  const fotoArq = path.join(require('os').tmpdir(), 'nexia-foto-teste-' + RUN + '.png');
  await cli.setContent('<body style="margin:0;background:linear-gradient(45deg,#c99,#fed)"><h1 style="font:60px serif;margin:40px">Foto ' + RUN + '</h1></body>');
  fs.writeFileSync(fotoArq, await cli.screenshot({ clip: { x: 0, y: 0, width: 390, height: 300 } }));
  const siteCarregado = async () => { await cli.goto(SITE_URL + '/', { waitUntil: 'networkidle' }); await cli.waitForFunction(() => !document.documentElement.classList.contains('nx-carregando')); };
  await car.click('#nav-site');
  await car.waitForSelector('#site-msg.oculto', { state: 'attached', timeout: 30000 });
  confere(true, 'aba Site abre a cópia do site para tocar');
  const q = car.frameLocator('#site-quadro');
  await foto(car, 'painel-site');
  await q.locator('[data-ed="inicio-2"]').click();
  await car.waitForSelector('#folha-texto:not(.oculto)');
  confere((await car.inputValue('#t-valor')).replace(/\s+/g, ' ').trim().length > 0, 'tocar no título abre o texto atual');
  await car.fill('#t-valor', 'Título ' + RUN);
  await car.click('#form-texto button[type=submit]');
  await car.waitForSelector('#folha-texto.oculto', { state: 'attached', timeout: 15000 });
  await siteCarregado();
  confere((await cli.textContent('[data-ed="inicio-2"]')).includes('Título ' + RUN), 'cliente vê o título novo no site');
  await q.locator(`[data-ed="${PERFIL.foto}"]`).click();
  await car.waitForSelector('#folha-foto:not(.oculto)');
  await car.check('#f-autorizo');
  await car.setInputFiles('#f-arquivo', fotoArq);
  await car.waitForSelector('#folha-foto.oculto', { state: 'attached', timeout: 30000 });
  await siteCarregado();
  await cli.locator(`[data-ed="${PERFIL.foto}"]`).scrollIntoViewIfNeeded();
  const fotoOk = await cli.waitForFunction(k => { const im = document.querySelector(`[data-ed="${k}"]`); return /foto=/.test(im.src) && im.complete && im.naturalWidth > 100; }, PERFIL.foto, { timeout: 15000 }).then(() => true, () => false);
  confere(fotoOk, 'foto enviada pelo celular aparece no site (guardada grátis na NEXIA)');
  if (PERFIL.procs) {
    await car.click('#site-procs');
    await car.waitForSelector('#folha-procs:not(.oculto)');
    const nomeProc = (await car.locator('#p-lista .proc').nth(1).locator('label').textContent()).trim();
    await car.locator('#p-lista .proc').nth(1).locator('input').uncheck();
    await car.waitForSelector('#toast:has-text("saiu do site")', { timeout: 15000 });
    await foto(car, 'procedimentos-oferecidos');
    await car.click('#folha-procs [data-fechar]');
    await siteCarregado();
    confere(!(await cli.textContent('#procedures-grid')).includes(nomeProc), `desmarcar "${nomeProc}": some do site`);
    const servAgora = (await get({})).servicos.map(s => s.nome);
    confere(!servAgora.includes(nomeProc) && servAgora.length > 5, 'e some da agenda (os outros procedimentos viram serviços da agenda)');
  } else confere(await car.isHidden('#site-procs'), 'sem lista de procedimentos neste site: o botão não aparece');
  await q.locator(`[data-secao-botao="${PERFIL.secao}"]`).click();
  await car.waitForFunction(k => /mostrar/.test(document.querySelector('#site-quadro').contentDocument.querySelector(`[data-secao-botao="${k}"]`).textContent), PERFIL.secao, { timeout: 15000 });
  await siteCarregado();
  confere(await cli.isHidden('#' + PERFIL.secao), `esconder a seção ${PERFIL.nomeSecao}: some do site`);
  await foto(cli, 'site-editado');

  console.log('\n9. Senha e sair');
  await car.click('#nav-ajustes');
  await car.fill('#s-atual', 'errada-123'); await car.fill('#s-nova', SENHA_TEMP);
  await car.click('#form-senha button');
  await car.waitForSelector('#msg-senha.erro', { timeout: 15000 });
  confere(true, 'trocar senha com a senha atual errada é recusado');
  await car.fill('#s-atual', SENHA);
  await car.click('#form-senha button');
  await car.waitForSelector('#msg-senha.ok', { timeout: 15000 });
  confere(true, 'Trocar senha');
  await car.click('#btn-sair');
  await car.waitForSelector('#tela-login:not(.oculto)', { timeout: 15000 });
  confere(true, 'Sair deste aparelho');
  await car.fill('#senha', SENHA); await car.click('#form-entrar button');
  await car.waitForSelector('#erro-entrar:not(.oculto)', { timeout: 15000 });
  confere(true, 'senha antiga não entra mais');
  await car.fill('#senha', SENHA_TEMP); await car.click('#form-entrar button');
  await car.waitForSelector('#app:not(.oculto)', { timeout: 15000 });
  confere(true, 'entra com a senha nova');
  await car.reload({ waitUntil: 'networkidle' });
  await car.waitForSelector('#app:not(.oculto)', { timeout: 15000 });
  confere(true, 'reabrir a página continua logado');

  console.log('\n10. Telas');
  for (const [p, nome] of [[cli, 'site'], [car, 'painel']]) {
    await p.setViewportSize({ width: 360, height: 740 });
    confere(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, nome + ': sem rolagem de lado em celular pequeno');
    await p.setViewportSize({ width: 1280, height: 800 });
    confere(await p.evaluate(() => document.documentElement.scrollWidth) <= 1280, nome + ': sem rolagem de lado no computador');
  }
  await foto(car, 'painel-computador');
  confere(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) {
    confere(false, 'o teste parou: ' + String(e.message || e).split('\n')[0]);
    // Para entender a parada: o que o painel e o site mostravam.
    for (const [p, nome] of [[car, 'erro-painel'], [cli, 'erro-site']].filter(x => x[0])) {
      try { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, '99-' + nome + '.png') }); console.log(`  ${nome}: ` + (await p.evaluate(() => [...document.querySelectorAll('.msg:not(.oculto), #toast:not(.oculto), [role=alert]:not(.oculto)')].map(x => x.textContent.trim()).filter(Boolean).join(' | ')))); } catch (er) {}
    }
  }
  await browser.close();

  // ---------- Limpeza: agenda de teste volta como estava ----------
  await post({ acao: 'trocar-senha', token: tokenApi, senha_atual: SENHA_TEMP, senha_nova: SENHA });
  const l = await post({ acao: 'listar', token: tokenApi, de: D1, ate: D2 });
  for (const it of l.json.itens || []) {
    const meu = (it.nome || '').includes(RUN) || (it.motivo || '').includes(RUN);
    if (!meu) continue;
    if (it.tipo === 'bloqueio') await post({ acao: 'desbloquear', token: tokenApi, id: it.id });
    else if (['confirmado', 'pendente', 'concluido', 'faltou'].includes(it.status)) await post({ acao: 'status', token: tokenApi, id: it.id, status: 'cancelado' });
  }
  await post({ acao: 'config', token: tokenApi, config: original });
  await post({ acao: 'site-salvar', token: tokenApi, conteudo: {} });
  await post({ acao: 'sair', token: tokenApi });
  const depois = await get({});
  confere(!(((await get({ conteudo: '1' })).conteudo || {}).textos || {})['inicio-2'], 'limpeza: site de teste sem edições');
  confere(JSON.stringify(depois.servicos) === JSON.stringify(pub0.servicos) && (await get({ data: D1 })).horarios.length >= livres1.length - 1, 'limpeza: agenda de teste voltou como estava');

  console.log(falhas.length ? `\n${falhas.length} falha(s):\n - ${falhas.join('\n - ')}` : '\nCenário completo certo no ar.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
