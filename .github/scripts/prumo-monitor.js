#!/usr/bin/env node
'use strict';
// Monitor de saúde do Kernex Finance (Prumo) (#3134 / #3170)
// Verifica a cada execução os endpoints do Prumo:
// - GET https://nexia.gcbezerra.workers.dev/prumo/ (espera 200)
// - GET https://nexia.gcbezerra.workers.dev/api/prumo (espera 200 ou 405)
//
// Ao detectar 2 falhas consecutivas:
// - Abre ou comenta na issue "Kernex Finance fora do ar" com hora e código HTTP.
// - Associa o rótulo "cortex-alerta".
// Quando o serviço volta a responder:
// - Fecha a issue aberta com aviso de recuperação.

const BASE_DEFAULT = 'https://nexia.gcbezerra.workers.dev';
const TITULO_ALERTA = 'Kernex Finance fora do ar';
const ROTULO_ALERTA = 'cortex-alerta';

/**
 * Faz requisição HTTP com timeout.
 */
async function checarUrl(url, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { 'User-Agent': 'nexia-prumo-monitor/1.0' },
      signal: controller.signal,
    });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, erro: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Avalia os endpoints principais do Prumo.
 */
async function verificarEndpoints({ baseUrl = BASE_DEFAULT, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const urlBaseLimpa = baseUrl.replace(/\/+$/, '');
  const urlApp = `${urlBaseLimpa}/prumo/`;
  const urlApi = `${urlBaseLimpa}/api/prumo`;

  const [resApp, resApi] = await Promise.all([
    checarUrl(urlApp, { fetchImpl, timeoutMs }),
    checarUrl(urlApi, { fetchImpl, timeoutMs }),
  ]);

  // Regras de aceite:
  // - /prumo/ deve responder 200
  // - /api/prumo pode responder 200 ou 405 (já que GET na API devolve "Use POST.")
  const appOk = resApp.ok && resApp.status === 200;
  const apiOk = resApi.ok && (resApi.status === 200 || resApi.status === 405);
  const saudavel = appOk && apiOk;

  return {
    saudavel,
    detalhes: {
      app: { url: urlApp, status: resApp.status, ok: appOk, erro: resApp.erro },
      api: { url: urlApi, status: resApi.status, ok: apiOk, erro: resApi.erro },
    },
  };
}

/**
 * Cliente GitHub simplificado.
 */
function criarClienteGH({ token, repo, fetchImpl = fetch }) {
  const apiBase = `https://api.github.com/repos/${repo}`;

  async function requisitar(caminho, init = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nexia-prumo-monitor',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body) headers['Content-Type'] = 'application/json';

    const res = await fetchImpl(apiBase + caminho, { ...init, headers });
    if (res.status === 204) return {};
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(dados.message || `GitHub HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return dados;
  }

  return {
    async buscarIssueAlerta() {
      const issues = await requisitar(`/issues?state=open&labels=${encodeURIComponent(ROTULO_ALERTA)}&per_page=50`);
      if (!Array.isArray(issues)) return null;
      return issues.find((i) => !i.pull_request && (i.title || '').trim().toLowerCase() === TITULO_ALERTA.toLowerCase()) || null;
    },
    async abrirIssue({ titulo, corpo, labels }) {
      return requisitar('/issues', {
        method: 'POST',
        body: JSON.stringify({ title: titulo, body: corpo, labels }),
      });
    },
    async comentarIssue(issueNumber, corpo) {
      return requisitar(`/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: corpo }),
      });
    },
    async fecharIssue(issueNumber) {
      return requisitar(`/issues/${issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
    },
    async listarExecucoesWorkflow(workflowId = 'prumo-monitor.yml') {
      try {
        const dados = await requisitar(`/actions/workflows/${workflowId}/runs?per_page=5`);
        return Array.isArray(dados.workflow_runs) ? dados.workflow_runs : [];
      } catch {
        return [];
      }
    },
  };
}

/**
 * Extrai a contagem de falhas a partir dos comentários da issue ou do contexto.
 */
function contarFalhasEmComentarios(comentarios = []) {
  let contagem = 1;
  for (const c of comentarios) {
    const match = /Falha consecutiva #?(\d+)/i.exec(c.body || '');
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= contagem) contagem = n + 1;
    }
  }
  return contagem;
}

/**
 * Executa a lógica do monitor.
 */
async function monitorarPrumo({
  baseUrl = BASE_DEFAULT,
  env = process.env,
  fetchImpl = fetch,
  agora = new Date(),
  falhasPrevias = null,
} = {}) {
  const token = env.GITHUB_TOKEN || '';
  const repo = env.GITHUB_REPOSITORY || 'gilcambe/nexia';
  const gh = criarClienteGH({ token, repo, fetchImpl });

  const resultado = await verificarEndpoints({ baseUrl, fetchImpl });
  const dataHoraIso = (agora instanceof Date ? agora : new Date(agora)).toISOString();

  let issueAlerta = null;
  if (token) {
    try {
      issueAlerta = await gh.buscarIssueAlerta();
    } catch (e) {
      console.warn(`Aviso: falha ao buscar issues: ${e.message}`);
    }
  }

  if (resultado.saudavel) {
    if (issueAlerta) {
      const msgFechamento = `✅ **Kernex Finance restabelecido** em ${dataHoraIso}.\n\n`
        + `- App: \`${resultado.detalhes.app.url}\` (HTTP ${resultado.detalhes.app.status})\n`
        + `- API: \`${resultado.detalhes.api.url}\` (HTTP ${resultado.detalhes.api.status})\n\n`
        + `Fechando alerta automaticamente.`;
      if (token) {
        await gh.comentarIssue(issueAlerta.number, msgFechamento);
        await gh.fecharIssue(issueAlerta.number);
      }
      return { acao: 'fechou_alerta', issue: issueAlerta.number, saudavel: true };
    }
    return { acao: 'ok', saudavel: true };
  }

  // Falha detectada
  const appStatus = resultado.detalhes.app.status;
  const apiStatus = resultado.detalhes.api.status;
  const resumoStatus = `Hora: ${dataHoraIso} | App HTTP ${appStatus} | API HTTP ${apiStatus}`;

  // Se já há issue aberta, apenas registra novo comentário de falha consecutiva
  if (issueAlerta) {
    if (token) {
      const corpoComentario = `⚠️ **Persistência de falha no Kernex Finance**\n\n`
        + `- ${resumoStatus}\n`
        + `- Erro App: ${resultado.detalhes.app.erro || 'nenhum'}\n`
        + `- Erro API: ${resultado.detalhes.api.erro || 'nenhum'}`;
      await gh.comentarIssue(issueAlerta.number, corpoComentario);
    }
    return { acao: 'comentou_falha', issue: issueAlerta.number, saudavel: false };
  }

  // Se não há issue aberta: precisa conferir se é a 2ª falha consecutiva
  // Se falhasPrevias foi injetado (testes/parâmetro), usa-o diretamente.
  // Senão, checa o histórico de execuções do workflow no GitHub Actions.
  let consecutivas = 1;
  if (typeof falhasPrevias === 'number') {
    consecutivas = falhasPrevias + 1;
  } else if (token) {
    const runs = await gh.listarExecucoesWorkflow('prumo-monitor.yml');
    // Se a última execução concluída (excluindo a atual se em andamento) falhou, soma
    const concluidas = runs.filter((r) => r.status === 'completed');
    if (concluidas.length > 0 && concluidas[0].conclusion === 'failure') {
      consecutivas = 2;
    }
  }

  if (consecutivas >= 2) {
    let novaIssue = null;
    const corpo = `## ⚠️ Kernex Finance fora do ar\n\n`
      + `Detectadas **${consecutivas} falhas consecutivas** no monitoramento.\n\n`
      + `- **Data e hora:** ${dataHoraIso}\n`
      + `- **App (${resultado.detalhes.app.url}):** HTTP ${appStatus} ${resultado.detalhes.app.ok ? '✅' : '❌'}\n`
      + `- **API (${resultado.detalhes.api.url}):** HTTP ${apiStatus} ${resultado.detalhes.api.ok ? '✅' : '❌'}\n\n`
      + `_Alerta gerado automaticamente pelo workflow de monitoramento do Prumo._`;

    if (token) {
      novaIssue = await gh.abrirIssue({
        titulo: TITULO_ALERTA,
        corpo,
        labels: [ROTULO_ALERTA],
      });
    }
    return { acao: 'abriu_alerta', issue: novaIssue ? novaIssue.number : null, consecutivas, saudavel: false };
  }

  // 1ª falha isolada: registra nos logs e encerra sem abrir issue (aguardando 2ª falha consecutiva)
  console.log(`[Prumo Monitor] 1ª falha detectada (${resumoStatus}). Aguardando confirmação na próxima rodada.`);
  return { acao: 'primeira_falha', consecutivas: 1, saudavel: false };
}

if (require.main === module) {
  monitorarPrumo()
    .then((res) => {
      console.log('Resultado da verificação:', JSON.stringify(res));
      if (!res.saudavel) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error('Erro na execução do monitor:', err);
      process.exitCode = 1;
    });
}

module.exports = {
  checarUrl,
  verificarEndpoints,
  criarClienteGH,
  contarFalhasEmComentarios,
  monitorarPrumo,
  TITULO_ALERTA,
  ROTULO_ALERTA,
  BASE_DEFAULT,
};
