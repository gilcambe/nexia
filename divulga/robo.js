'use strict';
// NEXIA Divulga: posta os clientes da NEXIA sozinho, nas contas da própria NEXIA (grátis).
// Uso: node divulga/robo.js rodar|ensaio [--dados <pasta>]
// 1) Primeiro sai a fila pronta (divulga/fila/*.json, em ordem, 1 por rodada).
// 2) Fila vazia: reveza os clientes (divulga/clientes/*.json) com texto da IA grátis.
// Sem nenhuma rede ligada, só mostra os textos e não marca nada como postado.
const fs = require('node:fs');
const path = require('node:path');
const { CANAIS } = require('./lib/canais');
const { linkUtm, textoIA } = require('./lib/texto');

const RAIZ = __dirname;
const IMAGENS = 'https://raw.githubusercontent.com/gilcambe/nexia/develop/divulga/imagens/';
const VIDEOS = 'https://raw.githubusercontent.com/gilcambe/nexia/develop/divulga/videos/';

const lerJson = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return padrao; } };
const lerPasta = p => (fs.existsSync(p) ? fs.readdirSync(p).filter(f => f.endsWith('.json')).sort() : []);
const urlImagem = i => (/^https:\/\//.test(i) ? i : IMAGENS + i);

function carregar(raiz = RAIZ) {
  const clientes = {};
  for (const f of lerPasta(path.join(raiz, 'clientes'))) {
    const c = lerJson(path.join(raiz, 'clientes', f));
    if (c && c.id) clientes[c.id] = c;
  }
  const fila = lerPasta(path.join(raiz, 'fila')).map(f => ({ id: f.replace(/\.json$/, ''), ...lerJson(path.join(raiz, 'fila', f), {}) }));
  return { clientes, fila };
}

/** No Instagram as hashtags trazem gente nova: completa até 8 com as do cliente, sem repetir. */
function maisHashtags(texto, cliente) {
  const tem = new Set((texto.match(/#[\p{L}\d_]+/gu) || []).map(h => h.toLowerCase()));
  const extra = (cliente.hashtagsInstagram || cliente.hashtags || []).filter(h => !tem.has(h.toLowerCase())).slice(0, Math.max(0, 8 - tem.size));
  return extra.length ? `${texto} ${extra.join(' ')}` : texto;
}

const semBio = t => t.replace(/\s*(pelo )?link na bio/gi, '').replace(/\.\./g, '.').replace(/\s+\./g, '.').trim();

/** Textos de cada rede. Instagram não abre link na legenda: lá vai "link na bio". */
function montar({ cliente, legenda, imagem, video, id }) {
  const porRede = rede => {
    const link = linkUtm(cliente.link, rede);
    if (rede === 'instagram') return { texto: maisHashtags(/link na bio/i.test(legenda) ? legenda : `${legenda}\n\nLink na bio.`, cliente), imagem, video };
    return { texto: semBio(legenda), link, imagem };
  };
  return { id, cliente: cliente.id, porRede };
}

/** Escolhe o post desta rodada: primeiro a fila, depois o rodízio. */
async function proximo({ clientes, fila }, estado, ctx) {
  const feitos = new Set(estado.feitos || []);
  const item = fila.find(i => !feitos.has(i.id) && clientes[i.cliente]);
  if (item) return montar({ id: item.id, cliente: clientes[item.cliente], legenda: item.legenda, imagem: urlImagem(item.imagem), video: item.video && VIDEOS + item.video });
  const prontos = Object.values(clientes).filter(c => c.ativo !== false && (c.imagens || []).length && (c.assuntos || []).length);
  if (!prontos.length) return null;
  const n = estado.rodizio || 0;
  const c = prontos[n % prontos.length];
  const volta = Math.floor(n / prontos.length);
  const assunto = c.assuntos[volta % c.assuntos.length];
  const base = await textoIA(c, assunto, ctx);
  const legenda = `${base}\n\n${(c.hashtags || []).slice(0, 3).join(' ')}`.trim();
  return { ...montar({ id: null, cliente: c, legenda, imagem: urlImagem(c.imagens[volta % c.imagens.length]) }), rodizio: true };
}

async function rodar({ acao = 'rodar', dados, env: envBruto = process.env, fetchImpl = fetch, log = console.log, raiz = RAIZ } = {}) {
  // Segredo salvo pelo PowerShell chega com quebra de linha no fim ("Cannot parse access token"): limpa antes de usar.
  const env = Object.fromEntries(Object.entries(envBruto).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/[\u0000\uFEFF]/g, '').trim() : v]));
  const arqEstado = dados && path.join(dados, 'divulga-estado.json');
  const estado = (arqEstado && lerJson(arqEstado, null)) || { rodizio: 0, feitos: [], historico: [] };
  const ctx = { env, fetchImpl, log };
  const post = await proximo(carregar(raiz), estado, ctx);
  if (!post) { log('Nada para postar (fila vazia e nenhum cliente com imagens e assuntos).'); return { postou: false }; }
  const ativos = acao === 'ensaio' ? [] : CANAIS.filter(c => c.ativo(env));
  log(`Post: ${post.id || 'rodízio'} (${post.cliente})`);
  if (!ativos.length) {
    for (const rede of ['instagram', 'facebook']) log(`--- ${rede} ---\n${post.porRede(rede).texto}\n${post.porRede(rede).link || ''}`);
    log(acao === 'ensaio' ? 'Ensaio: nada foi publicado.' : 'Nenhuma rede ligada ainda: nada foi publicado.');
    return { postou: false, post };
  }
  const resultados = [];
  for (const canal of ativos) {
    try {
      const r = await canal.publicar(post.porRede(canal.id), { env, fetchImpl, quando: Date.now() });
      resultados.push({ canal: canal.id, ok: true, ref: r && r.ref });
      log(`OK ${canal.nome}`);
    } catch (e) {
      // O motivo fica no estado e vira aviso no GitHub (sem nenhum código secreto: canais.js já tira tokens da mensagem).
      const erro = String(e.message || e).replace(/(access_token|token|secret)=[^&\s]+/gi, '$1=***').slice(0, 200);
      resultados.push({ canal: canal.id, ok: false, erro });
      log(`ERRO ${canal.nome}: ${erro}`);
      if (env.GITHUB_ACTIONS) console.log(`::warning title=${canal.nome}::${erro.replace(/[\r\n]+/g, ' ')}`);
    }
  }
  const postou = resultados.some(r => r.ok);
  if (postou) {
    if (post.id) estado.feitos = [...(estado.feitos || []), post.id];
    if (post.rodizio) estado.rodizio = (estado.rodizio || 0) + 1;
  }
  estado.historico = [...(estado.historico || []), { quando: new Date().toISOString(), id: post.id, cliente: post.cliente, resultados }].slice(-60);
  if (arqEstado) { fs.mkdirSync(dados, { recursive: true }); fs.writeFileSync(arqEstado, JSON.stringify(estado, null, 2)); }
  return { postou, resultados, post };
}

module.exports = { rodar, carregar, proximo, montar, semBio };

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dados');
  rodar({ acao: args[0] || 'ensaio', dados: i >= 0 ? args[i + 1] : null })
    .then(r => { if (r.resultados && !r.postou) process.exitCode = 1; })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
