#!/usr/bin/env node
'use strict';
// Vigia do fluxo (11/11/2026, regra do dono: "o fluxo nunca pode parar").
// A cada ciclo: execuções que FALHARAM por problema de AMBIENTE (rede, espelho do Ubuntu, instalação, máquina
// desligada) são repetidas UMA vez, sozinhas. Falha de código não é repetida (o teste decide).
// Nunca repete publicação em produção. Uso: GH_TOKEN=... node scripts/vigia-fluxo.js
const REPO = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const NUNCA = /deploy|publica|produ[cç][aã]o|release/i;          // produção nunca é repetida sozinha
const AMBIENTE = [
  /Temporary failure resolving/i, /Could not resolve host/i, /Installation process exited with code/i,
  /Unable to fetch some archives/i, /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i,
  /The runner has received a shutdown signal/i, /lost communication with the server/i,
  /npm (?:ERR!|error) (?:code )?(?:E5\d\d|ETARGET|EINTEGRITY)/i, /502 Bad Gateway|503 Service Unavailable|504 Gateway/i,
  /Failed to download action|Unable to download artifact/i,
];
const MAX_POR_CICLO = 15;

/** Função pura: o log mostra problema de ambiente? */
function eAmbiente(log) { const t = String(log || ''); return AMBIENTE.some(re => re.test(t)); }
/** Função pura: esta execução pode ser repetida pelo vigia? */
function podeRepetir(run, agora = Date.now()) {
  if (!run || run.conclusion !== 'failure') return false;
  if ((run.run_attempt || 1) > 1) return false;                  // só uma repetição automática
  if (NUNCA.test(run.name || '')) return false;
  return agora - Date.parse(run.updated_at || run.created_at) < 3 * 3600e3;
}

async function gh(method, rota, { texto = false } = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${rota}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } });
  if (texto) return { status: r.status, texto: r.ok ? await r.text() : '' };
  let j = null; try { j = await r.json(); } catch { /* vazio */ }
  return { status: r.status, json: j };
}

async function main() {
  if (!TOKEN) { console.error('GH_TOKEN obrigatório'); process.exit(2); }
  const runs = ((await gh('GET', '/actions/runs?status=failure&per_page=60')).json || {}).workflow_runs || [];
  const candidatas = runs.filter(r => podeRepetir(r));
  let repetidas = 0, codigo = 0;
  for (const run of candidatas) {
    if (repetidas >= MAX_POR_CICLO) break;
    const jobs = ((await gh('GET', `/actions/runs/${run.id}/jobs?filter=latest`)).json || {}).jobs || [];
    let ambiente = false;
    for (const j of jobs.filter(j => j.conclusion === 'failure')) {
      const l = await gh('GET', `/actions/jobs/${j.id}/logs`, { texto: true });
      if (eAmbiente(l.texto.slice(-200000))) { ambiente = true; break; }
    }
    if (!ambiente) { codigo++; continue; }
    if (process.env.VIGIA_SIMULAR === '1') { console.log(`(simulação) repetiria: ${run.name} #${run.id} (${run.head_branch})`); repetidas++; continue; }
    const r = await gh('POST', `/actions/runs/${run.id}/rerun-failed-jobs`);
    console.log(`${r.status === 201 ? 'repetida' : 'não repetiu (' + r.status + ')'}: ${run.name} #${run.id} (${run.head_branch})`);
    if (r.status === 201) repetidas++;
  }
  const linha = `Vigia do fluxo: ${candidatas.length} falhas recentes; ${repetidas} repetidas por ambiente; ${codigo} de código (o teste decide, não repito).`;
  console.log(linha);
  if (process.env.GITHUB_STEP_SUMMARY) require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${linha}\n`);
}

module.exports = { eAmbiente, podeRepetir };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
