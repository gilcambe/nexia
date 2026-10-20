'use strict';
// NEXIA Divulga: posta os clientes da NEXIA sozinho, nas contas da própria NEXIA (grátis).
// Uso: node divulga/robo.js rodar|ensaio [--dados <pasta>]
// 1) Primeiro sai a fila pronta (divulga/fila/*.json, em ordem, 1 por rodada).
// 2) Fila vazia: reveza os clientes (divulga/clientes/*.json). Se a linha de produção (divulga/produzir.js) deixou
//    o post.json de hoje do cliente da vez, publica ele: 7h15 carrossel, 12h15 foto com pergunta, 19h15 reel.
//    Sem post.json, o de sempre: foto fixa + texto da IA grátis.
// Sem nenhuma rede ligada, só mostra os textos e não marca nada como postado.
const fs = require('node:fs');
const path = require('node:path');
const { CANAIS } = require('./lib/canais');
const { linkUtm, textoIA } = require('./lib/texto');
const { temaDoDia, montarLegenda } = require('./lib/calendario');
const { listaSemanal, roteiroCollabs } = require('./lib/interacao');

const RAIZ = __dirname;
const IMAGENS = 'https://raw.githubusercontent.com/gilcambe/nexia/develop/divulga/imagens/';
const VIDEOS = 'https://raw.githubusercontent.com/gilcambe/nexia/develop/divulga/videos/';
// Arquivos da linha de produção: branch "divulga-midia" (só a última produção, sobrescrita a cada rodada).
const MIDIA = 'https://raw.githubusercontent.com/gilcambe/nexia/divulga-midia/';

/** Data de Brasília (AAAA-MM-DD), a mesma usada pelo workflow para a pasta da produção. */
const dataBrasilia = (d = new Date()) => new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
/** Formato pelo horário de Brasília: manhã carrossel (7h15), meio do dia foto com pergunta (12h15), noite reel (19h15). */
function formatoDoHorario(d = new Date()) {
  const h = new Date(d.getTime() - 3 * 3600 * 1000).getUTCHours();
  return h < 10 ? 'carrossel' : h < 17 ? 'foto' : 'reel';
}

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
function montar({ cliente, legenda, imagem, video, imagens, id, capa }) {
  // Carrossel/álbum só quando a fila manda `imagens`; sem isso o post é o de sempre.
  const extra = Array.isArray(imagens) && imagens.length ? { imagens } : {};
  const porRede = rede => {
    const link = linkUtm(cliente.link, rede);
    if (rede === 'instagram') return { texto: maisHashtags(/link na bio/i.test(legenda) ? legenda : `${legenda}\n\nLink na bio.`, cliente), imagem, video, ...(capa ? { capa } : {}), ...extra };
    if (rede === 'facebook') return { texto: semBio(legenda), link, imagem, ...extra };
    return { texto: semBio(legenda), link, imagem };
  };
  return { id, cliente: cliente.id, porRede };
}

/** Cliente ligado: existe e não tem `"ativo": false` (pausado fica fora da fila e do rodízio, sem apagar nada). */
const ligado = c => !!c && c.ativo !== false;
/** Item da fila pronta que ainda pode sair agora: não feito e de cliente ligado (de cliente pausado espera a volta). */
const filaPendente = (fila, clientes, feitos) => (fila || []).find(i => !feitos.has(i.id) && ligado(clientes[i.cliente]));

/** Cliente da vez no rodízio (null se ainda há item na fila pronta, que sai antes). */
function clienteDaVez({ clientes, fila }, estado = {}) {
  const feitos = new Set(estado.feitos || []);
  if (filaPendente(fila, clientes, feitos)) return null;
  const prontos = Object.values(clientes).filter(c => ligado(c) && (c.imagens || []).length && (c.assuntos || []).length);
  if (!prontos.length) return null;
  const n = estado.rodizio || 0;
  return { c: prontos[n % prontos.length], volta: Math.floor(n / prontos.length) };
}

/**
 * Post da linha de produção (produzir.js): `<producao>/<data>/<cliente>/post.json` de hoje.
 * Carrossel no IG/FB de manhã, foto com pergunta no meio do dia, reel à noite (sem vídeo, vira carrossel).
 * Threads/Bluesky/Pinterest sempre recebem texto + 1ª imagem. Sem post.json válido: null (segue o de sempre).
 */
function postProduzido(producao, c, agora = new Date()) {
  const rel = `producao/${dataBrasilia(agora)}/${c.id}/`;
  const p = lerJson(path.join(producao, dataBrasilia(agora), c.id, 'post.json'), null);
  if (!p || p.cliente !== c.id || !p.legenda || !Array.isArray(p.imagens) || !p.imagens.length) return null;
  const url = f => (/^https:\/\//.test(f) ? f : MIDIA + rel + f);
  const imagens = p.imagens.map(url);
  const tags = (p.hashtags || []).filter(h => !p.legenda.includes(h)).join(' ');
  const legenda = tags ? `${p.legenda}\n\n${tags}` : p.legenda;
  let formato = formatoDoHorario(agora);
  if (formato === 'reel' && !p.video) formato = 'carrossel';
  const base = { id: null, cliente: c, legenda, imagem: imagens[0] };
  const extra = formato === 'carrossel' ? { imagens } : formato === 'reel' ? { video: url(p.video), capa: p.capa ? url(p.capa) : undefined } : {};
  return { ...montar({ ...base, ...extra }), rodizio: true, formato, serie: p.serie };
}

/** Escolhe o post desta rodada: primeiro a fila, depois o rodízio. */
async function proximo({ clientes, fila }, estado, ctx) {
  const feitos = new Set(estado.feitos || []);
  const item = filaPendente(fila, clientes, feitos);
  if (item) return montar({ id: item.id, cliente: clientes[item.cliente], legenda: item.legenda, imagem: urlImagem(item.imagem || (item.imagens || [])[0] || ''), video: item.video && VIDEOS + item.video, imagens: Array.isArray(item.imagens) ? item.imagens.map(urlImagem) : undefined });
  const vez = clienteDaVez({ clientes, fila: [] }, estado);
  if (!vez) return null;
  const { c, volta } = vez;
  const produzido = ctx && ctx.producao && postProduzido(ctx.producao, c, ctx.agora || new Date());
  if (produzido) return produzido;
  const assunto = c.assuntos[volta % c.assuntos.length];
  // Calendário semanal fixo: o tema do dia (dica, recurso, desafio...) dá o gancho, a chamada e as hashtags.
  const tema = temaDoDia();
  const base = await textoIA(c, `${tema.assunto} (foco: ${assunto})`, ctx);
  const legenda = montarLegenda(c, tema, base);
  return { ...montar({ id: null, cliente: c, legenda, imagem: urlImagem(c.imagens[volta % c.imagens.length]) }), rodizio: true };
}

async function rodar({ acao = 'rodar', dados, env: envBruto = process.env, fetchImpl = fetch, log = console.log, raiz = RAIZ, producao = null, agora } = {}) {
  // Segredo salvo pelo PowerShell chega com quebra de linha no fim ("Cannot parse access token"): limpa antes de usar.
  const env = Object.fromEntries(Object.entries(envBruto).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/[\u0000\uFEFF]/g, '').trim() : v]));
  const arqEstado = dados && path.join(dados, 'divulga-estado.json');
  const estado = (arqEstado && lerJson(arqEstado, null)) || { rodizio: 0, feitos: [], historico: [] };
  const ctx = { env, fetchImpl, log, producao, agora };
  const post = await proximo(carregar(raiz), estado, ctx);
  if (!post) { log('Nada para postar (fila vazia e nenhum cliente com imagens e assuntos).'); return { postou: false }; }
  const ativos = acao === 'ensaio' ? [] : CANAIS.filter(c => c.ativo(env));
  log(`Post: ${post.id || 'rodízio'} (${post.cliente})${post.formato ? ` produzido: ${post.formato}` : ''}`);
  if (!ativos.length) {
    for (const rede of ['instagram', 'facebook']) log(`--- ${rede} ---\n${post.porRede(rede).texto}\n${post.porRede(rede).link || ''}`);
    if (acao === 'ensaio') {
      const l = listaSemanal();
      log(`--- para você interagir à mão esta semana (${l.itens.length} itens) ---\n${l.itens.map(i => `• ${i.alvo}: ${i.fazer}`).join('\n')}`);
      log(`--- roteiro de 3 collabs ---\n${roteiroCollabs().map(p => `${p.passo}. ${p.titulo}: ${p.texto}`).join('\n')}`);
    }
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

  // Coleta diária de seguidores via Graph API da Meta (1 amostra por dia em divulg-estado.json)
  const tokenMeta = env.DIVULGA_META_PAGE_TOKEN || env.META_PAGE_TOKEN;
  const igUserId = env.DIVULGA_META_IG_USER_ID || env.META_IG_USER_ID;
  if (tokenMeta && igUserId) {
    try {
      const hojeStr = dataBrasilia(agora || new Date());
      estado.seguidores = Array.isArray(estado.seguidores) ? estado.seguidores : [];
      if (!estado.seguidores.some(s => s && s.dia === hojeStr)) {
        const url = `https://graph.facebook.com/v19.0/${igUserId}?fields=followers_count&access_token=${tokenMeta}`;
        const r = await fetchImpl(url);
        if (r.ok) {
          const data = await r.json().catch(() => null);
          if (data && typeof data.followers_count === 'number') {
            estado.seguidores.push({ dia: hojeStr, total: data.followers_count });
            estado.seguidores = estado.seguidores.slice(-60);
          }
        }
      }
    } catch { /* se faltar permissao ou der erro na Graph API, nao falha o robo */ }
  }

  if (arqEstado) { fs.mkdirSync(dados, { recursive: true }); fs.writeFileSync(arqEstado, JSON.stringify(estado, null, 2)); }
  return { postou, resultados, post };
}

module.exports = { rodar, carregar, proximo, montar, semBio, clienteDaVez, postProduzido, formatoDoHorario, dataBrasilia };

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dados');
  const p = args.indexOf('--producao');
  rodar({ acao: args[0] || 'ensaio', dados: i >= 0 ? args[i + 1] : null, producao: p >= 0 ? args[p + 1] : null })
    .then(r => { if (r.resultados && !r.postou) process.exitCode = 1; })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
