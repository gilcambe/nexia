'use strict';
// Robô ia-vagas.yml (#1958): testa as chaves guardadas nas vagas IA_VAGA_1..10 (botão "Testar agora" da Central e 1x por dia)
// e grava só o resultado (nunca a chave) na issue de estado que a Central lê.
const vagas = require('../netlify/functions/central/ia-vagas');

function lerVaga(valor) {
  const v = String(valor || '').trim();
  const i = v.indexOf(':');
  if (i < 1) return null;
  const provedor = v.slice(0, i);
  return vagas.PROVEDORES[provedor] ? { provedor, chave: v.slice(i + 1) } : null;
}

async function rodar(env = process.env, deps = {}) {
  const repo = env.GITHUB_REPOSITORY || 'gilcambe/nexia';
  const fetchFn = deps.fetch || fetch;
  const gh = deps.gh || (async (caminho, init = {}) => {
    const r = await fetchFn(`https://api.github.com/repos/${repo}${caminho}`, { ...init, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    return corpo;
  });
  const em = new Date().toISOString();
  const resultados = {};
  console.log('🪜 Degrau 1 – escrito por vaga-7-nvidia');
  for (const n of vagas.VAGAS) {
    const v = lerVaga(env[vagas.segredo(n)]);
    if (!v) continue;
    resultados[n] = { provedor: v.provedor, teste: { ...(await vagas.testarChave(v.provedor, v.chave, deps)), em, onde: 'robo' } };
    console.log(`Vaga ${n} (${v.provedor}): ${resultados[n].teste.situacao}`);
  }
  await vagas.gravarEstado(gh, (atual) => {
    for (const n of vagas.VAGAS) {
      if (resultados[n]) atual[n] = { ...(atual[n] || {}), ...resultados[n] };
      else delete atual[n];
    }
  });
  return resultados;
}

if (require.main === module) rodar().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { rodar, lerVaga };
