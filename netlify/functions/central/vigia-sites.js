'use strict';
// Vigia dos endereços públicos (#1014): roda junto com a amostra de saúde de hora em hora (cloudflare/saude.js).
// - Usa as medidas da hora (sites de central/produtos.js + página inicial e Central) e mede também os
//   endereços Kernex. Endereço Kernex que nunca respondeu é ignorado (domínio ainda em ligação).
// - Guarda o último resultado (ok, código, tempo) de cada endereço no doc saude_vigia/estado
//   (1 leitura + 1 escrita por hora; as amostras por hora continuam em saude_horas).
// - Se o mesmo endereço falhar 2 vezes seguidas, abre UMA issue "Site fora do ar: URL" com o rótulo
//   cortex-alerta (não repete se já há uma aberta para a mesma URL). Sem NEXIA_JOBS_TOKEN, só guarda.
const COLECAO = 'saude_vigia';
const DOC = 'estado';
const REPO = 'gilcambe/nexia';
const ROTULO = 'cortex-alerta';
const KERNEX_ROTAS = [
  { id: 'kernex-site', nome: 'Kernex (site)', url: 'https://kernex.com.br', kernex: true },
  { id: 'kernex-bodycoach', nome: 'Kernex Body Coach', url: 'https://bodycoach.kernex.com.br', kernex: true },
  { id: 'kernex-cortex', nome: 'Kernex Cortex', url: 'https://cortex.kernex.com.br', kernex: true },
];

const tituloAlerta = (url) => `Site fora do ar: ${url}`;

/** Decide o novo estado e os alertas. Puro (sem rede): medidas = { [id]: { ok, codigo, tempo } }. */
function avaliar({ estado = {}, medidas = {}, rotas = [], em = new Date().toISOString() }) {
  const novo = { ...estado };
  const alertas = [];
  for (const r of rotas) {
    const m = medidas[r.id];
    if (!m) continue;
    const ant = estado[r.id] || { falhas: 0, jaRespondeu: false };
    const ok = !!m.ok;
    const jaRespondeu = !!ant.jaRespondeu || ok;
    const falhas = ok ? 0 : (Number(ant.falhas) || 0) + 1;
    novo[r.id] = { url: r.url, ok, codigo: Number(m.codigo) || 0, tempo: Math.round(Number(m.tempo) || 0), em, falhas, jaRespondeu };
    if (r.kernex && !jaRespondeu) continue; // domínio Kernex ainda não ligado
    if (falhas === 2) alertas.push({ id: r.id, nome: r.nome, url: r.url, codigo: Number(m.codigo) || 0 });
  }
  return { estado: novo, alertas };
}

async function abrirAlerta(alerta, { token, fetchImpl = (...a) => fetch(...a) }) {
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'nexia-vigia', 'X-GitHub-Api-Version': '2022-11-28' };
  const lista = await fetchImpl(`https://api.github.com/repos/${REPO}/issues?state=open&labels=${ROTULO}&per_page=100`, { headers: h });
  const abertas = lista.ok ? await lista.json() : null;
  if (!Array.isArray(abertas)) return 'erro-lista';
  if (abertas.some((i) => i && i.title === tituloAlerta(alerta.url))) return 'ja-aberta';
  const corpo = [
    `O endereço ${alerta.url} (${alerta.nome}) falhou 2 vezes seguidas (de hora em hora). Último código: ${alerta.codigo || 'sem resposta'}.`,
    '',
    'O que fazer: abra o endereço no celular. Se não abrir, veja o Cloudflare (Workers e Pages) e a Central → Sistema.',
    'Feche esta issue quando o site voltar.',
  ].join('\n');
  const r = await fetchImpl(`https://api.github.com/repos/${REPO}/issues`, { method: 'POST', headers: h, body: JSON.stringify({ title: tituloAlerta(alerta.url), body: corpo, labels: [ROTULO] }) });
  return r.status === 201 ? 'aberta' : `erro-${r.status}`;
}

/** Junta as medidas da hora com as dos endereços Kernex, guarda o estado e abre os alertas. */
async function vigiar(db, { at = Date.now(), porRota = {}, rotas = [], medir, env = process.env, fetchImpl } = {}) {
  if (!db) return { skipped: 'sem banco' };
  const medidas = { ...porRota };
  if (typeof medir === 'function') {
    for (const [id, m] of await Promise.all(KERNEX_ROTAS.map(async (r) => [r.id, await medir(r.url)]))) medidas[id] = m;
  }
  const ref = db.collection(COLECAO).doc(DOC);
  const snap = await ref.get();
  const estadoAntes = (snap.exists && snap.data() && snap.data().rotas) || {};
  const { estado, alertas } = avaliar({ estado: estadoAntes, medidas, rotas: [...rotas, ...KERNEX_ROTAS], em: new Date(at).toISOString() });
  await ref.set({ em: new Date(at).toISOString(), rotas: estado });
  const abertos = [];
  if (alertas.length && env.NEXIA_JOBS_TOKEN) {
    for (const a of alertas) {
      try { abertos.push(`${a.id}:${await abrirAlerta(a, { token: env.NEXIA_JOBS_TOKEN, fetchImpl })}`); } catch (e) { abertos.push(`${a.id}:erro`); }
    }
  }
  return { vigiados: Object.keys(estado).length, alertas: alertas.map((a) => a.id), abertos };
}

module.exports = { KERNEX_ROTAS, COLECAO, avaliar, abrirAlerta, vigiar, tituloAlerta };
