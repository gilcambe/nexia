#!/usr/bin/env node
'use strict';
// NEXIA: teste Playwright E2E do PWA Viajante Pro (celular 360px).
// Abre o link com ?t=TOKEN, ve voos e roteiro, desliga a rede (setOffline), recarrega e ve tudo salvo offline.
// Uso: node tests/e2e/viajante-app-humano.js [pasta-para-fotos]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '../../viajante-pro/app');
const FOTOS = process.argv[2] || '';
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png'
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (p === '/' || p === '/app/' || p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/(app\/)?/, '');
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404);
    return res.end('404 Not Found');
  }
  const ext = path.extname(arq).toLowerCase();
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});

const falhas = [];
let nOk = 0;
function confere(cond, msg) {
  if (cond) {
    nOk++;
    console.log('  ✓ ' + msg);
  } else {
    falhas.push(msg);
    console.log('  ✗ ' + msg);
  }
}

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + servidor.address().port;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });

  const page = await ctx.newPage();

  // Dados da viagem de teste mockada (definida dentro do proprio teste)
  const TOKEN_TESTE_VP = 'TOKEN_TESTE_VP';
  const viagemTeste = {
    id: 'viagem-teste-1',
    origem: 'Paris',
    destino: 'Lisboa',
    voos: [{ companhia: 'Air France', numero: 'AF1234' }],
    roteiro: [{ local: 'Louvre', acao: 'Visitar museu' }],
    motorista: {
      nome: 'Le Meurice Paris',
      endereco: '228 Rue de Rivoli, Paris'
    },
    emergencia: {
      consulado: 'Consulado do Brasil',
      telefone: '+33 1 42 86 82 00'
    }
  };
  const TOKEN_ERRADO = 'TOKEN_ERRADO_INVALIDO';

  // Interceptar todas as chamadas à API de viagens
  // Com o token TOKEN_TESTE_VP responde a viagem de teste definida dentro do teste
  // Qualquer outro token responde 404 com 'Link invalido'
  await page.route('**/api/viagem*', async route => {
    const url = route.request().url();
    const token = url.includes('?') ? new URLSearchParams(new URL(url).search).get('t') : null;

    if (token === 'TOKEN_TESTE_VP') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(viagemTeste)
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Token invalido'
      });
    }
  });

  let nFoto = 0;
  const tirarFoto = async (nome) => {
    if (FOTOS) {
      await page.screenshot({ path: path.join(FOTOS, String(++nFoto).padStart(2, '0') + '-' + nome + '.png') });
    }
  };

  console.log('1. Abrindo app com token valido');
  await page.goto(base + '/?t=TOKEN_TESTE_VP', { waitUntil: 'load' });
  await page.waitForSelector('#app-conteudo');
  await page.waitForTimeout(500);
  confere(await page.isVisible('#carimbo-atualizacao'), 'Carimbo de atualizacao visivel');
  confere(await page.textContent('#app-conteudo').includes(viagemTeste.voos[0].cia), 'Viagem de teste carregada');
  await tirarFoto('01-hoje');

  // Verificar sem rolagem horizontal (layout responsivo 360px)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  confere(scrollWidth <= 360, 'Layout mobile sem rolagem lateral (' + scrollWidth + 'px <= 360px)');

  console.log('2. Navegando para a aba Voos');
  await page.click('#tab-voos');
  await page.waitForTimeout(300);
  const textoVoos = await page.textContent('#app-conteudo');
  confere(textoVoos.includes('Air France') && textoVoos.includes('Fazer Check-in'), 'Detalhes do voo e botao check-in visiveis');
  await tirarFoto('02-voos');

  console.log('3. Navegando para Roteiro');
  await page.click('#tab-roteiro');
  await page.waitForTimeout(300);
  const textoRoteiro = await page.textContent('#app-conteudo');
  confere(textoRoteiro.includes('Louvre') && textoRoteiro.includes('Abrir no Mapa'), 'Roteiro com boto de mapa visivel');
  await tirarFoto('03-roteiro');

  console.log('4. Navegando para Mostre ao Motorista');
  await page.click('#tab-motorista');
  await page.waitForTimeout(300);
  const textoMotorista = await page.textContent('#app-conteudo');
  confere(textoMotorista.includes('Le Meurice Paris') && textoMotorista.includes('228 Rue de Rivoli'), 'Cartao para motorista com letras grandes visivel');
  await tirarFoto('04-motorista');

  console.log('5. Navegando para Emergencia');
  await page.click('#tab-emergencia');
  await page.waitForTimeout(300);
  const textoEmergencia = await page.textContent('#app-conteudo');
  confere(textoEmergencia.includes('Consulado do Brasil') && textoEmergencia.includes('Viajante Pro'), 'Contatos de emergencia visiveis');
  await tirarFoto('05-emergencia');

  console.log('5.5. Testando token invalido');
  await page.goto(base + '/?t=' + TOKEN_ERRADO, { waitUntil: 'load' });
  await page.waitForSelector('#app-conteudo');
  await page.waitForTimeout(500);
  const textoTokenInvalido = await page.innerText('#app-conteudo');
  confere(textoTokenInvalido.includes('Link inválido'), 'Mensagem de link inválido aparece com token errado');
  await tirarFoto('05-token-invalido');

  console.log('6. Simulando modo Offline');
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app-conteudo');
  await page.waitForTimeout(500);

  const carimboTexto = await page.textContent('#carimbo-atualizacao');
  confere(carimboTexto.includes('Atualizado às'), 'Mostra aviso de horario atualizado mesmo offline');

  await page.click('#tab-voos');
  await page.waitForTimeout(300);
  const textoVoosOffline = await page.textContent('#app-conteudo');
  confere(textoVoosOffline.includes('Air France') && textoVoosOffline.includes('AF457'), 'Voos continuam visiveis offline a partir do IndexedDB');
  await tirarFoto('06-offline-voos');

  await page.click('#tab-motorista');
  await page.waitForTimeout(300);
  const textoMotoristaOffline = await page.textContent('#app-conteudo');
  confere(textoMotoristaOffline.includes('Le Meurice Paris'), 'Cartao do motorista disponivel offline');

  await browser.close();
  servidor.close();

  console.log(falhas.length ? '\n' + falhas.length + ' falha(s):\n - ' + falhas.join('\n - ') : '\nApp Viajante Pro E2E: ' + nOk + ' verificacoes bem-sucedidas.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
