'use strict';
// Gera os arquivos do Divulga: carrossel (5 PNG), story (PNG), antes/depois (PNG) e um reel vertical (MP4).
// Uso: node divulga/gerar.js <pasta-de-saida> [cliente]
// PNG pelo Chromium do Playwright; reel com ffmpeg a partir das telas, legenda queimada e trilha gerada pelo próprio
// ffmpeg (sem direitos autorais). Sem Chromium ou ffmpeg, só grava os .html e avisa.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { carrossel, story, antesDepois } = require('./lib/visual');
const { temaDoDia } = require('./lib/calendario');

const RAIZ = __dirname;
const dataUri = f => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;

function carregarCliente(id) {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'clientes', `${id}.json`), 'utf8'));
}

function montarPecas(cliente, hoje = new Date()) {
  // prints reais do app só entram se o cliente listar `prints` (arquivos em divulga/prints); senão valem as telas desenhadas pelo visual
  const prints = (cliente.prints || []).slice(0, 4).map(i => dataUri(path.join(RAIZ, 'prints', i))).filter(Boolean);
  const telas = carrossel(cliente, { prints });
  return {
    'carrossel-1': telas[0], 'carrossel-2': telas[1], 'carrossel-3': telas[2], 'carrossel-4': telas[3], 'carrossel-5': telas[4],
    story: story(cliente, { pergunta: `Qual é o seu treino de hoje, ${temaDoDia(hoje).dia}?`, hoje }),
    'antes-depois': antesDepois(cliente, { antes: prints[2], depois: prints[3], rotuloAntes: 'DIETA', rotuloDepois: 'EVOLUÇÃO' }),
  };
}

async function renderizar(pecas, saida) {
  let chromium;
  try { ({ chromium } = require('@playwright/test')); } catch { return false; }
  let navegador;
  try { navegador = await chromium.launch(process.env.DIVULGA_CHROMIUM ? { executablePath: process.env.DIVULGA_CHROMIUM } : {}); } catch (e) { console.warn(`Chromium indisponível: ${e.message}`); return false; }
  try {
    for (const [nome, html] of Object.entries(pecas)) {
      const [w, h] = nome === 'story' ? [1080, 1920] : [1080, 1350];
      const pg = await navegador.newPage({ viewport: { width: w, height: h } });
      await pg.setContent(html, { waitUntil: 'load' });
      await pg.screenshot({ path: path.join(saida, `${nome}.png`) });
      await pg.close();
    }
  } finally { await navegador.close(); }
  return true;
}

/** Reel 1080x1920, ~20 s: cada tela do carrossel por 4 s com zoom lento, sobre fundo preto, com trilha gerada. */
function reel(saida) {
  const telas = [1, 2, 3, 4, 5].map(n => path.join(saida, `carrossel-${n}.png`));
  if (!telas.every(fs.existsSync)) return false;
  const entradas = telas.flatMap(t => ['-loop', '1', '-t', '4', '-i', t]);
  const filtros = telas.map((_, i) => `[${i}:v]scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30[v${i}]`).join(';');
  const juntar = `${telas.map((_, i) => `[v${i}]`).join('')}concat=n=5:v=1:a=0[v]`;
  const trilha = 'aevalsrc=0.12*sin(2*PI*220*t)+0.08*sin(2*PI*277.18*t)+0.08*sin(2*PI*329.63*t):s=44100:d=20,afade=t=in:d=2,afade=t=out:st=18:d=2[a]';
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', `${filtros};${juntar};${trilha}`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(saida, 'reel.mp4')], { encoding: 'utf8' });
  if (r.status !== 0) { console.warn(`ffmpeg falhou: ${(r.stderr || r.error || '').toString().slice(0, 300)}`); return false; }
  return true;
}

async function gerar(saida, clienteId = 'body-coach', hoje = new Date()) {
  fs.mkdirSync(saida, { recursive: true });
  const pecas = montarPecas(carregarCliente(clienteId), hoje);
  for (const [n, html] of Object.entries(pecas)) fs.writeFileSync(path.join(saida, `${n}.html`), html);
  const png = await renderizar(pecas, saida);
  const mp4 = png && reel(saida);
  return { pecas: Object.keys(pecas), png, mp4 };
}

module.exports = { gerar, montarPecas, reel };

if (require.main === module) {
  gerar(process.argv[2] || 'divulga-ensaio', process.argv[3] || 'body-coach')
    .then(r => { console.log(JSON.stringify(r)); if (!r.png) process.exitCode = 1; })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
