'use strict';
// Central NEXIA /escada: estatísticas de issues para o dono (só master).
// GET /api/escada  → { semana, percentCortex, fila, julesHoje, julesLimite, cota, faseB }
// Usa o token do servidor (NEXIA_GITHUB_TOKEN) para ler as issues do repositório.

async function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const getGithub = deps.getGithub || (() => require('./central/github').criarGithub());
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || ((...a) => fetch(...a));

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET') return res(405, { error: 'Method Not Allowed' });

    const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
    if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA abre o escada.' });

    try {
      const gh = getGithub();
      const owner = env.GITHUB_REPO_OWNER || 'gilcambe';
      const repo = env.GITHUB_REPO || 'nexia';

      // Lista as issues abertas do repositório (token do servidor)
      const issues = await gh.api('/issues?state=open&per_page=100');

      const agora = new Date();
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() - agora.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 7);

      const semana = issues.filter((i) => {
        const criado = new Date(i.created_at || 0);
        return criado >= inicioSemana && criado < fimSemana;
      }).length;

      // percentCortex: issues com label cortex-fila entre as abertas
      const totalAbertas = issues.length;
      const comCortex = issues.filter((i) => (i.labels || []).some((l) => String(l.name || l).includes('cortex'))).length;
      const percentCortex = totalAbertas > 0 ? Math.round((comCortex / totalAbertas) * 100) : 0;

      // fila: issues com label cortex-fila abertas
      const fila = issues.filter((i) => (i.labels || []).some((l) => String(l.name || l).includes('cortex-fila'))).length;

      // julesHoje: issues fechadas hoje com label jules (busca também fechadas)
      const inicioHoje = new Date(agora);
      inicioHoje.setHours(0, 0, 0, 0);
      const fechadasHoje = await gh.api('/issues?state=closed&per_page=100').catch(() => []);
      const julesHoje = fechadasHoje.filter((i) => {
        const fechado = new Date(i.closed_at || 0);
        return fechado >= inicioHoje && (i.labels || []).some((l) => String(l.name || l).includes('jules'));
      }).length;

      // julesLimite: limite diário de issues jules (fixo em 5)
      const julesLimite = 5;

      // cota: % da cota usada (issues abertas / 50)
      const cota = totalAbertas > 50 ? 100 : Math.round((totalAbertas / 50) * 100);

      // faseB: se há issues com label fase-b abertas
      const faseB = issues.some((i) => (i.labels || []).some((l) => String(l.name || l).includes('fase-b')));

      return res(200, { semana, percentCortex, fila, julesHoje, julesLimite, cota, faseB });
    } catch (e) {
      return res(502, { error: 'Não consegui buscar agora: ' + String(e.message || e).slice(0, 160) });
    }
  };
}

module.exports = { createHandler };
module.exports.handler = createHandler();
