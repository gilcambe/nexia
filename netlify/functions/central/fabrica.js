'use strict';
// Fábrica na Central (M4, 12/11/2026): o servidor da tela Fábrica (PC 2, M5). Contrato fixo:
//   GET  parte=fabrica-catalogo                → { modulos, modelos }  (a Biblioteca, nexia-ai/fabrica/catalogo.json)
//   POST acao=fabrica-consultar {ficha}        → { modelo, prontos, parecidos, faltam, nivel, minutos, erros }
//   POST acao=fabrica-criar {ficha, modelo?}   → { id, status:'gerando' }  dispara kernex-clientes/fabrica.yml (prévia)
//   GET  parte=fabrica-status&id=<slug>        → { status, previa?, portoes?, minutos? }
//   POST acao=fabrica-publicar {id}            → dispara kernex-clientes/fabrica-producao.yml (só depois da confirmação do dono na tela)
// A prévia sai em https://<slug>.kernex-previas.pages.dev (medido: 30 s do disparo ao ar).
const { carregar } = require('../../../nexia-ai/fabrica/catalogo');
const { normalizarFicha, validarFicha } = require('../../../nexia-ai/fabrica/ficha');
const buscar = require('../../../nexia-ai/fabrica/buscar');

const REPO_CLIENTES = 'gilcambe/kernex-clientes';
const WORKFLOW = 'fabrica.yml';
const WORKFLOW_PRODUCAO = 'fabrica-producao.yml';
// Só os modelos que o gerador (kernex-clientes/scripts/novo-projeto.js) sabe copiar.
const GERAVEIS = ['demo-agenda', 'demo-eventos', 'demo-viagens', 'demo-profissional'];
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const previaDe = (slug) => `https://${slug}.kernex-previas.pages.dev`;

/** Chamada ao GitHub a partir da raiz da API (o gh da Central só fala com o repo nexia). */
function criarGhRaiz(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  return async (caminho, init = {}) => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-central', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchFn('https://api.github.com' + caminho, { ...init, headers });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(corpo.message || 'GitHub respondeu ' + r.status); e.status = r.status; throw e; }
    return corpo;
  };
}

/** Guarda a ficha da prévia (D1 grátis) para o "Publicar" usar os mesmos dados. Sem D1, devolve null. */
function criarLoja(env = process.env, driver) {
  if (!driver) {
    if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
    driver = require('../../../lib/firebase-lite/d1-backend').createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
  }
  const caminho = slug => 'fabrica_fichas/' + slug;
  return {
    async guardar(slug, inputs) {
      const agora = new Date().toISOString();
      await driver.apply([{ type: 'upsert', path: caminho(slug), fields: { ...inputs, em: agora }, create_time: agora, update_time: agora }]);
    },
    async ler(slug) { const d = (await driver.get([caminho(slug)])).get(caminho(slug)); return d ? d.fields : null; },
  };
}

function catalogo(cat = carregar()) {
  return {
    modulos: (cat.modulos || []).map(m => ({ id: m.id, nome: m.nome, faz: m.faz || '', nichos: m.nichos || [], nivel: m.nivel || 2,
      pronto: m.pronto !== false, origem: m.origem || '', testes: Number(m.testes) || 0 })),
    modelos: (cat.modelos || []).map(m => ({ id: m.id, nome: m.nome, nichos: m.nichos || [], modulos: m.modulos || [],
      clonavel: !!m.clonavel && GERAVEIS.includes(m.id), previa: m.previa || '' })),
  };
}

function consultar(ficha, cat = carregar()) {
  const r = buscar.consultar(ficha || {}, cat);
  return {
    modelo: r.modelo ? { id: r.modelo.id, nome: r.modelo.nome, porque: r.modelo.porque || '' } : null,
    prontos: (r.prontos || []).map(m => ({ id: m.id, nome: m.nome })),
    parecidos: (r.parecidos || []).map(p => ({ pedido: p.pedido, id: p.id, nome: p.nome, diferenca: p.diferenca || '' })),
    faltam: (r.faltam || []).map(f => (typeof f === 'string' ? f : f.pedido)),
    nivel: r.nivel, minutos: r.minutos, erros: r.erros || [],
  };
}

/** gh(caminho, init) chama a API do GitHub com o token da Central (precisa de Actions: write no kernex-clientes). */
async function criar(body, { gh, loja = null, cat = carregar() }) {
  const ficha = normalizarFicha((body || {}).ficha || {});
  const erros = validarFicha(ficha);
  if (erros.length) return { status: 400, corpo: { error: erros.join('; ') } };
  const modelo = String((body || {}).modelo || (consultar(ficha, cat).modelo || {}).id || '');
  if (!GERAVEIS.includes(modelo)) return { status: 400, corpo: { error: 'Esse modelo ainda não dá para clonar sozinho. Escolha um modelo clonável ou peça ao Cortex.' } };
  if (!SLUG_RE.test(ficha.slug)) return { status: 400, corpo: { error: 'Nome curto demais para virar endereço.' } };
  const inputs = { modelo, slug: ficha.slug, nome: ficha.nome, whatsapp: ficha.whatsapp, cidade: ficha.cidade || '' };
  const responsavel = String(((body || {}).ficha || {}).responsavel || '').trim().slice(0, 60);
  if (responsavel) inputs.responsavel = responsavel;
  try {
    await gh(`/repos/${REPO_CLIENTES}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs }) });
  } catch (e) {
    const semAcesso = e.status === 403 || e.status === 404;
    return { status: 502, corpo: { error: semAcesso ? 'A chave da Central não tem acesso ao repositório dos clientes (Actions). Avise o PC 1.' : 'O GitHub não aceitou o pedido agora: ' + e.message } };
  }
  if (loja) { try { await loja.guardar(ficha.slug, inputs); } catch { /* sem a ficha guardada, o Publicar pede para criar de novo */ } }
  return { status: 200, corpo: { id: ficha.slug, status: 'gerando', previa: previaDe(ficha.slug) } };
}

/** Situação pela última execução da fábrica com esse slug (o título da execução leva o slug). */
async function status(id, { gh }) {
  const slug = String(id || '');
  if (!SLUG_RE.test(slug)) return { status: 400, corpo: { error: 'id inválido.' } };
  const r = await gh(`/repos/${REPO_CLIENTES}/actions/workflows/${WORKFLOW}/runs?per_page=30&event=workflow_dispatch`);
  const run = (r.workflow_runs || []).find(x => String(x.display_title || x.name || '').split(/\s+/).includes(slug));
  if (!run) return { status: 200, corpo: { status: 'gerando' } };
  const minutos = run.run_started_at && run.updated_at ? Math.max(1, Math.round((Date.parse(run.updated_at) - Date.parse(run.run_started_at)) / 60000)) : undefined;
  if (run.status !== 'completed') return { status: 200, corpo: { status: 'gerando' } };
  let portoes;
  try {
    const j = await gh(`/repos/${REPO_CLIENTES}/actions/runs/${run.id}/jobs`);
    portoes = ((j.jobs || [])[0] || {}).steps?.filter(s => !/^(Set up|Complete|Post |Run actions)/.test(s.name)).map(s => ({ nome: s.name, ok: s.conclusion === 'success' }));
  } catch { portoes = undefined; }
  if (run.conclusion === 'success') return { status: 200, corpo: { status: 'previa', previa: previaDe(slug), portoes, minutos } };
  return { status: 200, corpo: { status: 'reprovado', portoes, minutos } };
}

/** Põe no endereço definitivo (<slug>.kernex.com.br). Só pela Central, depois de o dono confirmar na tela. */
async function publicar(body, { gh, loja = null }) {
  const slug = String((body || {}).id || '');
  if (!SLUG_RE.test(slug)) return { status: 400, corpo: { error: 'id inválido.' } };
  const inputs = loja ? await loja.ler(slug).catch(() => null) : null;
  if (!inputs) return { status: 409, corpo: { error: 'Não achei os dados desta prévia. Crie a prévia de novo e depois toque em Publicar.' } };
  const { em, ...dados } = inputs; void em;
  try {
    await gh(`/repos/${REPO_CLIENTES}/actions/workflows/${WORKFLOW_PRODUCAO}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { ...dados, slug, dominio: 'sim', guardar: 'sim' } }) });
  } catch (e) {
    return { status: 502, corpo: { error: 'O GitHub não aceitou publicar agora: ' + e.message } };
  }
  return { status: 200, corpo: { id: slug, status: 'publicando', endereco: `https://${slug}.kernex.com.br`, reserva: `https://${slug}.pages.dev` } };
}

/** Atende a Central; devolve null se não for parte/ação da fábrica. */
async function rota({ parte, acao, query = {}, body = {} }, { gh, loja = null }) {
  if (parte === 'fabrica-catalogo') return { status: 200, corpo: catalogo() };
  if (parte === 'fabrica-status') return status(query.id, { gh });
  if (acao === 'fabrica-consultar') return { status: 200, corpo: consultar(body.ficha) };
  if (acao === 'fabrica-criar') return criar(body, { gh, loja });
  if (acao === 'fabrica-publicar') return publicar(body, { gh, loja });
  return null;
}

module.exports = { rota, criarGhRaiz, criarLoja, catalogo, consultar, criar, status, publicar, GERAVEIS, REPO_CLIENTES, previaDe };
