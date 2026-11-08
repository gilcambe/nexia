#!/usr/bin/env node
'use strict';

/**
 * Monitoramento Kernex Finance (Prumo):
 * Faz GET em https://nexia.gcbezerra.workers.dev/prumo/ e em /api/prumo.
 * Contabiliza falhas consecutivas:
 * - Se detectar falha, realiza uma segunda tentativa consecutiva após breve intervalo
 *   (confirmando 2 falhas consecutivas no mesmo ciclo de monitoramento).
 * - Ao confirmar 2 falhas consecutivas, abre issue "Kernex Finance fora do ar"
 *   com data/hora e código HTTP; se já estiver aberta, adiciona comentário.
 * - Ao restaurar o serviço, fecha a issue com mensagem explicativa.
 */

const REPO = process.env.REPO || 'gilcambe/nexia';
const TITULO_ISSUE = 'Kernex Finance fora do ar';
const ROTULO = 'cortex-alerta';

const ENDPOINTS = [
  { id: 'pagina', url: 'https://nexia.gcbezerra.workers.dev/prumo/', aceitos: [200] },
  { id: 'api', url: 'https://nexia.gcbezerra.workers.dev/api/prumo', aceitos: [200, 405] },
];

async function checarEndpoint(ep, fetchImpl = fetch, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ep.url, {
      method: 'GET',
      headers: { 'User-Agent': 'nexia-prumo-monitor' },
      signal: controller.signal,
    });
    const status = res.status;
    const ok = ep.aceitos.includes(status);
    return { id: ep.id, url: ep.url, ok, status };
  } catch (err) {
    const status = err.name === 'AbortError' ? 'timeout' : 'erro_conexao';
    return { id: ep.id, url: ep.url, ok: false, status, erro: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function verificarEndpoints(endpoints = ENDPOINTS, fetchImpl = fetch) {
  const resultados = await Promise.all(endpoints.map((ep) => checarEndpoint(ep, fetchImpl)));
  const falhas = resultados.filter((r) => !r.ok);
  return {
    ok: falhas.length === 0,
    resultados,
    falhas,
  };
}

function criarCorpoAlerta(falhas, agoraIso = new Date().toISOString()) {
  const linhas = falhas.map(
    (f) => `- **${f.url}**: status HTTP \`${f.status}\`${f.erro ? ` (${f.erro})` : ''}`
  );
  return [
    `⚠️ **Alerta de Indisponibilidade: Kernex Finance**`,
    '',
    `Data/Hora: ${agoraIso}`,
    '',
    'Falhas detectadas:',
    ...linhas,
    '',
    'Este alerta foi disparado após 2 ou mais falhas consecutivas de verificação.',
    'A issue será encerrada automaticamente assim que os serviços responderem com sucesso.',
  ].join('\n');
}

function criarCorpoResolvido(agoraIso = new Date().toISOString()) {
  return [
    `✅ **Kernex Finance Restabelecido**`,
    '',
    `Data/Hora: ${agoraIso}`,
    '',
    'Todos os endpoints responderam com sucesso na verificação mais recente.',
    'Encerrando issue de monitoramento.',
  ].join('\n');
}

async function processarMonitoramento({
  estadoAnterior = 0,
  verificacao,
  aberta = null,
  agoraIso = new Date().toISOString(),
  gh = null,
}) {
  const falhou = !verificacao.ok;
  const falhasConsecutivas = falhou ? estadoAnterior + 1 : 0;
  const acoes = [];

  if (falhou) {
    if (falhasConsecutivas >= 2) {
      if (!aberta) {
        if (gh) {
          await gh.criarIssue({
            title: TITULO_ISSUE,
            body: criarCorpoAlerta(verificacao.falhas, agoraIso),
            labels: [ROTULO],
          });
        }
        acoes.push('issue_criada');
      } else {
        if (gh) {
          await gh.comentarIssue(
            aberta.number,
            `Serviço continua indisponível em ${agoraIso}.\n` +
              verificacao.falhas.map((f) => `- ${f.url}: ${f.status}`).join('\n')
          );
        }
        acoes.push('issue_comentada');
      }
    } else {
      acoes.push('falha_registrada');
    }
  } else {
    if (aberta) {
      if (gh) {
        await gh.comentarIssue(aberta.number, criarCorpoResolvido(agoraIso));
        await gh.fecharIssue(aberta.number);
      }
      acoes.push('issue_fechada');
    } else {
      acoes.push('ok');
    }
  }

  return {
    falhasConsecutivas,
    acoes,
    aberta: aberta ? aberta.number : null,
  };
}

function criarClienteGitHub(token, repo = REPO, fetchImpl = fetch) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'nexia-prumo-monitor',
    'Content-Type': 'application/json',
  };

  return {
    async buscarIssueAberta() {
      const url = `${base}/issues?state=open&labels=${ROTULO}&per_page=50`;
      const r = await fetchImpl(url, { headers });
      if (!r.ok) throw new Error(`Falha ao buscar issues: HTTP ${r.status}`);
      const issues = await r.json();
      return issues.find((i) => i.title === TITULO_ISSUE) || null;
    },
    async criarIssue({ title, body, labels }) {
      const r = await fetchImpl(`${base}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels }),
      });
      if (!r.ok) throw new Error(`Falha ao criar issue: HTTP ${r.status}`);
      return r.json();
    },
    async comentarIssue(numero, body) {
      const r = await fetchImpl(`${base}/issues/${numero}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error(`Falha ao comentar issue: HTTP ${r.status}`);
      return r.json();
    },
    async fecharIssue(numero) {
      const r = await fetchImpl(`${base}/issues/${numero}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
      if (!r.ok) throw new Error(`Falha ao fechar issue: HTTP ${r.status}`);
      return r.json();
    },
  };
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(deps = {}) {
  const token = deps.token || process.env.GITHUB_TOKEN;
  const repo = deps.repo || process.env.REPO || REPO;
  const fetchImpl = deps.fetchImpl || fetch;
  const gh = token ? (deps.gh || criarClienteGitHub(token, repo, fetchImpl)) : (deps.gh || null);

  const aberta = gh ? await gh.buscarIssueAberta() : null;

  // 1ª checagem dos endpoints
  let verificacao = await verificarEndpoints(ENDPOINTS, fetchImpl);
  let falhasConsecutivas = verificacao.ok ? 0 : 1;

  // Se a primeira checagem falhou, realiza a segunda checagem consecutiva
  // para confirmar se o serviço está realmente fora do ar antes de abrir issue
  if (!verificacao.ok) {
    const intervaloMs = Number(deps.intervaloRechecagemMs ?? (process.env.RECHECAGEM_MS || 5000));
    if (intervaloMs > 0) {
      await esperar(intervaloMs);
    }
    const segundaChecagem = await verificarEndpoints(ENDPOINTS, fetchImpl);
    if (!segundaChecagem.ok) {
      falhasConsecutivas = 2;
      verificacao = segundaChecagem;
    } else {
      // Se na segunda tentativa respondeu, não foi falha persistente
      falhasConsecutivas = 0;
      verificacao = segundaChecagem;
    }
  }

  // Se a issue já estava aberta e o serviço continua fora do ar, conta >= 2
  if (aberta && !verificacao.ok) {
    falhasConsecutivas = Math.max(falhasConsecutivas, 2);
  }

  const estadoAnterior = falhasConsecutivas >= 2 ? 1 : 0;
  const resultado = await processarMonitoramento({
    estadoAnterior,
    verificacao,
    aberta,
    agoraIso: new Date().toISOString(),
    gh,
  });

  console.log(JSON.stringify({ verificacao, resultado }, null, 2));
  return { verificacao, resultado };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Erro na execução do prumo-monitor:', err);
    process.exit(1);
  });
}

module.exports = {
  TITULO_ISSUE,
  ROTULO,
  ENDPOINTS,
  checarEndpoint,
  verificarEndpoints,
  criarCorpoAlerta,
  criarCorpoResolvido,
  processarMonitoramento,
  criarClienteGitHub,
  main,
};
