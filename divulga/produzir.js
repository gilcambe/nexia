'use strict';
// Linha de produção do Divulga: roteiro (IA grátis ou modelo fixo) > telas com a cor do cliente > JPG > reel > post.json.
// Uso: node divulga/produzir.js <clienteId> <saida> [--reel|--sem-reel]
//      node divulga/produzir.js auto <base> --dados <pasta>   (cliente da vez do rodízio; grava em <base>/<data>/<cliente>)
// O robô (robo.js --producao <base>) publica o post.json de hoje do cliente da vez. Sem Chromium, não grava post.json
// e o robô segue o de sempre. Sem ffmpeg, sai sem vídeo (o reel da noite vira carrossel).
const fs = require('node:fs');
const path = require('node:path');
const { roteiro: roteiroIA } = require('./lib/roteiro');
const { carrosselRoteiro } = require('./lib/visual');
const gerar = require('./gerar');
const robo = require('./robo');

/**
 * Produz o post do cliente na pasta `saida`. Devolve o post.json gravado, ou null se não deu para gerar as imagens.
 * `renderizar`, `reel` e `roteiro` podem ser trocados nos testes (Chromium, ffmpeg e IA falsos).
 */
async function produzir(clienteId, saida, {
  env = process.env, fetchImpl = fetch, log = console.log, hoje = new Date(), comReel = true,
  cliente, renderizar = gerar.renderizar, reel = gerar.reel, roteiro = roteiroIA,
} = {}) {
  const c = cliente || gerar.carregarCliente(clienteId);
  fs.mkdirSync(saida, { recursive: true });
  const r = await roteiro(c, { env, fetchImpl, log, data: hoje });
  const telas = carrosselRoteiro(c, r);
  const pecas = Object.fromEntries(telas.map((html, i) => [`carrossel-${i + 1}`, html]));
  for (const [n, html] of Object.entries(pecas)) fs.writeFileSync(path.join(saida, `${n}.html`), html);
  if (!(await renderizar(pecas, saida, { formato: 'jpeg' }))) { log('Sem Chromium: nada produzido.'); return null; }
  const imagens = Object.keys(pecas).map(n => `${n}.jpg`);
  if (!imagens.every(f => fs.existsSync(path.join(saida, f)))) { log('Imagens não geradas: nada produzido.'); return null; }
  const video = comReel && reel(saida, { roteiro: r, telas: imagens.map(f => path.join(saida, f)) }) && fs.existsSync(path.join(saida, 'reel.mp4'));
  const post = {
    cliente: c.id,
    data: robo.dataBrasilia(hoje),
    serie: r.serie,
    fonte: r.fonte,
    legenda: r.legenda,
    hashtags: r.hashtags,
    imagens,
    video: video ? 'reel.mp4' : null,
    capa: video && fs.existsSync(path.join(saida, 'capa.jpg')) ? 'capa.jpg' : null,
  };
  fs.writeFileSync(path.join(saida, 'post.json'), JSON.stringify(post, null, 2));
  log(`Produzido: ${c.id} (${r.serie}, ${r.fonte}), ${imagens.length} telas${post.video ? ' + reel' : ''}.`);
  return post;
}

/** Modo "auto": cliente da vez (mesma regra do robô) e pasta <base>/<data>/<cliente>. Reel só no horário do reel. */
async function produzirDaVez(base, { dados, raiz, agora = new Date(), forcarReel, ...opcoes } = {}) {
  const estado = (dados && lerJson(path.join(dados, 'divulga-estado.json'))) || {};
  const vez = robo.clienteDaVez(robo.carregar(raiz), estado);
  if (!vez) { (opcoes.log || console.log)('Fila pronta ou sem cliente no rodízio: nada a produzir.'); return null; }
  const comReel = forcarReel != null ? forcarReel : robo.formatoDoHorario(agora) === 'reel';
  return produzir(vez.c.id, path.join(base, robo.dataBrasilia(agora), vez.c.id), { ...opcoes, cliente: vez.c, hoje: agora, comReel });
}

function lerJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

module.exports = { produzir, produzirDaVez };

if (require.main === module) {
  const args = process.argv.slice(2);
  const valor = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const forcarReel = args.includes('--reel') ? true : args.includes('--sem-reel') ? false : undefined;
  const [id, saida] = args;
  if (!id || !saida) { console.error('Uso: node divulga/produzir.js <clienteId|auto> <saida> [--dados <pasta>] [--reel|--sem-reel]'); process.exit(2); }
  const feito = id === 'auto'
    ? produzirDaVez(saida, { dados: valor('--dados'), forcarReel })
    : produzir(id, saida, { comReel: forcarReel !== false });
  // Nunca derruba o workflow: sem produção o robô posta o de sempre.
  feito.then(p => console.log(JSON.stringify(p))).catch(e => { console.error(`produzir falhou: ${e.message}`); });
}
