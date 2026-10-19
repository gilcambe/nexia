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

/** HTML -> imagem pelo Chromium. `formato: 'jpeg'` para a Meta (o Instagram só aceita JPEG por URL); padrão PNG, como sempre. */
async function renderizar(pecas, saida, { formato = 'png' } = {}) {
  let chromium;
  try { ({ chromium } = require('@playwright/test')); } catch { return false; }
  let navegador;
  try { navegador = await chromium.launch(process.env.DIVULGA_CHROMIUM ? { executablePath: process.env.DIVULGA_CHROMIUM } : {}); } catch (e) { console.warn(`Chromium indisponível: ${e.message}`); return false; }
  try {
    for (const [nome, html] of Object.entries(pecas)) {
      const [w, h] = nome === 'story' ? [1080, 1920] : [1080, 1350];
      const pg = await navegador.newPage({ viewport: { width: w, height: h } });
      await pg.setContent(html, { waitUntil: 'load' });
      await pg.screenshot(formato === 'jpeg' ? { path: path.join(saida, `${nome}.jpg`), type: 'jpeg', quality: 88 } : { path: path.join(saida, `${nome}.png`) });
      await pg.close();
    }
  } finally { await navegador.close(); }
  return true;
}

// Fonte do texto animado (vem no ubuntu-latest; sem o arquivo, o reel sai sem texto).
const FONTE_REEL = process.env.DIVULGA_FONTE || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const TRILHA = d => `aevalsrc=0.12*sin(2*PI*220*t)+0.08*sin(2*PI*277.18*t)+0.08*sin(2*PI*329.63*t):s=44100:d=${d},afade=t=in:d=${Math.min(2, d / 4)},afade=t=out:st=${Math.max(0, d - 2)}:d=2[a]`;
const SAIDA_VIDEO = ['-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'];
const XFADE = 0.3;

/**
 * Escapa um texto para o `text=` do drawtext dentro de -filter_complex (3 níveis: drawtext, opção e grafo).
 * Trata `\` e `%` (expansão do drawtext), `'` e `:` (opções) e `,` `;` `[` `]` (grafo).
 */
function escFfmpeg(s) {
  const n3 = String(s == null ? '' : s).replace(/[\\%]/g, '\\$&');
  const n2 = n3.replace(/[\\':]/g, '\\$&');
  return n2.replace(/[\\',;[\]]/g, '\\$&');
}
/** Vírgulas de expressões (clip, between) também precisam de escape no grafo. */
const escExpr = e => e.replace(/,/g, '\\,');

/** Quebra o texto em linhas curtas (o drawtext não quebra sozinho), sem emoji (a fonte não tem). */
function quebrar(texto, largura = 26, maxLinhas = 4) {
  const palavras = String(texto || '').replace(/\p{Extended_Pictographic}|️/gu, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const linhas = [];
  for (const p of palavras) {
    const ult = linhas[linhas.length - 1];
    if (ult != null && `${ult} ${p}`.length <= largura) linhas[linhas.length - 1] = `${ult} ${p}`;
    else linhas.push(p);
  }
  if (linhas.length > maxLinhas) { linhas.length = maxLinhas; linhas[maxLinhas - 1] = `${linhas[maxLinhas - 1].replace(/[.,;:!?…]*$/, '')}…`; }
  return linhas.join('\n');
}

/** Telas do reel com roteiro: capa 2 s + até 4 telas de 2,5 s + CTA 2 s; total entre 7 e 15 s já contando as transições. */
function planoReel(roteiro = {}, n) {
  const meio = (roteiro.telas || []).slice(0, Math.min(4, Math.max(0, n - 2)));
  const itens = [{ i: 0, d: 2, texto: roteiro.gancho }, ...meio.map((t, k) => ({ i: k + 1, d: 2.5, texto: t.titulo })), { i: n - 1, d: 2, texto: roteiro.cta }];
  const soma = () => itens.reduce((s, x) => s + x.d, 0) - XFADE * (itens.length - 1);
  if (soma() < 7) {
    const meios = itens.length > 2 ? itens.slice(1, -1) : itens;
    const extra = (7 - soma()) / meios.length;
    meios.forEach(x => { x.d += extra; });
  }
  let t = 0;
  itens.forEach((x, k) => { x.ini = k ? t - XFADE : 0; t = x.ini + x.d; x.fim = t; });
  return { itens, total: Number(soma().toFixed(2)) };
}

/**
 * Linha de comando do ffmpeg para o reel (função pura, testável sem ffmpeg).
 * Sem roteiro: igual ao reel de sempre (5 telas de 4 s com concat, ~20 s). Com roteiro: xfade, texto animado e barra de progresso.
 */
function argsReel(saida, { roteiro, telas, fonte = FONTE_REEL, temFonte = f => fs.existsSync(f) } = {}) {
  if (!roteiro) {
    const lista = telas || [1, 2, 3, 4, 5].map(n => path.join(saida, `carrossel-${n}.png`));
    const entradas = lista.flatMap(t => ['-loop', '1', '-t', '4', '-i', t]);
    const filtros = lista.map((_, i) => `[${i}:v]scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30[v${i}]`).join(';');
    const juntar = `${lista.map((_, i) => `[v${i}]`).join('')}concat=n=${lista.length}:v=1:a=0[v]`;
    return ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', `${filtros};${juntar};${TRILHA(20)}`, ...SAIDA_VIDEO, path.join(saida, 'reel.mp4')];
  }
  const { itens, total } = planoReel(roteiro, telas.length);
  const entradas = itens.flatMap(x => ['-loop', '1', '-t', (x.d + 0.05).toFixed(2), '-i', telas[x.i]]);
  const f = itens.map((x, k) => `[${k}:v]scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,settb=AVTB[v${k}]`);
  let atual = '[v0]';
  itens.slice(1).forEach((x, k) => {
    const prox = `[x${k + 1}]`;
    f.push(`${atual}[v${k + 1}]xfade=transition=fade:duration=${XFADE}:offset=${x.ini.toFixed(2)}${prox}`);
    atual = prox;
  });
  const textos = [];
  if (temFonte(fonte)) {
    for (const x of itens) {
      const t = quebrar(x.texto);
      if (!t) continue;
      // Na capa o gancho entra já no começo e fica inteiro antes de 0,5 s (fade-in de 0,4 s).
      const ini = (x.ini + (x.i === 0 ? 0.05 : 0.15)).toFixed(2);
      textos.push(`drawtext=fontfile=${escFfmpeg(fonte)}:text=${escFfmpeg(t)}:fontsize=54:fontcolor=white:line_spacing=10`
        + ':box=1:boxcolor=black@0.55:boxborderw=22:x=(w-text_w)/2:y=h-285+(285-text_h)/2'
        + `:alpha=${escExpr(`'clip((t-${ini})/0.4,0,1)'`)}:enable=${escExpr(`'between(t,${ini},${x.fim.toFixed(2)})'`)}`);
    }
  }
  f.push(`${atual}${textos.map(t => `${t},`).join('')}format=yuv420p[vt]`);
  // Barra de progresso fina no topo: uma faixa branca que cresce da esquerda conforme o tempo passa.
  f.push(`color=c=white:s=1080x10:r=30:d=${total}[barra]`);
  f.push(`[vt][barra]overlay=x=${escExpr(`'-w+w*t/${total}'`)}:y=0:shortest=1,trim=duration=${total}[v]`);
  return ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', `${f.join(';')};${TRILHA(total)}`, ...SAIDA_VIDEO, path.join(saida, 'reel.mp4')];
}

/** Capa do Reels (cover_url): o quadro de 1 s, com o gancho já inteiro na tela. */
const argsCapa = saida => ['-y', '-loglevel', 'error', '-ss', '1', '-i', path.join(saida, 'reel.mp4'), '-frames:v', '1', '-q:v', '3', path.join(saida, 'capa.jpg')];

function ffmpeg(args, rodar = spawnSync) {
  const r = rodar('ffmpeg', args, { encoding: 'utf8' });
  if (!r || r.status !== 0) { console.warn(`ffmpeg falhou: ${((r && (r.stderr || r.error)) || '').toString().slice(0, 300)}`); return false; }
  return true;
}

/**
 * Reel 1080x1920. Sem roteiro: ~20 s, cada tela do carrossel por 4 s (o de sempre).
 * Com roteiro (lib/roteiro.js): 7 a 15 s com texto animado por tela, transições, barra de progresso e capa.jpg.
 * `telas`: arquivos das telas (capa, meio..., cta). Padrão: carrossel-1..N.png da pasta. `rodar` troca o ffmpeg nos testes.
 */
function reel(saida, { roteiro, telas, rodar = spawnSync } = {}) {
  const n = roteiro ? (roteiro.telas || []).length + 2 : 5;
  const lista = telas || Array.from({ length: n }, (_, i) => path.join(saida, `carrossel-${i + 1}.png`));
  if (lista.length < (roteiro ? 2 : 5) || !lista.every(f => fs.existsSync(f))) return false;
  if (!ffmpeg(argsReel(saida, { roteiro, telas: lista }), rodar)) return false;
  if (roteiro) ffmpeg(argsCapa(saida), rodar);
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

module.exports = { gerar, montarPecas, reel, renderizar, carregarCliente, argsReel, argsCapa, escFfmpeg, planoReel, quebrar, FONTE_REEL };

if (require.main === module) {
  gerar(process.argv[2] || 'divulga-ensaio', process.argv[3] || 'body-coach')
    .then(r => { console.log(JSON.stringify(r)); if (!r.png) process.exitCode = 1; })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
