#!/usr/bin/env node
'use strict';
// Robô de ofertas com link de afiliado (ADR-AFI-01).
//   node afiliados/robo.js rodar --dados <pasta> --saida <pasta>     busca ofertas, gera o site e divulga
//   node afiliados/robo.js adicionar <link> --dados <pasta>          coloca um produto escolhido à mão
//   node afiliados/robo.js remover <link-ou-id> --dados <pasta>      tira um produto do site
//   node afiliados/robo.js diagnostico                               diz o que está ligado (sem mostrar segredos)
// O estado (vitrine.json, manuais.json, historico.json) fica na branch "afiliados-dados".
// Os logs do Actions são públicos: nunca escreve segredo, ganho ou relatório de vendas.
const fs = require('node:fs');
const path = require('node:path');
const { criarShopee, itemDoLink } = require('./lib/shopee');
const { prepararLink, lerProduto, lojaDe } = require('./lib/links');
const { montarVitrine, escolherPosts, podarHistorico } = require('./lib/selecionar');
const { gerarSite, slugId } = require('./lib/site');
const { CANAIS } = require('./lib/canais');

const CONFIG = require('./config.json');

function lerJson(p, padrao) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return padrao; }
}
function gravarJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
}
function opcao(argv, nome, padrao) {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : padrao;
}
function resumo(linhas) {
  const txt = linhas.join('\n');
  console.log(txt);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, txt + '\n');
}

function estado(dados) {
  return {
    vitrine: lerJson(path.join(dados, 'vitrine.json'), []),
    manuais: lerJson(path.join(dados, 'manuais.json'), []),
    historico: lerJson(path.join(dados, 'historico.json'), []),
  };
}

function shopeeOuNada(env) {
  return env.SHOPEE_APP_ID && env.SHOPEE_SECRET ? criarShopee({ appId: env.SHOPEE_APP_ID, segredo: env.SHOPEE_SECRET }) : null;
}

/** Em cada rodada busca 1 termo por categoria, girando os termos ao longo do dia (poupa a cota da API). */
function buscasDaRodada(cfg, agora) {
  const rodada = Math.floor(agora / (3 * 3600 * 1000));
  return cfg.categorias.map(c => ({ categoria: c.id, palavra: c.buscas[rodada % c.buscas.length] }));
}

async function coletar({ cfg, env, agora, log }) {
  const shopee = shopeeOuNada(env);
  if (!shopee) { log.push('- Shopee: desligada (faltam SHOPEE_APP_ID e SHOPEE_SECRET).'); return []; }
  const novas = [];
  for (const b of buscasDaRodada(cfg, agora)) {
    try {
      const achados = await shopee.buscar({ palavra: b.palavra, ordem: 2, limite: cfg.filtros.por_busca });
      for (const o of achados) novas.push({ ...o, categoria: b.categoria });
      log.push(`- Shopee "${b.palavra}": ${achados.length} produtos.`);
    } catch (e) {
      log.push(`- Shopee "${b.palavra}": falhou (${e.codigo || ''} ${e.message}).`);
    }
  }
  return novas;
}

async function divulgar({ vitrine, historico, cfg, env, agora, log, fetchImpl = (...a) => fetch(...a) }) {
  const base = `https://${cfg.site.slug}.pages.dev/`;
  const ativos = CANAIS.filter(c => c.ativo(env));
  if (!ativos.length) log.push('- Divulgação: nenhuma rede ligada ainda.');
  for (const canal of ativos) {
    const escolhidos = escolherPosts(vitrine, historico, canal.id, cfg.divulgacao, agora);
    if (!escolhidos.length) { log.push(`- ${canal.nome}: nada agora (limite do dia, intervalo ou fora do horário).`); continue; }
    for (const o of escolhidos) {
      try {
        await canal.publicar(o, { env, fetchImpl, quando: agora, linkSite: `${base}p/${slugId(o.id)}/` });
        historico.push({ canal: canal.id, id: o.id, quando: agora });
        log.push(`- ${canal.nome}: postou "${o.titulo.slice(0, 50)}".`);
      } catch (e) {
        log.push(`- ${canal.nome}: falhou (${String(e.message).slice(0, 200)}).`);
      }
    }
  }
}

async function rodar({ dados, saida, env = process.env, agora = Date.now(), cfg = CONFIG, divulgarAgora = true }) {
  const log = [`### Robô de ofertas: rodada de ${new Date(agora).toISOString()}`];
  const st = estado(dados);
  const novas = await coletar({ cfg, env, agora, log });
  // Os escolhidos à mão entram de novo a cada rodada (o "visto" deles é a data em que foram colados).
  const vitrine = montarVitrine([...novas, ...st.manuais], st.vitrine, cfg.filtros, agora);
  const arquivos = gerarSite(cfg, vitrine, saida, agora);
  log.push(`- Site: ${vitrine.length} ofertas, ${arquivos.length} arquivos.`);
  if (divulgarAgora) await divulgar({ vitrine, historico: st.historico, cfg, env, agora, log });
  gravarJson(path.join(dados, 'vitrine.json'), vitrine);
  gravarJson(path.join(dados, 'historico.json'), podarHistorico(st.historico, agora));
  resumo(log);
  return { vitrine, log };
}

async function urlFinal(url, fetchImpl) {
  try { const r = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) }); return r.url || url; } catch { return url; }
}

/** Coloca um produto escolhido à mão. Devolve { ok, oferta } ou { erro } com a explicação em português. */
async function adicionar({ link, dados, env = process.env, agora = Date.now(), fetchImpl = (...a) => fetch(...a) }) {
  const loja = lojaDe(link);
  let oferta;
  if (loja === 'shopee') {
    const shopee = shopeeOuNada(env);
    if (!shopee) return { erro: 'Para links da Shopee faltam as chaves da API (SHOPEE_APP_ID e SHOPEE_SECRET).' };
    const item = itemDoLink(link) || itemDoLink(await urlFinal(link, fetchImpl));
    if (!item) return { erro: 'Não achei o número do produto nesse link da Shopee. Copie o link pela página do produto.' };
    const p = await shopee.porItem(item);
    if (!p) return { erro: 'Esse produto da Shopee não tem comissão de afiliado agora.' };
    oferta = p;
  } else {
    const prep = await prepararLink(link, { amazonTag: env.AMAZON_TAG });
    if (prep.erro) return prep;
    const p = await lerProduto(prep.link, { fetchImpl });
    if (!p) return { erro: `Não consegui ler a foto e o nome desse produto na ${loja === 'amazon' ? 'Amazon' : 'loja'}. Tente o link da página do produto.` };
    const id = `${loja}-${require('node:crypto').createHash('sha1').update(prep.link).digest('hex').slice(0, 12)}`;
    oferta = { id, loja, ...p, desconto: 0, preco_antigo: null, vendas: 0, comissao: 0, link: prep.link };
  }
  oferta = { ...oferta, manual: true, categoria: 'escolhidos', visto: agora, desde: agora };
  const arq = path.join(dados, 'manuais.json');
  const manuais = lerJson(arq, []).filter(o => o.id !== oferta.id && agora - (o.visto || 0) < 14 * 24 * 3600 * 1000);
  manuais.unshift(oferta);
  gravarJson(arq, manuais.slice(0, 60));
  resumo([`### Produto adicionado`, `- ${oferta.titulo} (${oferta.loja}). Entra no site e na divulgação na próxima rodada.`]);
  return { ok: true, oferta };
}

function remover({ alvo, dados }) {
  const tira = l => l.filter(o => o.id !== alvo && o.link !== alvo && slugId(o.id) !== alvo && !String(alvo).includes(`/p/${slugId(o.id)}`));
  const antes = ['manuais.json', 'vitrine.json'].map(f => lerJson(path.join(dados, f), []));
  const depois = antes.map(tira);
  gravarJson(path.join(dados, 'manuais.json'), depois[0]);
  gravarJson(path.join(dados, 'vitrine.json'), depois[1]);
  const n = antes[0].length + antes[1].length - depois[0].length - depois[1].length;
  resumo([n ? '### Produto removido do site.' : '### Não achei esse produto no site.']);
  return n;
}

async function diagnostico({ env = process.env, fetchImpl = (...a) => fetch(...a) } = {}) {
  const log = ['### Robô de ofertas: diagnóstico'];
  log.push(`- Shopee: ${env.SHOPEE_APP_ID && env.SHOPEE_SECRET ? 'chaves presentes' : 'sem chaves'}`);
  log.push(`- Amazon: ${env.AMAZON_TAG ? 'código de associado presente' : 'sem código'}`);
  for (const c of CANAIS) log.push(`- ${c.nome}: ${c.ativo(env) ? 'ligado' : 'desligado'}`);
  for (const [nome, url] of [['API Shopee', 'https://open-api.affiliate.shopee.com.br/graphql'], ['API Mercado Livre', 'https://api.mercadolibre.com/items/MLB1'], ['Mercado Livre', 'https://www.mercadolivre.com.br/'], ['Amazon', 'https://www.amazon.com.br/']]) {
    try { const r = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } }); log.push(`- Acesso a ${nome}: HTTP ${r.status}`); } catch (e) { log.push(`- Acesso a ${nome}: falhou (${e.message})`); }
  }
  const shopee = shopeeOuNada(env);
  if (shopee) {
    try { const r = await shopee.buscar({ palavra: 'fone bluetooth', limite: 3 }); log.push(`- Teste da busca Shopee: ${r.length} produtos.`); } catch (e) { log.push(`- Teste da busca Shopee: falhou (${e.codigo || ''} ${e.message}).`); }
  }
  resumo(log);
}

async function main(argv) {
  const [cmd, alvo] = argv;
  const dados = opcao(argv, 'dados', 'dados');
  if (cmd === 'rodar') return rodar({ dados, saida: opcao(argv, 'saida', 'site-ofertas'), divulgarAgora: opcao(argv, 'divulgar', 'sim') !== 'nao' });
  if (cmd === 'adicionar') {
    const r = await adicionar({ link: alvo, dados });
    if (r.erro) { resumo([`### Não deu para adicionar`, `- ${r.erro}`]); process.exitCode = 1; }
    return r;
  }
  if (cmd === 'remover') return remover({ alvo, dados });
  if (cmd === 'diagnostico') return diagnostico();
  console.error('uso: robo.js rodar|adicionar <link>|remover <id>|diagnostico [--dados pasta] [--saida pasta]');
  process.exitCode = 2;
}

if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });

module.exports = { rodar, adicionar, remover, diagnostico, buscasDaRodada, divulgar };
