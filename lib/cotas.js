'use strict';
// Orçamento das cotas grátis (#808). Mede o uso de hoje e liga o "freio" perto de 80%:
//  - Pedidos do Worker (100 mil/dia) e neurônios do Workers AI (10 mil/dia): API de Analytics do
//    Cloudflare (GraphQL), com CLOUDFLARE_ANALYTICS_TOKEN (só leitura), o mesmo da Central.
//  - Leituras (50 mil/dia) e escritas (20 mil/dia) do Firestore: Cloud Monitoring com a chave de
//    serviço do Firebase (precisa do papel "Monitoring Viewer"; sem ele, mostra "sem acesso").
// Tudo só leitura e grátis. Sem token, nada é medido e o freio fica desligado (nada muda).

const LIMITES = {
  worker: { nome: 'Pedidos do Worker', limite: 100000 },
  ia: { nome: 'Neurônios do Workers AI', limite: 10000 },
  leituras: { nome: 'Leituras do Firestore', limite: 50000 },
  escritas: { nome: 'Escritas do Firestore', limite: 20000 },
};
const LIMIAR = 0.8;

/** uso = { worker?: n, ia?: n, leituras?: n, escritas?: n } (ausente = não medido). */
function resumir(uso = {}, limiar = LIMIAR) {
  const itens = Object.entries(LIMITES).map(([id, l]) => {
    const usado = typeof uso[id] === 'number' && Number.isFinite(uso[id]) ? Math.max(0, uso[id]) : null;
    return { id, nome: l.nome, limite: l.limite, usado, pct: usado === null ? null : Math.round((usado / l.limite) * 1000) / 10 };
  });
  const perto = itens.filter((i) => i.usado !== null && i.usado >= i.limite * limiar).map((i) => i.id);
  return { itens, perto, frear: perto.length > 0, limiar: Math.round(limiar * 100) };
}

/** O que é opcional desliga quando a cota daquele recurso passa do limiar. */
function deveFrear(resumo, recurso) {
  return !!(resumo && Array.isArray(resumo.perto) && resumo.perto.includes(recurso));
}

const hojeUtc = (agora) => new Date(agora).toISOString().slice(0, 10);

async function medirCloudflare(env, fetchImpl, agora = Date.now()) {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN || '';
  const conta = env.NEXIA_D1_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || '';
  if (!token || !conta) return {};
  const d = hojeUtc(agora);
  const pedir = async (query) => {
    const r = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { a: conta, d } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j.errors && j.errors.length)) return null;
    return (((j.data || {}).viewer || {}).accounts || [])[0] || null;
  };
  const out = {};
  // Duas consultas separadas: se uma não existir na conta, a outra continua valendo.
  const w = await pedir('query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:1000,filter:{date_geq:$d,date_leq:$d}){sum{requests}}}}}').catch(() => null);
  if (w) out.worker = (w.workersInvocationsAdaptive || []).reduce((t, x) => t + (Number((x.sum || {}).requests) || 0), 0);
  const ia = await pedir('query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){aiInferenceAdaptiveGroups(limit:1000,filter:{date_geq:$d,date_leq:$d}){sum{totalNeurons}}}}}').catch(() => null);
  if (ia) out.ia = Math.round((ia.aiInferenceAdaptiveGroups || []).reduce((t, x) => t + (Number((x.sum || {}).totalNeurons) || 0), 0));
  return out;
}

/** Meia-noite do Pacífico (é quando a cota grátis do Firestore zera). */
function inicioDiaPacifico(agora = Date.now()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(agora)).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
  const passou = ((Number(partes.hour) % 24) * 3600 + Number(partes.minute) * 60 + Number(partes.second)) * 1000;
  return new Date(agora - passou - (agora % 1000)).toISOString();
}

async function medirFirestore(env, fetchImpl, agora = Date.now(), getToken) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !getToken) return {};
  let projeto = env.FIREBASE_PROJECT_ID || '';
  let token;
  try {
    if (getToken) token = await getToken();
    else {
      const sa = JSON.parse(Buffer.from(String(env.FIREBASE_SERVICE_ACCOUNT_BASE64), 'base64').toString('utf8'));
      projeto = projeto || sa.project_id;
      token = await require('./firebase-lite/google-auth').createTokenSource(sa, { fetchImpl }).getToken();
    }
  } catch { return { firestoreErro: 'sem chave' }; }
  if (!projeto) return {};
  const ini = inicioDiaPacifico(agora);
  const fim = new Date(agora).toISOString();
  const soma = async (metrica) => {
    const q = new URLSearchParams({
      filter: `metric.type="firestore.googleapis.com/document/${metrica}"`,
      'interval.startTime': ini, 'interval.endTime': fim,
      'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    const r = await fetchImpl(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projeto)}/timeSeries?${q}`, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 403) throw Object.assign(new Error('sem acesso'), { semAcesso: true });
    if (!r.ok) throw new Error('monitoring ' + r.status);
    const j = await r.json().catch(() => ({}));
    let t = 0;
    for (const s of j.timeSeries || []) for (const p of s.points || []) t += Number((p.value || {}).int64Value || 0);
    return t;
  };
  try {
    const [leituras, escritas] = await Promise.all([soma('read_count'), soma('write_count')]);
    return { leituras, escritas };
  } catch (e) { return { firestoreErro: e && e.semAcesso ? 'sem acesso' : 'falhou' }; }
}

async function medir(env = process.env, { fetchImpl = (...a) => fetch(...a), agora = Date.now(), getToken } = {}) {
  const [cf, fs] = await Promise.all([medirCloudflare(env, fetchImpl, agora).catch(() => ({})), medirFirestore(env, fetchImpl, agora, getToken).catch(() => ({}))]);
  const { firestoreErro, ...uso } = { ...cf, ...fs };
  return { ...resumir(uso), ...(firestoreErro ? { firestoreErro } : {}), em: new Date(agora).toISOString() };
}

// Freio com memória de 10 min por instância (para não consultar a API a cada pedido).
let memo = { ate: 0, resumo: null };
const _resetMemo = () => { memo = { ate: 0, resumo: null }; };
async function freio(env, recurso, o = {}) {
  if (!env || !env.CLOUDFLARE_ANALYTICS_TOKEN) return false;
  const agora = o.agora || Date.now();
  if (agora >= memo.ate) {
    const doCloudflare = recurso === 'worker' || recurso === 'ia';
    const r = doCloudflare
      ? resumir(await medirCloudflare(env, o.fetchImpl || ((...a) => fetch(...a)), agora).catch(() => ({})))
      : await medir(env, { ...o, agora }).catch(() => null);
    memo = { ate: agora + 10 * 60e3, resumo: r };
  }
  return deveFrear(memo.resumo, recurso);
}

module.exports = { LIMITES, LIMIAR, resumir, deveFrear, medir, medirCloudflare, medirFirestore, inicioDiaPacifico, freio, _resetMemo };
