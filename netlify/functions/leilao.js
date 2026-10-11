'use strict';
// NEXIA · Central de Leilões (Bezsan): o "agente de leilão" do painel do dono.
//
// Só funciona para agendas com `leilao: true` em clientes/agendas.js e só com o painel logado
// (o mesmo token da NEXIA Agenda, ou o Bearer do master). Nada pago:
//   - IA: a lista GRÁTIS do Model Router (Groq, GitHub Models, Gemini, ... Kilo), sem Anthropic.
//   - Processo judicial: API pública do CNJ (DataJud), com a chave pública que o próprio CNJ publica.
//   - Imóveis: agenda_contas/<slug>/imoveis/<id> (Firestore grátis).
// O que pede login/captcha (prefeitura, condomínio, cartório, site da Caixa) não é raspado: a página
// mostra o passo a passo e o dono digita o que encontrou.
//
// POST (texto JSON) { site, token, acao, ... }
//   analisar  { tipo: 'edital'|'matricula', texto?, imagens?: ['data:image/jpeg;base64,...'] } → { dados }
//   parecer   { imovel, conta }                                                            → { texto }
//   processo  { numero }                                                                   → { processo }
//   listar | salvar { imovel } | apagar { id }

const COLLECTION = 'agenda_contas';
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TEXTO_MAX = 60000;
const IMAGENS_MAX = 4;
const IMAGEM_MAX = 1400000; // base64
const IMOVEL_MAX = 60 * 1024;
const IMOVEIS_MAX = 300;
const IA_POR_HORA = 60;
// Chave pública do DataJud, publicada pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/acesso
// (troca de tempos em tempos: DATAJUD_API_KEY muda sem mexer no código).
const DATAJUD_CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }

// ── Processo judicial (número CNJ NNNNNNN-DD.AAAA.J.TR.OOOO → tribunal no DataJud) ──
const TJ = { '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce', '07': 'dft', '08': 'es', '09': 'go', 10: 'ma', 11: 'mt', 12: 'ms', 13: 'mg', 14: 'pa', 15: 'pb', 16: 'pr', 17: 'pe', 18: 'pi', 19: 'rj', 20: 'rn', 21: 'rs', 22: 'ro', 23: 'rr', 24: 'sc', 25: 'se', 26: 'sp', 27: 'to' };
function tribunalDoProcesso(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length !== 20) return null;
  const j = d[13];
  const tr = d.slice(14, 16);
  let alias = null;
  if (j === '8' && TJ[tr]) alias = 'tj' + TJ[tr];
  else if (j === '4' && Number(tr) >= 1 && Number(tr) <= 6) alias = 'trf' + Number(tr);
  else if (j === '5' && Number(tr) >= 1 && Number(tr) <= 24) alias = 'trt' + Number(tr);
  return alias ? { numero: d, alias } : null;
}
function resumirProcesso(src) {
  const movs = Array.isArray(src.movimentos) ? src.movimentos.slice() : [];
  movs.sort((a, b) => String(b.dataHora || '').localeCompare(String(a.dataHora || '')));
  return {
    numero: src.numeroProcesso,
    tribunal: src.tribunal,
    classe: src.classe && src.classe.nome,
    assuntos: (src.assuntos || []).map(a => a && a.nome).filter(Boolean),
    orgao: src.orgaoJulgador && src.orgaoJulgador.nome,
    ajuizado_em: src.dataAjuizamento,
    atualizado_em: src.dataHoraUltimaAtualizacao,
    movimentos: movs.slice(0, 15).map(m => ({ data: m.dataHora, nome: m.nome })),
  };
}

// ── IA grátis ──
const PEDIDO_EDITAL = `Você é um advogado especialista em leilões de imóveis no Brasil. Leia o EDITAL abaixo e devolva SÓ um JSON (sem texto antes ou depois, sem markdown) com estes campos, usando null quando o edital não disser:
{"tipo_leilao":"judicial|extrajudicial|venda_direta","processo":"número CNJ ou null","vara":"","leiloeiro":"","site_leilao":"","endereco":"","cidade":"","uf":"","descricao":"","area_m2":null,"matricula":"","cartorio":"","inscricao_iptu":"","praca1_data":"AAAA-MM-DD","praca1_valor":0,"praca2_data":"AAAA-MM-DD","praca2_valor":0,"avaliacao":0,"comissao_pct":0,"pagamento":"à vista, parcelado, FGTS, financiamento","ocupado":true,"debitos_iptu":"quem paga e quanto","debitos_condominio":"quem paga e quanto","onus":["penhoras, hipotecas, usufruto, indisponibilidade, ações"],"prazos":["prazos importantes"],"riscos":["riscos concretos para quem compra"],"resumo":"3 frases simples"}
Valores em reais como número (ex.: 250000.5). Não invente nada que não esteja no texto.`;
const PEDIDO_MATRICULA = `Você é um advogado especialista em registro de imóveis no Brasil. Leia a MATRÍCULA abaixo (certidão do cartório) e devolva SÓ um JSON (sem texto antes ou depois, sem markdown):
{"matricula":"","cartorio":"","endereco":"","descricao":"","area_m2":null,"proprietarios":["dono atual"],"onus":["cada registro/averbação AINDA ativo: penhora, hipoteca, alienação fiduciária, usufruto, indisponibilidade, ação, arrolamento"],"cancelados":["ônus já cancelados"],"alertas":["riscos para quem arremata: dono diferente do executado, penhora de terceiros, indisponibilidade, área divergente, falta de averbação da construção"],"resumo":"3 frases simples"}
Não invente nada que não esteja no texto.`;
const PEDIDO_PARECER = 'Você é o analista de leilões da Bezsan. Com os dados do imóvel e a conta de viabilidade (JSON), escreva um parecer em português do Brasil, simples, para um investidor: 1) se vale a pena ou não e por quê, 2) os 3 maiores riscos, 3) o lance máximo recomendado, 4) o que conferir antes de dar lance. Até 12 linhas, frases curtas, sem markdown, sem inventar dados que não estejam no JSON. Termine com: "Análise automática: confirme com um advogado antes de dar lance."';

function extrairJson(texto) {
  const t = String(texto || '').replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{');
  const f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { const o = JSON.parse(t.slice(i, f + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

function modelosGratis(FREE, { longo, imagens }) {
  let lista = FREE.reasoning.filter(d => d.provider !== 'anthropic');
  // Texto longo ou imagem: o Gemini grátis aguenta mais contexto e lê imagem; vai primeiro.
  if (longo || imagens) lista = [...lista.filter(d => d.provider === 'google'), ...lista.filter(d => d.provider !== 'google')];
  return lista;
}

async function perguntarIa({ router, FREE, system, conteudo, imagens, maxTokens, timeoutMs = 15000, totalMs = 50000, now = Date.now }) {
  const inicio = now();
  const lista = modelosGratis(FREE, { longo: conteudo.length > 16000, imagens: imagens && imagens.length });
  for (const d of lista) {
    if (now() - inicio > totalMs) break;
    try {
      const cap = router.capabilities(d);
      if (!cap || !cap.available || (imagens && imagens.length && !cap.vision)) continue;
      const out = await Promise.race([
        router.chat(d, { system, messages: [{ role: 'user', content: conteudo }], maxTokens, ...(imagens && imagens.length ? { images: imagens } : {}) }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      if (out && out.text) return { texto: out.text, modelo: `${d.provider}:${d.model}` };
    } catch { /* próximo modelo grátis */ }
  }
  return null;
}

// Imóvel salvo: só campos simples (texto, número, booleano, listas curtas, objetos rasos).
function limparValor(v, prof = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.slice(0, 4000);
  if (Array.isArray(v)) return prof > 4 ? undefined : v.slice(0, 60).map(x => (Array.isArray(x) ? JSON.stringify(x).slice(0, 4000) : limparValor(x, prof + 1))).filter(x => x !== undefined);
  if (typeof v === 'object') {
    if (prof > 4) return undefined;
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) { if (/^[A-Za-z0-9_-]{1,40}$/.test(k)) { const y = limparValor(x, prof + 1); if (y !== undefined) o[k] = y; } }
    return o;
  }
  return undefined;
}

const _uso = new Map();
function iaPermitida(chave, now) {
  const hora = Math.floor(now / 3600000);
  const k = chave + ':' + hora;
  const n = (_uso.get(k) || 0) + 1;
  _uso.set(k, n);
  if (_uso.size > 2000) for (const key of _uso.keys()) if (!key.endsWith(':' + hora)) _uso.delete(key);
  return n <= IA_POR_HORA;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => require('../../clientes/agendas.js').AGENDAS[slug]);
  const getRouter = deps.getRouter || (() => require('../../nexia-ai/model-router').getRouter());
  const getFree = deps.getFree || (() => require('../../nexia-ai/orchestrator/models').FREE);
  const fetchFn = deps.fetch || ((...a) => globalThis.fetch(...a));
  const env = deps.env || process.env;
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return res(400, { error: 'Pedido inválido.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res(400, { error: 'Pedido inválido.' });
    const slug = str(body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro || !cadastro.leilao) return res(404, { error: 'A Central de Leilões não está ativa nesta conta.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const conta = db.collection(COLLECTION).doc(slug);

    // Mesmo login do painel da NEXIA Agenda.
    let logado = false;
    let quem = 'master';
    const token = str(body.token, 100);
    if (/^[a-f0-9]{64}$/.test(token)) {
      quem = await sha256(token);
      const s = await conta.collection('sessoes').doc(quem).get();
      logado = s.exists && Number(s.data().expira) > now();
    }
    if (!logado && headers.authorization) {
      const auth = await getMw().verifyBearerToken(event);
      logado = !!(auth.ok && auth.role === 'master');
      quem = 'master';
    }
    if (!logado) return res(401, { error: 'Entre de novo no painel.', sair: true });

    const acao = str(body.acao, 20);
    const imoveis = conta.collection('imoveis');

    if (acao === 'listar') {
      const snap = await imoveis.get();
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || '')));
      return res(200, { ok: true, imoveis: lista });
    }

    if (acao === 'salvar') {
      const imovel = limparValor(body.imovel);
      if (!imovel || typeof imovel !== 'object' || Array.isArray(imovel)) return res(400, { error: 'Imóvel inválido.' });
      delete imovel.id;
      if (JSON.stringify(imovel).length > IMOVEL_MAX) return res(413, { error: 'Dados demais neste imóvel.' });
      let id = str(body.id, 64);
      if (id && !ID_RE.test(id)) return res(400, { error: 'Imóvel inválido.' });
      if (!id) {
        if ((await imoveis.get()).docs.length >= IMOVEIS_MAX) return res(400, { error: `Limite de ${IMOVEIS_MAX} imóveis. Apague os que já não interessam.` });
        id = hex(globalThis.crypto.getRandomValues(new Uint8Array(10)));
      }
      const agora = new Date(now()).toISOString();
      const antigo = await imoveis.doc(id).get();
      await imoveis.doc(id).set({ ...imovel, criado_em: antigo.exists ? antigo.data().criado_em || agora : agora, atualizado_em: agora });
      return res(200, { ok: true, id });
    }

    if (acao === 'apagar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Imóvel inválido.' });
      await imoveis.doc(id).delete();
      return res(200, { ok: true });
    }

    if (acao === 'processo') {
      const t = tribunalDoProcesso(body.numero);
      if (!t) return res(400, { error: 'Número de processo inválido. Use o formato 0000000-00.0000.0.00.0000 (de tribunal estadual, federal ou do trabalho).' });
      const chave = str(env.DATAJUD_API_KEY, 200) || DATAJUD_CHAVE;
      let r;
      try {
        r = await fetchFn(`https://api-publica.datajud.cnj.jus.br/api_publica_${t.alias}/_search`, {
          method: 'POST',
          headers: { Authorization: 'APIKey ' + chave, 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: t.numero } } }),
        });
      } catch { return res(502, { error: 'A consulta do CNJ não respondeu. Tente de novo.' }); }
      if (!r.ok) return res(502, { error: 'A consulta do CNJ não respondeu. Tente de novo.' });
      const j = await r.json().catch(() => ({}));
      const hit = j && j.hits && Array.isArray(j.hits.hits) && j.hits.hits[0];
      if (!hit) return res(200, { ok: true, processo: null, tribunal: t.alias, aviso: 'Processo não encontrado na base pública do CNJ (processo em segredo de justiça ou ainda não enviado pelo tribunal). Consulte no site do tribunal.' });
      return res(200, { ok: true, processo: resumirProcesso(hit._source || {}) });
    }

    if (acao === 'analisar' || acao === 'parecer') {
      if (!iaPermitida(slug + ':' + quem, now())) return res(429, { error: 'Muitas análises nesta hora. Espere um pouco e tente de novo.' });
      const router = getRouter();
      const FREE = getFree();
      if (acao === 'parecer') {
        const dados = JSON.stringify({ imovel: limparValor(body.imovel), conta: limparValor(body.conta) }).slice(0, 20000);
        const out = await perguntarIa({ router, FREE, system: PEDIDO_PARECER, conteudo: dados, maxTokens: 900, now });
        if (!out) return res(503, { error: 'A IA grátis está ocupada agora. Tente de novo em instantes.' });
        return res(200, { ok: true, texto: out.texto.trim(), modelo: out.modelo });
      }
      const tipo = body.tipo === 'matricula' ? 'matricula' : 'edital';
      const texto = str(body.texto, TEXTO_MAX + 1);
      let imagens = [];
      if (Array.isArray(body.imagens)) {
        for (const im of body.imagens.slice(0, IMAGENS_MAX)) {
          const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(im || ''));
          if (!m || m[2].length > IMAGEM_MAX) return res(400, { error: 'Imagem inválida ou grande demais.' });
          imagens.push({ mime: m[1], data: m[2] });
        }
      }
      if (texto.length < 200 && !imagens.length) return res(400, { error: 'Não consegui ler o documento. Envie o PDF do edital ou da matrícula, ou cole o texto.' });
      const conteudo = (tipo === 'edital' ? 'EDITAL:\n' : 'MATRÍCULA:\n') + (texto ? texto.slice(0, TEXTO_MAX) : '(o documento está nas imagens)');
      const out = await perguntarIa({ router, FREE, system: tipo === 'edital' ? PEDIDO_EDITAL : PEDIDO_MATRICULA, conteudo, imagens, maxTokens: 2500, now });
      if (!out) return res(503, { error: 'A IA grátis está ocupada agora. Tente de novo em instantes.' });
      const dados = extrairJson(out.texto);
      if (!dados) return res(502, { error: 'A IA não devolveu uma análise legível. Tente de novo.' });
      return res(200, { ok: true, tipo, dados: limparValor(dados), modelo: out.modelo, cortado: texto.length > TEXTO_MAX });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.tribunalDoProcesso = tribunalDoProcesso;
exports.extrairJson = extrairJson;
exports.modelosGratis = modelosGratis;
