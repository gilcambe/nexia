'use strict';
// Divulga: editor de reels (#990) e linha de produção roteiro > arte > reel > publicar (#992).
// Sem Meta, sem IA real, sem Chromium e sem ffmpeg: tudo falso.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { escFfmpeg, argsReel, planoReel, reel } = require('../../divulga/gerar');
const { produzir } = require('../../divulga/produzir');
const { rodar, formatoDoHorario, dataBrasilia } = require('../../divulga/robo');
const { roteiroFixo } = require('../../divulga/lib/roteiro');

const cliente = { id: 'studio-x', nome: 'Studio X', instagram: 'studio_x', link: 'https://exemplo.com/', assuntos: ['corte', 'cor', 'escova', 'barba'], imagens: ['x.jpg'], hashtags: ['#cabelo'] };
const rot = roteiroFixo(cliente, '3-erros');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-reel-'));
const silencio = () => {};

test('RP1. escFfmpeg escapa \\ % \' : e o separador do grafo', () => {
  assert.equal(escFfmpeg('100%'), '100\\\\\\\\%');
  assert.equal(escFfmpeg('a:b'), 'a\\\\:b');
  assert.equal(escFfmpeg("o'k"), "o\\\\\\'k");
  assert.equal(escFfmpeg('a,b;[c]'), 'a\\,b\\;\\[c\\]');
  assert.equal(escFfmpeg('sem nada'), 'sem nada');
});

test('RP2. argsReel: sem roteiro sai como sempre; com roteiro tem xfade, drawtext, barra e 7 a 15 s', () => {
  const sem = argsReel('/s');
  const fc = sem[sem.indexOf('-filter_complex') + 1];
  assert.match(fc, /concat=n=5:v=1:a=0\[v\]/);
  assert.doesNotMatch(fc, /xfade|drawtext/);
  assert.match(fc, /d=20,afade=t=in:d=2,afade=t=out:st=18:d=2\[a\]/);
  assert.equal(sem.filter(a => a === '-i').length, 5);
  const telas = Array.from({ length: rot.telas.length + 2 }, (_, i) => `/s/carrossel-${i + 1}.jpg`);
  const com = argsReel('/s', { roteiro: rot, telas, temFonte: () => true });
  const fc2 = com[com.indexOf('-filter_complex') + 1];
  assert.match(fc2, /xfade=transition=fade:duration=0\.3/);
  assert.match(fc2, /drawtext=fontfile=/);
  assert.match(fc2, /overlay=x=/, 'barra de progresso');
  assert.equal(com.filter(a => a === '-i').length, 6, 'capa + 4 telas + cta');
  assert.ok(com.includes('/s/carrossel-7.jpg'), 'a última tela é o CTA');
  const { total } = planoReel(rot, telas.length);
  assert.ok(total >= 7 && total <= 15, `total ${total}`);
  assert.ok(planoReel({ gancho: 'a', telas: [{ titulo: 'b' }], cta: 'c' }, 3).total >= 7, 'curto é esticado para 7 s');
  const semFonte = argsReel('/s', { roteiro: rot, telas, temFonte: () => false });
  assert.doesNotMatch(semFonte.join(' '), /drawtext/, 'sem a fonte, sem texto');
});

test('RP3. reel com ffmpeg falso: roda o vídeo e a capa; sem arquivos não roda nada', () => {
  const d = tmp();
  const chamadas = [];
  const rodar = (cmd, args) => { chamadas.push(args); return { status: 0 }; };
  assert.equal(reel(d, { roteiro: rot, rodar }), false);
  assert.equal(chamadas.length, 0);
  for (let i = 1; i <= rot.telas.length + 2; i++) fs.writeFileSync(path.join(d, `carrossel-${i}.png`), 'x');
  assert.equal(reel(d, { roteiro: rot, rodar }), true);
  assert.equal(chamadas.length, 2);
  assert.ok(chamadas[1].includes(path.join(d, 'capa.jpg')));
});

test('RP4. produzir com IA e Chromium falsos grava post.json válido', async () => {
  const d = tmp();
  const groq = JSON.stringify({ gancho: 'Gancho da IA', telas: [1, 2, 3, 4, 5].map(n => ({ titulo: `T${n}`, texto: `Texto ${n}` })), cta: 'Salve', legenda: '', hashtags: ['#ia'], pergunta: 'E aí?' });
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: groq } }] }) });
  const renderizar = async (pecas, saida, o) => { assert.equal(o.formato, 'jpeg'); for (const n of Object.keys(pecas)) fs.writeFileSync(path.join(saida, `${n}.jpg`), 'jpg'); return true; };
  const reelFalso = (saida, o) => { assert.ok(o.roteiro && o.telas.length === 7); fs.writeFileSync(path.join(saida, 'reel.mp4'), 'mp4'); fs.writeFileSync(path.join(saida, 'capa.jpg'), 'jpg'); return true; };
  const p = await produzir('studio-x', d, { cliente, env: { GROQ_API_KEY: 'g' }, fetchImpl, log: silencio, renderizar, reel: reelFalso, hoje: new Date('2026-10-19T12:00:00Z') });
  const lido = JSON.parse(fs.readFileSync(path.join(d, 'post.json'), 'utf8'));
  assert.deepEqual(lido, p);
  assert.equal(lido.cliente, 'studio-x');
  assert.equal(lido.fonte, 'ia');
  assert.match(lido.legenda, /Gancho da IA/);
  assert.equal(lido.imagens.length, 7);
  assert.equal(lido.video, 'reel.mp4');
  assert.equal(lido.capa, 'capa.jpg');
  assert.equal(lido.data, '2026-10-19');
  assert.ok(Array.isArray(lido.hashtags) && lido.hashtags.length);
  // Sem Chromium: não grava post.json (o robô segue o de sempre).
  const d2 = tmp();
  assert.equal(await produzir('studio-x', d2, { cliente, env: {}, log: silencio, renderizar: async () => false }), null);
  assert.equal(fs.existsSync(path.join(d2, 'post.json')), false);
});

/** Monta uma raiz de clientes + produção de hoje e roda o robô com fetch falso. */
async function rodarProduzido(agora, post) {
  const raiz = tmp();
  fs.mkdirSync(path.join(raiz, 'clientes'));
  fs.writeFileSync(path.join(raiz, 'clientes', 'studio-x.json'), JSON.stringify(cliente));
  const producao = tmp();
  if (post) {
    const pasta = path.join(producao, dataBrasilia(agora), 'studio-x');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'post.json'), JSON.stringify(post));
  }
  const corpos = [];
  let n = 0;
  const fetchImpl = async (u, o = {}) => { corpos.push(`${u} ${o.body || ''}`); n += 1; return { ok: true, status: 200, json: async () => ({ id: `id${n}`, status_code: 'FINISHED' }) }; };
  const env = { DIVULGA_META_IG_USER_ID: '2', DIVULGA_META_PAGE_TOKEN: 't', DIVULGA_PAUSA_MS: '0' };
  const r = await rodar({ acao: 'rodar', dados: tmp(), env, fetchImpl, log: silencio, raiz, producao, agora });
  return { r, corpos: corpos.join('\n') };
}

const POST = { cliente: 'studio-x', legenda: 'Legenda do roteiro', hashtags: ['#cabelo', '#studiox'], imagens: ['carrossel-1.jpg', 'carrossel-2.jpg', 'carrossel-3.jpg'], video: 'reel.mp4', capa: 'capa.jpg', serie: '3-erros' };

test('RP5. robô: carrossel às 10h UTC e reel às 22h UTC com o post.json de hoje', async () => {
  assert.equal(formatoDoHorario(new Date('2026-10-19T10:15:00Z')), 'carrossel');
  assert.equal(formatoDoHorario(new Date('2026-10-19T15:15:00Z')), 'foto');
  assert.equal(formatoDoHorario(new Date('2026-10-19T22:15:00Z')), 'reel');
  const manha = await rodarProduzido(new Date('2026-10-19T10:15:00Z'), POST);
  assert.equal(manha.r.post.formato, 'carrossel');
  assert.match(manha.corpos, /media_type=CAROUSEL/);
  assert.match(manha.corpos, /divulga-midia%2Fproducao%2F2026-10-19%2Fstudio-x%2Fcarrossel-2\.jpg/);
  const noite = await rodarProduzido(new Date('2026-10-19T22:15:00Z'), POST);
  assert.equal(noite.r.post.formato, 'reel');
  assert.match(noite.corpos, /media_type=REELS/);
  assert.match(noite.corpos, /cover_url=https%3A%2F%2Fraw\.githubusercontent\.com%2Fgilcambe%2Fnexia%2Fdivulga-midia%2Fproducao%2F2026-10-19%2Fstudio-x%2Fcapa\.jpg/);
  assert.match(noite.corpos, /Legenda\+do\+roteiro/);
  // Reel sem vídeo vira carrossel.
  const semVideo = await rodarProduzido(new Date('2026-10-19T22:15:00Z'), { ...POST, video: null, capa: null });
  assert.equal(semVideo.r.post.formato, 'carrossel');
});

test('RP6. robô sem post.json de hoje: o de sempre (foto fixa do cliente)', async () => {
  const { r, corpos } = await rodarProduzido(new Date('2026-10-19T22:15:00Z'), null);
  assert.equal(r.post.formato, undefined);
  assert.match(corpos, /image_url=https%3A%2F%2Fraw\.githubusercontent\.com%2Fgilcambe%2Fnexia%2Fdevelop%2Fdivulga%2Fimagens%2Fx\.jpg/);
  assert.doesNotMatch(corpos, /CAROUSEL|REELS/);
});
