'use strict';
// Central: "Conectar IAs" (#1958). 10 vagas para chaves grátis de IA que ajudam o Cortex quando ele trava.
// A chave passa pelo servidor só uma vez: é testada com uma pergunta curta e, se responder, vira segredo do
// GitHub Actions (IA_VAGA_N, criptografado com a chave pública do repositório). Nunca volta para a página,
// nunca vai para o Firestore nem para log. O que fica guardado (provedor, último teste) está numa issue de estado.
// Quem usa as vagas: .github/workflows/cortex-reserva.yml (degrau entre o Jules e o Claude, cloudflare/jules-auto.js).

const nacl = require('tweetnacl');
const { blake2b } = require('blakejs');
const { redactSecrets } = require('../../../nexia-ai/vault/secrets');

// 10 vagas: cada uma é um segredo listado um a um nos workflows (cortex-reserva.yml e ia-vagas.yml).
const VAGAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const segredo = (n) => `IA_VAGA_${n}`;
const ROTULO_ESTADO = 'ia-vagas-estado';

// Só provedores com plano grátis de API (regra do dono: nada pago). modelo = o que o teste usa.
const PROVEDORES = {
  gemini: { nome: 'Google Gemini', router: 'google', modelo: 'gemini-2.5-flash', env: 'GEMINI_API_KEY', site: 'https://aistudio.google.com/apikey', logo: '/central/logos/gemini.svg',
    passos: ['Abra aistudio.google.com/apikey e entre com sua conta Google.', 'Toque em "Create API key" e copie.'] },
  groq: { nome: 'Groq', router: 'groq', modelo: 'llama-3.3-70b-versatile', env: 'GROQ_API_KEY', site: 'https://console.groq.com/keys',
    passos: ['Abra console.groq.com/keys e entre com o Google.', 'Toque em "Create API Key" e copie.'] },
  openrouter: { nome: 'OpenRouter (modelos grátis)', router: 'openrouter', modelo: 'auto:1', env: 'OPENROUTER_API_KEY', site: 'https://openrouter.ai/settings/keys',
    passos: ['Abra openrouter.ai e entre com o Google (não pede cartão).', 'Em Keys, toque em "Create Key" e copie.'] },
  mistral: { nome: 'Mistral', router: 'mistral', modelo: 'mistral-small-latest', env: 'MISTRAL_API_KEY', site: 'https://console.mistral.ai/api-keys',
    passos: ['Abra console.mistral.ai, entre e escolha o plano "Experiment" (grátis).', 'Em API Keys, crie uma chave e copie.'] },
  cerebras: { nome: 'Cerebras', router: 'cerebras', modelo: 'llama-3.3-70b', env: 'CEREBRAS_API_KEY', site: 'https://cloud.cerebras.ai/platform',
    passos: ['Abra cloud.cerebras.ai e entre (grátis).', 'Em API Keys, crie uma chave e copie.'] },
  codestral: { nome: 'Codestral (Mistral, código)', router: 'codestral', modelo: 'codestral-latest', env: 'CODESTRAL_API_KEY', site: 'https://console.mistral.ai/codestral',
    passos: ['Abra console.mistral.ai/codestral e entre (grátis).', 'Gere a chave do Codestral e copie.'] },
  nvidia: { nome: 'NVIDIA', router: 'nvidia', modelo: 'meta/llama-3.3-70b-instruct', env: 'NVIDIA_API_KEY', site: 'https://build.nvidia.com/settings/api-keys', logo: '/central/logos/nvidia.svg',
    passos: ['Abra build.nvidia.com e entre (grátis).', 'Em API Keys, toque em "Generate API Key" e copie.'] },
};

/** Lista para a página: nada de chave aqui, só nome, site e passos. */
const provedoresPublicos = () => Object.entries(PROVEDORES).map(([id, p]) => ({ id, nome: p.nome, site: p.site, logo: p.logo || null, passos: p.passos }));

const limpar = (t) => redactSecrets(String(t || '')).replace(/(key|token)=\S+/gi, '$1=***').slice(0, 140);

function classificar(motivo) {
  if (/\b429\b|quota|cota|rate.?limit|exhausted/i.test(motivo)) return 'sem-cota';
  if (/\b40[13]\b|invalid|unauthori|forbidden|api key|incorrect/i.test(motivo)) return 'recusada';
  return 'erro';
}

// Conferência direta da chave (#1958): um GET simples no serviço, sem depender de modelo nem do roteador.
// 200 = chave boa; 401/403 (ou API_KEY_INVALID do Google) = recusada; 429 = cota. NVIDIA não tem GET com chave: vai pela conversa.
const CONFERIR = {
  gemini: (k) => ({ url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=' + encodeURIComponent(k), headers: {} }),
  groq: (k) => ({ url: 'https://api.groq.com/openai/v1/models', headers: { Authorization: 'Bearer ' + k } }),
  openrouter: (k) => ({ url: 'https://openrouter.ai/api/v1/key', headers: { Authorization: 'Bearer ' + k } }),
  mistral: (k) => ({ url: 'https://api.mistral.ai/v1/models', headers: { Authorization: 'Bearer ' + k } }),
  cerebras: (k) => ({ url: 'https://api.cerebras.ai/v1/models', headers: { Authorization: 'Bearer ' + k } }),
};

async function conferirDireto(provedor, chave, fetchImpl, ms) {
  const { url, headers } = CONFERIR[provedor](chave);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const t0 = Date.now();
  try {
    const r = await fetchImpl(url, { method: 'GET', headers: { ...headers, 'User-Agent': 'kernex-central' }, signal: ctl.signal });
    const tempo = Date.now() - t0;
    if (r.ok) return { situacao: 'ok', tempo };
    const corpo = (await r.text().catch(() => '')).slice(0, 400);
    const nome = PROVEDORES[provedor].nome;
    if (r.status === 401 || r.status === 403 || /API_KEY_INVALID|invalid api key|invalid_api_key/i.test(corpo)) return { situacao: 'recusada', tempo, motivo: `${nome} recusou a chave (${r.status}).` };
    if (r.status === 429) return { situacao: 'sem-cota', tempo, motivo: `${nome}: cota de hoje acabou (429).` };
    return { situacao: 'erro', tempo, motivo: `${nome} respondeu ${r.status}.` };
  } catch (e) {
    return { situacao: 'erro', tempo: Date.now() - t0, motivo: ctl.signal.aborted ? `${PROVEDORES[provedor].nome} demorou mais de ${ms / 1000} s.` : `Sem conexão com ${PROVEDORES[provedor].nome} agora.` };
  } finally { clearTimeout(timer); }
}

/** Confere a chave (GET direto; NVIDIA manda "Responda só: ok"). Devolve { situacao: ok|sem-cota|recusada|erro, tempo, motivo? }. */
async function testarChave(provedor, chave, { createRouter = require('../../../nexia-ai/model-router').createRouter, fetchImpl, ms = 15000 } = {}) {
  const p = PROVEDORES[provedor];
  if (!p) return { situacao: 'erro', tempo: 0, motivo: 'Provedor não aceito.' };
  const f = fetchImpl || ((...a) => fetch(...a));
  if (CONFERIR[provedor]) {
    const r = await conferirDireto(provedor, chave, f, ms);
    return r.motivo ? { ...r, motivo: limpar(r.motivo).split(chave).join('***') } : r;
  }
  const router = createRouter({ env: { [p.env]: chave }, fetchImpl: f });
  const t0 = Date.now();
  let timer;
  try {
    const out = await Promise.race([
      router.chat({ provider: p.router, model: p.modelo }, { messages: [{ role: 'user', content: 'Responda só: ok' }], maxTokens: 8 }),
      new Promise((_, n) => { timer = setTimeout(() => n(new Error(`demorou mais de ${ms / 1000} s`)), ms); }),
    ]);
    return { situacao: 'ok', tempo: Date.now() - t0, resposta: limpar(out && out.text).slice(0, 40) };
  } catch (e) {
    const motivo = limpar(e && (e.message || e)).split(chave).join('***');
    return { situacao: classificar(motivo), tempo: Date.now() - t0, motivo };
  } finally { clearTimeout(timer); }
}

/** "Sealed box" do libsodium (o formato que o GitHub exige para segredos), com tweetnacl + blake2b. */
function selar(texto, chavePublicaB64) {
  const pk = Uint8Array.from(Buffer.from(chavePublicaB64, 'base64'));
  const efemera = nacl.box.keyPair();
  const juntas = new Uint8Array(64); juntas.set(efemera.publicKey, 0); juntas.set(pk, 32);
  const nonce = blake2b(juntas, undefined, 24);
  const cifrado = nacl.box(new TextEncoder().encode(texto), nonce, pk, efemera.secretKey);
  const out = new Uint8Array(32 + cifrado.length); out.set(efemera.publicKey, 0); out.set(cifrado, 32);
  return Buffer.from(out).toString('base64');
}

const SEM_PERMISSAO = 'A chave do GitHub que a Central usa (NEXIA_JOBS_TOKEN) não pode gravar segredos. No GitHub, dê a ela a permissão "Secrets: Read and write" do repositório nexia.';

/** Grava a vaga como segredo do Actions. O valor é "provedor:chave" (o robô de reserva separa os dois). */
async function gravarSegredo(gh, n, provedor, chave) {
  let pub;
  try { pub = await gh('/actions/secrets/public-key'); } catch (e) { throw new Error(e.status === 403 || e.status === 404 ? SEM_PERMISSAO : 'O GitHub não respondeu agora.'); }
  try {
    await gh(`/actions/secrets/${segredo(n)}`, { method: 'PUT', body: JSON.stringify({ encrypted_value: selar(`${provedor}:${chave}`, pub.key), key_id: pub.key_id }) });
  } catch (e) { throw new Error(e.status === 403 || e.status === 404 ? SEM_PERMISSAO : 'O GitHub não aceitou gravar agora.'); }
}

// Estado (sem chave): bloco JSON no corpo de uma issue fechada com o rótulo ia-vagas-estado.
const BLOCO = /```json\n([\s\S]*?)\n```/;
async function lerEstado(gh) {
  const lista = await gh(`/issues?state=all&labels=${ROTULO_ESTADO}&per_page=1`).catch(() => []);
  const issue = Array.isArray(lista) ? lista[0] : null;
  let dados = {};
  try { dados = issue ? JSON.parse((String(issue.body || '').match(BLOCO) || [])[1] || '{}') : {}; } catch { dados = {}; }
  return { issue: issue ? issue.number : null, vagas: dados.vagas || {} };
}
function corpoEstado(vagas) {
  return 'Estado das vagas de IA da Central (Conectar IAs, #1958). Escrito pela Central e pelo robô ia-vagas.yml. Sem chaves aqui.\n\n```json\n' + JSON.stringify({ vagas }, null, 1) + '\n```';
}
async function gravarEstado(gh, mudar) {
  const atual = await lerEstado(gh);
  const vagas = { ...atual.vagas };
  mudar(vagas);
  const body = corpoEstado(vagas);
  if (atual.issue) await gh(`/issues/${atual.issue}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  else {
    const nova = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: 'Estado das vagas de IA (Central)', body, labels: [ROTULO_ESTADO] }) });
    await gh(`/issues/${nova.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) }).catch(() => null);
  }
  return vagas;
}

/** Prova de uso: PRs do robô de reserva dizem qual vaga respondeu ("Aplicado pela conta vaga-2-groq"). */
function provasDeUso(prs) {
  const out = [];
  for (const p of prs || []) {
    if (!String((p.head && p.head.ref) || '').startsWith('nexia/reserva-')) continue;
    const m = String(p.body || '').match(/conta vaga-(\d+)-([a-z]+)/);
    if (!m) continue;
    const tarefa = (String(p.body || '').match(/Fecha #(\d+)/) || [])[1];
    out.push({ vaga: Number(m[1]), provedor: m[2], pr: p.number, link: p.html_url, tarefa: tarefa ? Number(tarefa) : null, quando: p.created_at, entrou: !!p.merged_at });
  }
  return out.slice(0, 10);
}

/** GET ?parte=vagas: o que a tela mostra. */
async function estado(gh) {
  const [nomes, est, prs] = await Promise.all([
    gh('/actions/secrets?per_page=100').then((r) => (r.secrets || [])).catch(() => null),
    lerEstado(gh),
    gh('/pulls?state=all&per_page=40&sort=created&direction=desc').catch(() => []),
  ]);
  const usos = provasDeUso(prs);
  const vagas = VAGAS.map((n) => {
    const s = nomes ? nomes.find((x) => x.name === segredo(n)) : null;
    const e = est.vagas[n] || {};
    const ligada = nomes ? !!s : !!e.provedor;
    return { vaga: n, ligada, provedor: ligada ? e.provedor || null : null, salvaEm: s ? s.updated_at : e.salvaEm || null, teste: ligada ? e.teste || null : null, usos: usos.filter((u) => u.vaga === n) };
  });
  return { vagas, provedores: provedoresPublicos(), podeLerSegredos: nomes !== null };
}

/** POST vaga-salvar: testa e só grava se a IA respondeu (ou se só acabou a cota de hoje: a chave é boa). */
async function salvar(gh, { vaga, provedor, chave }, deps = {}) {
  const n = Number(vaga);
  const k = String(chave || '').trim();
  if (!VAGAS.includes(n)) return { status: 400, corpo: { error: 'Vaga inválida (use de 1 a 10).' } };
  if (!PROVEDORES[provedor]) return { status: 400, corpo: { error: 'Escolha uma das IAs grátis da lista.' } };
  if (k.length < 16 || k.length > 300 || /\s/.test(k)) return { status: 400, corpo: { error: 'Essa chave não parece certa. Copie de novo, sem espaços.' } };
  const teste = await testarChave(provedor, k, deps);
  const em = new Date().toISOString();
  if (teste.situacao === 'recusada') {
    return { status: 200, corpo: { ok: false, teste, mensagem: `${teste.motivo} Confira se copiou a chave inteira, ou crie outra.` } };
  }
  await gravarSegredo(gh, n, provedor, k);
  // Sem conexão daqui (o servidor não alcançou o serviço): salva assim mesmo e o robô ia-vagas.yml testa pelo GitHub.
  const guardado = teste.situacao === 'erro' ? null : { ...teste, em, onde: 'central' };
  await gravarEstado(gh, (v) => { v[n] = { provedor, salvaEm: em, teste: guardado }; }).catch(() => null);
  if (!guardado && deps.rodarRobo) await deps.rodarRobo().catch(() => null);
  const nome = PROVEDORES[provedor].nome;
  const mensagem = teste.situacao === 'ok' ? `Vaga ${n} ligada: ${nome} aceitou a chave em ${(teste.tempo / 1000).toFixed(1)} s.`
    : teste.situacao === 'sem-cota' ? `Vaga ${n} salva. A chave é boa, mas a cota de hoje acabou; volta amanhã sozinha.`
      : `Vaga ${n} salva. Daqui não deu para testar (${teste.motivo}); o robô do GitHub testa em 1 ou 2 minutos.`;
  return { status: 200, corpo: { ok: true, teste, mensagem } };
}

async function apagar(gh, { vaga }) {
  const n = Number(vaga);
  if (!VAGAS.includes(n)) return { status: 400, corpo: { error: 'Vaga inválida.' } };
  try { await gh(`/actions/secrets/${segredo(n)}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) throw new Error(e.status === 403 ? SEM_PERMISSAO : 'O GitHub não respondeu agora.'); }
  await gravarEstado(gh, (v) => { delete v[n]; }).catch(() => null);
  return { status: 200, corpo: { ok: true, mensagem: `Vaga ${n} desligada e chave apagada.` } };
}

module.exports = { VAGAS, PROVEDORES, segredo, provedoresPublicos, testarChave, selar, lerEstado, gravarEstado, corpoEstado, provasDeUso, estado, salvar, apagar, classificar, ROTULO_ESTADO, SEM_PERMISSAO };
