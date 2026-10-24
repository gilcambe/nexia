'use strict';
// Teste de ponta a ponta no NAVEGADOR (Chromium): o site público e o painel da Amanda conversam de verdade
// com o backend /api/locacao (o handler real, com banco de mentira). Pega o tipo de erro em que a tela chama
// uma ação que o servidor não tem, ou lê um campo que o servidor não devolve.
// Se o Chromium não estiver instalado, os testes são pulados (o CI instala).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createHandler, hashSenha } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* sem playwright */ }

const RAIZ = path.join(__dirname, '..', '..', 'sites', 'splash');
const API_HOST = 'nexia.gcbezerra.workers.dev';
const SALT = '1234567890abcdef1234567890abcdef';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.xml': 'application/xml', '.txt': 'text/plain' };

const dia = n => new Date(Date.now() - 3 * 3600000 + n * 86400000).toISOString().slice(0, 10);

async function ambiente() {
  const db = fakeDb();
  const cadastro = { nome: 'Splash', versao: 1, codigo_salt: SALT, codigo_hash: await hashSenha('CODIGO123', SALT), config: LOCACOES.splash.config };
  const handler = createHandler({
    getDb: () => db,
    getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }),
    getCadastro: s => (s === 'splash' ? cadastro : undefined),
    getLista: () => ({ splash: cadastro }),
  });
  let n = 0;
  const chamar = (method, body, query) => handler({
    httpMethod: method,
    headers: { 'cf-connecting-ip': `10.7.${(n >> 8) & 255}.${n++ & 255}` },
    queryStringParameters: query || {},
    body: body ? JSON.stringify({ site: 'splash', ...body }) : '',
  }).then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));

  const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nao'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  } catch (e) {
    servidor.close();
    return null; // sem Chromium neste ambiente: o teste é pulado
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // As chamadas da página passam pelo Worker de verdade (cloudflare/app.js). Atenção: o Playwright responde sozinho à
  // pergunta prévia de CORS (OPTIONS), então o CORS em si é protegido pelo teste CF-CORS (tests/unit/cloudflare-host.test.js).
  const { handleRequest } = require('../../cloudflare/app');
  const env = { NEXIA_APP_URL: 'https://nexia.gcbezerra.workers.dev' };
  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname !== API_HOST) return route.abort();
    const headers = {};
    for (const [k, v] of Object.entries(await req.allHeaders())) headers[k] = v;
    headers['cf-connecting-ip'] = `10.8.${(n >> 8) & 255}.${n++ & 255}`;
    const r = await handleRequest(new Request(req.url(), { method: req.method(), headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method()) ? undefined : (req.postData() || undefined) }), env, { getFunction: nome => (nome === 'locacao' ? { handler } : null) });
    const saida = {};
    r.headers.forEach((v, k) => { saida[k] = v; });
    return route.fulfill({ status: r.status, headers: saida, body: Buffer.from(await r.arrayBuffer()) });
  });
  const fechar = async () => { try { await browser.close(); } finally { servidor.closeAllConnections(); servidor.close(); } };
  return { chamar, ctx, base, fechar };
}

const pulaSemNavegador = !chromium || !(process.env.PLAYWRIGHT_CHROMIUM_PATH || fs.existsSync('/opt/pw-browsers/chromium'));

test('SPLASH-NAV1. site público: pedir um dia com decoração mostra Pix, valor do sinal e botão de comprovante no WhatsApp', { skip: pulaSemNavegador, timeout: 90000 }, async () => {
  const a = await ambiente();
  if (!a) return;
  try {
    const t = (await a.chamar('POST', { acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' })).json.token;
    const cfg = await a.chamar('POST', { acao: 'config', token: t, config: {
      pix: { chave: 'pix-teste@exemplo.com', titular: 'Amanda Teste', mostrar: true },
      sinal: { tipo: 'valor', valor: 100 },
      extras: [{ nome: 'Decoração', valor: 250, ativo: true }],
      promocoes: [{ texto: 'Dia livre com promoção de teste', ativa: true }],
      unidades: [{ id: 'santa-adelia', nome: 'Splash Santa Adélia', endereco: 'Rua de Teste, 10 - São Mateus', valor_diaria: 900 }, { id: 'santa-barbara', nome: 'Splash Santa Bárbara' }],
    } });
    assert.equal(cfg.status, 200, JSON.stringify(cfg.json));

    const page = await a.ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(String(e)));
    await page.goto(a.base + '/index.html');
    await page.click('#card-santa-adelia');
    await page.waitForSelector('#cal-dias-grid .cal-day.livre:not([disabled])');
    assert.match(await page.textContent('#promocoes-lista'), /promoção de teste/);
    assert.match(await page.textContent('#preco-santa-adelia'), /900,00/);
    assert.match(await page.textContent('#endereco-santa-adelia'), /Rua de Teste/);
    assert.ok(!/Casamento|Formatura|alto padrão|Unsplash|camarim/i.test(await page.content()), 'sem texto de salão de festas inventado');

    await page.locator('#cal-dias-grid .cal-day.livre:not([disabled])').last().click();
    await page.fill('#req-nome', 'Cliente de Teste');
    await page.fill('#req-whatsapp', '11988887777');
    await page.selectOption('#req-tipo-evento', 'Aniversário');
    await page.fill('#req-convidados', '30');
    assert.match(await page.textContent('#extras-lista'), /250,00/);
    await page.check('#extras-lista input[name=extra]');
    await page.check('#req-consentimento');
    await page.click('#btn-enviar-pedido');

    await page.waitForSelector('#card-sucesso', { state: 'visible' });
    assert.match(await page.textContent('#protocolo-reserva'), /^SPL-/);
    assert.equal((await page.textContent('#pix-chave')).trim(), 'pix-teste@exemplo.com');
    assert.match(await page.textContent('#pix-valor'), /100,00/);
    assert.match(await page.textContent('#sucesso-resumo'), /Decoração/);
    const href = await page.getAttribute('#btn-wa-me', 'href');
    assert.match(href, /wa\.me\/5511941247074/);
    assert.match(decodeURIComponent(href), /comprovante/);
    assert.deepEqual(erros, [], 'sem erros de JavaScript na página: ' + erros.join(' | '));

    const lista = await a.chamar('POST', { acao: 'listar', token: t, de: dia(0), ate: dia(60) });
    const r = lista.json.itens[0];
    assert.equal(r.nome, 'Cliente de Teste');
    assert.deepEqual(r.extras.map(e => e.nome), ['Decoração']);
    assert.equal(r.valor_total, 1150);
    assert.equal((await a.chamar('GET', null, { site: 'splash' })).json.pix.chave, 'pix-teste@exemplo.com', 'a dona deixou mostrar: o Pix aparece já na reserva');
  } finally { await a.fechar(); }
});

test('SPLASH-NAV2. painel da Amanda: primeiro acesso, pedido pendente, sinal pago, valores, bloqueio, lançamento e configurações', { skip: pulaSemNavegador, timeout: 120000 }, async () => {
  const a = await ambiente();
  if (!a) return;
  try {
    const d1 = dia(5), d2 = dia(9), d3 = dia(12);
    const pedido = await a.chamar('POST', { acao: 'pedir', unidade: 'santa-adelia', data: d1, nome: 'Cliente Pendente', whatsapp: '11977776666', tipo_evento: 'Aniversário', convidados: 20, consentimento: true });
    assert.equal(pedido.status, 201, JSON.stringify(pedido.json));

    const page = await a.ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.goto(a.base + '/agenda/index.html');
    await page.click('text=Primeiro acesso');
    await page.fill('#input-codigo-ativacao', 'CODIGO123');
    await page.fill('#input-senha-nova', 'senhaValida123');
    await page.click('#card-primeiro-acesso button[type=submit]');
    await page.waitForSelector('#area-logada:not(.oculto)');

    // pedido pendente aparece e vira confirmado ao marcar "sinal pago"
    await page.evaluate(() => navegarAba('pedidos'));
    await page.waitForSelector('#lista-pedidos-pendentes .reserva-item');
    assert.match(await page.textContent('#lista-pedidos-pendentes'), /Cliente Pendente/);
    await page.click('#lista-pedidos-pendentes .reserva-item');
    await page.fill('#md-valor-total', '1200');
    await page.fill('#md-valor-sinal', '300');
    await page.click('text=Salvar valores');
    await page.waitForTimeout(400);
    await page.evaluate(() => navegarAba('pedidos'));
    await page.click('#lista-pedidos-pendentes .reserva-item');
    await page.click('#md-acoes >> text=Aceitar e enviar o Pix');
    await page.waitForTimeout(500);
    await page.evaluate(() => navegarAba('pedidos'));
    await page.click('#lista-pedidos-pendentes .reserva-item');
    const zap = await page.getAttribute('#md-acoes a:has-text("Reenviar o Pix")', 'href');
    assert.match(decodeURIComponent(zap), /300,00/, 'a mensagem do WhatsApp traz o valor do sinal');
    await page.click('#md-acoes >> text=Recebi o sinal');
    await page.waitForTimeout(500);
    const l1 = (await a.chamar('POST', { acao: 'listar', token: await tokenDe(a), de: dia(0), ate: dia(60) })).json;
    assert.equal(l1.itens.find(x => x.data === d1).status, 'confirmado');
    assert.equal(l1.itens.find(x => x.data === d1).valor_total, 1200);

    // configurações: Pix, extras e promoção
    await page.evaluate(() => navegarAba('config'));
    await page.click('#aj-hub >> text=Pix e sinal');
    await page.fill('#cfg-pix-chave', 'chave-da-amanda@exemplo.com');
    await page.fill('#cfg-pix-titular', 'Amanda');
    await page.evaluate(() => { ajustesIr('un', 'santa-adelia'); ajustesSub('extras'); });
    await page.click('text=Adicionar extra');
    await page.evaluate(() => ajustesSub('promos'));
    await page.click('text=Adicionar promoção');
    await page.click('#aj-salvar >> text=Salvar');
    await page.waitForTimeout(500);
    await page.evaluate(() => ajustesSub('fotos'));
    await page.waitForSelector('#aj-midia-fotos .m-envio');
    await page.waitForSelector('#aj-midia-fotos >> text=Fotos que já estão no site');
    await page.click('#aj-midia-fotos >> text=Tirar do site >> nth=0');
    await page.waitForSelector('#aj-midia-fotos >> text=Voltar ao site');
    await page.evaluate(() => ajustesSub('videos'));
    await page.waitForSelector('#aj-midia-videos .m-envio');
    await page.evaluate(() => ajustesIr('aval'));
    await page.waitForSelector('#aj-aval-clientes .suave, #aj-aval-clientes .cfg-bloco');
    const l2 = (await a.chamar('POST', { acao: 'listar', token: await tokenDe(a), de: dia(0), ate: dia(1) })).json;
    assert.equal(l2.config.pix.chave, 'chave-da-amanda@exemplo.com');
    assert.ok(l2.config.extras.length >= 2 && l2.config.promocoes.length === 1);

    // lançamento manual e bloqueio
    await page.evaluate(([x, y]) => { navegarAba('nova'); abrirNovoNoDia(x); }, [d2, d3]);
    await page.evaluate(() => alternarModoLancamento('reserva'));
    await page.fill('#lanc-res-data', d2);
    await page.fill('#lanc-res-nome', 'Reserva da Amanda');
    await page.fill('#lanc-res-zap', '11955554444');
    await page.click('#form-lanc-reserva button[type=submit]');
    await page.waitForTimeout(500);
    await page.evaluate(() => { navegarAba('nova'); alternarModoLancamento('bloqueio'); });
    await page.fill('#lanc-bloq-de', d3);
    await page.fill('#lanc-bloq-ate', d3);
    await page.fill('#lanc-bloq-motivo', 'Manutenção da piscina');
    await page.click('#form-lanc-bloqueio button[type=submit]');
    await page.waitForTimeout(500);
    const l3 = (await a.chamar('POST', { acao: 'listar', token: await tokenDe(a), de: dia(0), ate: dia(60) })).json;
    assert.equal(l3.itens.find(x => x.data === d2).nome, 'Reserva da Amanda');
    assert.equal(l3.itens.find(x => x.data === d3).status, 'bloqueado');
    assert.deepEqual(erros, [], 'sem erros de JavaScript no painel: ' + erros.join(' | '));
  } finally { await a.fechar(); }
});

// entra de novo pela API (a senha já foi criada pelo navegador)
async function tokenDe(a) {
  const r = await a.chamar('POST', { acao: 'entrar', senha: 'senhaValida123' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token;
}

test('SPLASH-NAV3. o que a Amanda muda no painel aparece sozinho no site (textos, seção escondida, contatos, preços, endereço, extras, promoções, parceiros)', { skip: pulaSemNavegador, timeout: 60000 }, async () => {
  const a = await ambiente();
  if (!a) return;
  try {
    const login = await a.chamar('POST', { acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' });
    assert.equal(login.status, 200, JSON.stringify(login.json));
    const token = login.json.token;
    const unidades = [
      { id: 'santa-adelia', nome: 'Splash Santa Adélia', endereco: 'Rua das Flores, 123 - São Mateus', valor_semana: 450, valor_fds: 650 },
      { id: 'santa-barbara', nome: 'Splash Santa Bárbara', endereco: 'Rua B, 9', terceiro: true },
    ];
    const cfg = await a.chamar('POST', { acao: 'config', token, config: {
      whatsapp: '11912345678', instagram: 'splash_novo', unidades,
      extras: [{ id: 'pula', nome: 'Pula-pula gigante', descricao: '', valor: 150, ativo: true, unidade: 'todas' }],
      promocoes: [{ texto: 'Promoção de primavera 20%', unidade: 'todas' }],
      patrocinadores: [{ nome: 'Doceria Mel', nivel: 'ouro' }],
    } });
    assert.equal(cfg.status, 200, JSON.stringify(cfg.json));
    const ct = await a.chamar('POST', { acao: 'site-salvar', token, conteudo: { textos: { 'hero-subtitulo': 'Texto novo escrito pela Amanda' }, ocultos: { 'secao-avaliacoes': true } } });
    assert.equal(ct.status, 200, JSON.stringify(ct.json));

    const page = await a.ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(String(e)));
    await page.goto(a.base + '/');
    await page.waitForFunction(() => /Amanda/.test(document.querySelector('[data-ed="hero-subtitulo"]').textContent), null, { timeout: 15000 });
    const v = await page.evaluate(() => ({
      insta: document.getElementById('cta-instagram-texto').textContent,
      zap: document.getElementById('rodape-whatsapp').getAttribute('href'),
      preco: document.getElementById('preco-santa-adelia').textContent,
      end: document.getElementById('endereco-santa-adelia').textContent,
      extras: document.getElementById('extras-lista').textContent,
      promo: document.getElementById('promocoes-lista').textContent,
      parc: document.getElementById('parc-lista').textContent,
      avalOculta: (() => { const s = document.querySelector('[data-secao="avaliacoes"]'); return !s || s.classList.contains('nx-oculto') || s.classList.contains('nx-escondido') || getComputedStyle(s).display === 'none'; })(),
    }));
    assert.equal(v.insta, '@splash_novo');
    assert.match(v.zap, /5511912345678|11912345678/);
    assert.match(v.preco, /450/);
    assert.match(v.preco, /650/);
    assert.equal(v.end, 'Rua das Flores, 123 - São Mateus');
    assert.match(v.extras, /Pula-pula gigante/);
    assert.match(v.promo, /Promoção de primavera 20%/);
    assert.match(v.parc, /Doceria Mel/);
    assert.ok(v.avalOculta, 'seção escondida no painel some do site');
    assert.deepEqual(erros, []);
  } finally { await a.fechar(); }
});
