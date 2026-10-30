#!/usr/bin/env node
'use strict';
// NEXIA: teste Playwright E2E do PWA Viajante Pro (celular 360px).
// Abre o link com ?t=TOKEN, vê voos e roteiro, desliga a rede (setOffline), recarrega e vê tudo salvo offline.
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

const DADOS_VIAGEM_MOCK = {
  ok: true,
  viagem: {
    token: 'TOKEN_TESTE_VP',
    passageiro: 'Ana Silva',
    destino: 'Paris',
    data_inicio: '15/11/2026',
    data_fim: '22/11/2026',
    status_viagem: 'durante',
    hoje: {
      dia_numero: 2,
      data: '16/11/2026',
      eventos: [
        { hora: '09:00', tipo: 'passeio', titulo: 'Visita ao Museu do Louvre', endereco: 'Rue de Rivoli, 75001 Paris' },
        { hora: '15:00', tipo: 'hotel', titulo: 'Check-in no Le Meurice Paris', endereco: '228 Rue de Rivoli, 75001 Paris' }
      ]
    },
    voos: [
      {
        cia: 'Air France',
        numero: 'VPX982',
        data: '15/11/2026',
        status: 'Confirmado',
        origem: 'GRU (São Paulo)',
        horario_partida: '22:45',
        destino: 'CDG (Paris)',
        horario_chegada: '14:30',
        terminal: '2E',
        portao: 'K43',
        assento: '14A',
        bagagem_mao: '1 volume (12kg)',
        bagagem_despachada: '2 malas (23kg cada)',
        aviso_checkin: 'Check-in abre 24h antes do voo',
        localizador: 'VPX982',
        link_checkin: 'https://www.airfrance.com.br/check-in'
      }
    ],
    roteiro: [
      {
        dia: 1,
        data: '15/11/2026',
        titulo: 'Embarque em São Paulo',
        descricao: 'Voo noturno rumo a Paris.'
      },
      {
        dia: 2,
        data: '16/11/2026',
        titulo: 'Museu do Louvre e Chegada em Paris',
        descricao: 'Visita ao famoso Museu do Louvre no coração de Paris.',
        endereco: 'Rue de Rivoli, 75001 Paris'
      }
    ],
    hotel_carro: {
      hotel: {
        nome: 'Le Meurice Paris',
        voucher: 'LMP-99482',
        endereco: '228 Rue de Rivoli, 75001 Paris',
        telefone: '+33 1 44 58 10 10',
        checkin: '15:00',
        checkout: '12:00'
      },
      carro: {
        empresa: 'Hertz',
        voucher: 'HTZ-3321',
        modelo: 'Peugeot 208 ou similar',
        retirada: 'Aeroporto CDG',
        devolucao: 'Aeroporto CDG',
        telefone: '+33 1 70 96 80 00'
      }
    },
    documentos: [
      { tipo: 'voucher', titulo: 'Voucher Hotel Le Meurice', codigo: 'LMP-99482' },
      { tipo: 'seguro', titulo: 'Apólice Seguro Viagem', codigo: 'SEG-883192' }
    ],
    motorista: {
      hotel_nome: 'Le Meurice Paris',
      hotel_endereco: '228 Rue de Rivoli, 75001 Paris',
      instrucoes_idioma_local: 'S\'il vous plaît, emmenez-moi à l\'hôtel Le Meurice au 228 Rue de Rivoli.'
    },
    emergencia: {
      atendimento_vp_24h: '+55 11 99999-8888',
      emergencia_pais: '112',
      consulado_brasil: '+33 1 45 61 63 00',
      seguro_viagem: '+55 11 4004-9000'
    }
  }
};

const servidor = http.createServer((req, res) => {
  const urlObj = new URL(req.url, 'http://127.0.0.1');
  let p = decodeURIComponent(urlObj.pathname);

  if (p === '/api/viagem') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(DADOS_VIAGEM_MOCK));
  }

  if (p === '/' || p === '/app/' || p === '/viajante-pro/app/' || p.endsWith('/')) {
    p += 'index.html';
  }
  p = p.replace(/^\/(viajante-pro\/app\/|app\/)?/, '');
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
  const base = `http://127.0.0.1:${servidor.address().port}`;
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
  let nFoto = 0;
  const tirarFoto = async (nome) => {
    if (FOTOS) {
      await page.screenshot({ path: path.join(FOTOS, String(++nFoto).padStart(2, '0') + '-' + nome + '.png') });
    }
  };

  console.log('1. Abrindo app com token via link público');
  await page.goto(base + '/viajante-pro/app/?t=TOKEN_TESTE_VP', { waitUntil: 'load' });
  await page.waitForSelector('#app-conteudo');
  await page.waitForTimeout(500);
  confere(await page.isVisible('#carimbo-atualizacao'), 'Carimbo de atualização visível');
  await tirarFoto('01-hoje');

  // Aguardar ativação do Service Worker antes do teste offline
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }
  });

  // Verificar sem rolagem horizontal
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  confere(scrollWidth <= 360, `Layout mobile perfeito sem rolagem de lado (${scrollWidth}px <= 360px)`);

  console.log('2. Navegando para a aba Voos');
  await page.click('#tab-voos');
  await page.waitForTimeout(300);
  const textoVoos = await page.textContent('#app-conteudo');
  confere(textoVoos.includes('Air France') && textoVoos.includes('Fazer Check-in'), 'Detalhes do voo e botão check-in visíveis');
  await tirarFoto('02-voos');

  console.log('3. Navegando para Roteiro');
  await page.click('#tab-roteiro');
  await page.waitForTimeout(300);
  const textoRoteiro = await page.textContent('#app-conteudo');
  confere(textoRoteiro.includes('Louvre') && textoRoteiro.includes('Abrir no Mapa'), 'Roteiro com botão de mapa visível');
  await tirarFoto('03-roteiro');

  console.log('4. Navegando para Mostre ao Motorista');
  await page.click('#tab-motorista');
  await page.waitForTimeout(300);
  const textoMotorista = await page.textContent('#app-conteudo');
  confere(textoMotorista.includes('Le Meurice Paris') && textoMotorista.includes('228 Rue de Rivoli'), 'Cartão para motorista com letras grandes visível');
  await tirarFoto('04-motorista');

  console.log('5. Navegando para Emergência');
  await page.click('#tab-emergencia');
  await page.waitForTimeout(300);
  const textoEmergencia = await page.textContent('#app-conteudo');
  confere(textoEmergencia.includes('Consulado do Brasil') && textoEmergencia.includes('Viajante Pro'), 'Contatos de emergência visíveis');
  await tirarFoto('05-emergencia');

  console.log('6. Simulando modo Offline');
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app-conteudo');
  await page.waitForTimeout(500);

  const carimboTexto = await page.textContent('#carimbo-atualizacao');
  confere(carimboTexto.includes('Atualizado às') || carimboTexto.includes('atualizado às'), 'Mostra aviso de horário atualizado mesmo offline');

  await page.click('#tab-voos');
  await page.waitForTimeout(300);
  const textoVoosOffline = await page.textContent('#app-conteudo');
  confere(textoVoosOffline.includes('Air France') && textoVoosOffline.includes('VPX982'), 'Voos continuam visíveis offline a partir do IndexedDB');
  await tirarFoto('06-offline-voos');

  await page.click('#tab-motorista');
  await page.waitForTimeout(300);
  const textoMotoristaOffline = await page.textContent('#app-conteudo');
  confere(textoMotoristaOffline.includes('Le Meurice Paris'), 'Cartão do motorista disponível offline');

  await browser.close();
  servidor.close();

  console.log(falhas.length ? `\n${falhas.length} falha(s):\n - ${falhas.join('\n - ')}` : `\nApp Viajante Pro E2E: ${nOk} verificações bem-sucedidas.`);
  process.exit(falhas.length ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
