'use strict';
// NEXIA Divulga: Vigia do Divulga (divulga/vigia.js)
// Monitora a saúde das publicações lendo divulga-estado.json no ramo divulga-dados via API do GitHub.
// Detecta erros recorrentes (2 falhas seguidas na mesma rede ou nenhuma publicação com sucesso em 30h)
// e abre/fecha issues com rótulo "cortex-alerta".

const { decodificarBase64 } = require('../netlify/functions/central/github');

function exibeExplicacaoErro(msg) {
  const m = String(msg || '');
  if (/\b190\b|invalid access token|expired/i.test(m)) {
    return 'rode de novo o configurar-meta.bat';
  }
  if (/\b(4|17|32)\b|rate limit|too many/i.test(m)) {
    return 'espera sozinho';
  }
  if (/mídia|media|imagem|formato|dimension|aspect ratio/i.test(m)) {
    return 'imagem fora do padrão';
  }
  return 'verifique as credenciais e o formato da publicação';
}

function sanitizeError(msg) {
  if (typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  return msg
    .replace(/(access_token|token|password|secret)=[^&\s]+/gi, '$1=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***')
    .slice(0, 200);
}

async function vigiarDivulga({
  env = process.env,
  fetchImpl = fetch,
  agora = Date.now(),
} = {}) {
  const token = env.GITHUB_TOKEN || env.NEXIA_JOBS_TOKEN || '';
  const repo = env.GITHUB_REPOSITORY || 'gilcambe/nexia';
  const apiBase = `https://api.github.com/repos/${repo}`;

  async function gh(path, init = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nexia-divulga-vigia',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchImpl(apiBase + path, { ...init, headers });
    const json = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(json.message || `GitHub HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return json;
  }

  // 1. Lê o estado do divulga-dados via API do GitHub
  let estado = { historico: [] };
  try {
    const arq = await gh('/contents/divulga-estado.json?ref=divulga-dados');
    const texto = arq && typeof arq.content === 'string' ? decodificarBase64(arq.content) : null;
    if (texto) estado = JSON.parse(texto);
  } catch (e) {
    console.log(`[Vigia Divulga] Não foi possível ler divulga-estado.json (${e.message})`);
  }

  const historico = Array.isArray(estado.historico) ? estado.historico : [];

  // 2. Busca issues abertas com o rótulo cortex-alerta
  let issuesAbertas = [];
  try {
    const res = await gh('/issues?state=open&labels=cortex-alerta&per_page=100');
    if (Array.isArray(res)) issuesAbertas = res;
  } catch (e) {
    console.log(`[Vigia Divulga] Não foi possível consultar issues (${e.message})`);
  }

  const redes = ['facebook', 'instagram', 'pinterest', 'bluesky', 'threads'];
  const alertasParaAbrir = new Map(); // rede -> { motivo, erro }
  const redesOperacionais = new Set();

  // Verifica se há alguma publicação bem-sucedida em qualquer rede nas últimas 30 horas
  const ha30Horas = 30 * 3600 * 1000;
  const teveSucessoGeral30h = historico.some((h) => {
    const dataPost = new Date(h.quando || 0).getTime();
    return agora - dataPost <= ha30Horas && Array.isArray(h.resultados) && h.resultados.some((r) => r.ok);
  });

  for (const rede of redes) {
    // Coleta posts que continham resultado para essa rede (em ordem cronológica)
    const postsRede = historico.filter((h) => Array.isArray(h.resultados) && h.resultados.some((r) => r.canal === rede));
    if (!postsRede.length) continue;

    const ultimosDois = postsRede.slice(-2);
    const ultimoPost = postsRede[postsRede.length - 1];
    const resUltimo = (ultimoPost.resultados || []).find((r) => r.canal === rede);

    if (resUltimo && resUltimo.ok) {
      redesOperacionais.add(rede);
      continue;
    }

    // Erro em 2 rodadas seguidas
    if (ultimosDois.length >= 2) {
      const r1 = (ultimosDois[0].resultados || []).find((r) => r.canal === rede);
      const r2 = (ultimosDois[1].resultados || []).find((r) => r.canal === rede);
      if (r1 && !r1.ok && r2 && !r2.ok) {
        alertasParaAbrir.set(rede, {
          motivo: '2 falhas seguidas de publicação',
          erro: r2.erro || r1.erro || 'Falha na publicação',
        });
        continue;
      }
    }

    // Sem publicação com sucesso nas últimas 30 h
    if (!teveSucessoGeral30h) {
      alertasParaAbrir.set(rede, {
        motivo: 'Nenhuma publicação com sucesso nas últimas 30 horas',
        erro: (resUltimo && resUltimo.erro) || 'Nenhuma publicação recente com sucesso',
      });
    }
  }

  // 3. Processa e fecha issues de redes que voltaram a funcionar
  for (const issue of issuesAbertas) {
    const titulo = issue.title || '';
    const m = /^Divulga parado:\s*(\w+)/i.exec(titulo);
    if (!m) continue;
    const rede = m[1].toLowerCase();

    if (redesOperacionais.has(rede)) {
      const comentario = `A rede **${rede}** voltou a publicar com sucesso. Fechando o alerta.`;
      await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: comentario }) });
      await gh(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      console.log(`[Vigia Divulga] Issue #${issue.number} fechada (${rede} operando).`);
    }
  }

  // 4. Abre issues para novos alertas que ainda não possuem issue aberta
  for (const [rede, info] of alertasParaAbrir.entries()) {
    const tituloAlerta = `Divulga parado: ${rede}`;
    const jaExiste = issuesAbertas.some((i) => (i.title || '').trim().toLowerCase() === tituloAlerta.toLowerCase());
    if (jaExiste) continue;

    const erroLimpo = sanitizeError(info.erro);
    const explicacao = exibeExplicacaoErro(erroLimpo);

    const corpoIssue = `A publicação do Divulga na rede **${rede}** está parada.

**Motivo:** ${info.motivo}
**Último erro capturado:** \`${erroLimpo}\`
**Orientação:** ${explicacao}

_Alerta automático gerado pelo Vigia do Divulga (divulga/vigia.js)._`;

    const novaIssue = await gh('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: tituloAlerta,
        body: corpoIssue,
        labels: ['cortex-alerta'],
      }),
    });
    console.log(`[Vigia Divulga] Issue #${novaIssue.number} criada para ${rede}.`);
  }
}

module.exports = { vigiarDivulga, exibeExplicacaoErro, sanitizeError };

if (require.main === module) {
  vigiarDivulga().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
