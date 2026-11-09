'use strict';
// #3284 (parte 2 de #3272): a cada 10 min, procura registros trabalho-ativo parados há mais de 15 min
// e passa os itens pendentes para a fila (Cortex + IAs grátis) no repo de cada item.
const { processarPassagens } = require('../cloudflare/gestor-ia');

function criarGh(token, fetchImpl = globalThis.fetch) {
  return async (caminho, opts = {}) => {
    const r = await fetchImpl('https://api.github.com' + caminho, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'nexia-passagem' },
      body: opts.body,
    });
    const t = await r.text();
    if (!r.ok) { const e = new Error('GitHub ' + r.status + ' em ' + caminho + ': ' + t.slice(0, 200)); e.status = r.status; throw e; }
    return t ? JSON.parse(t) : {};
  };
}

async function rodar({ gh, log = console.log } = {}) {
  if (!gh) { log('Passagem: sem token do GitHub; nada a fazer.'); return { paradas: [], criadas: [], atualizados: [] }; }
  const out = await processarPassagens({ gh });
  log(`Passagem: ${out.paradas.length} parada(s), ${out.criadas.length} issue(s) criada(s).`);
  for (const c of out.criadas) log(`  ${c.repo}#${c.issue} (do registro #${c.de}, item ${c.indice})`);
  return out;
}

async function principal() {
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  try { token = (await require('./cortex-fila').tokenDaApp()) || token; } catch { /* sem App: usa o token do workflow */ }
  await rodar({ gh: token ? criarGh(token) : null });
}

if (require.main === module) principal().catch((e) => { console.error('Passagem falhou:', e.message); process.exit(1); });

module.exports = { criarGh, rodar };
