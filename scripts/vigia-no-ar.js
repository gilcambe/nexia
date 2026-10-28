'use strict';

const { NO_AR } = require('../central/produtos.js');

// Estado de falhas consecutivas por site (memória da execução).
const falhasConsecutivas = {};

// Issues já abertas pelo vigia (evita duplicatas).
const issuesAbertas = new Set();

const TIMEOUT_MS = 10000;
const MAX_TENTATIVAS = 3;
const LIMITE_ROLLBACK = 2;

// Funções injetáveis para testes (substituídas pelo teste unitário).
let fetchHttp = globalThis.fetch;
let executarRollback = null;
let abrirIssueGitHub = null;
let fecharIssueGitHub = null;
let listarIssuesGitHub = null;

function setInjetaveis({ fetch: f, rollback, abrirIssue, fecharIssue, listarIssues } = {}) {
  if (f) fetchHttp = f;
  if (rollback) executarRollback = rollback;
  if (abrirIssue) abrirIssueGitHub = abrirIssue;
  if (fecharIssue) fecharIssueGitHub = fecharIssue;
  if (listarIssues) listarIssuesGitHub = listarIssues;
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

async function requisitarComTentativas(url) {
  let ultimoErro;
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    try {
      const resposta = await Promise.race([
        fetchHttp(url),
        timeoutPromise(TIMEOUT_MS),
      ]);
      if (resposta && resposta.ok) {
        return true;
      }
      ultimoErro = new Error(`HTTP ${resposta && resposta.status ? resposta.status : 'erro'}`);
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}

function ehWorkersDev(url) {
  return url.includes('workers.dev');
}

function ehPagesDev(url) {
  return url.includes('pages.dev');
}

async function rollbackSite(url) {
  if (ehWorkersDev(url)) {
    if (executarRollback) {
      return executarRollback(url, 'workers');
    }
    // Fallback: chama wrangler rollback (apenas nome, não executa de verdade em teste).
    return { tipo: 'wrangler', url, acao: 'rollback' };
  }
  if (ehPagesDev(url)) {
    if (executarRollback) {
      return executarRollback(url, 'pages');
    }
    return { tipo: 'cloudflare-pages', url, acao: 'rollback' };
  }
  return null;
}

async function issueJaAberta() {
  if (listarIssuesGitHub) {
    const issues = await listarIssuesGitHub();
    return issues.some((i) => i.titulo === 'cortex-alerta' && i.estado === 'aberta');
  }
  return issuesAbertas.has('cortex-alerta');
}

async function abrirIssueAlerta(url, falhas) {
  if (await issueJaAberta()) {
    return { jaExistia: true };
  }
  const corpo = `Site ${url} falhou ${falhas} vezes seguidas. Rollback disparado.`;
  if (abrirIssueGitHub) {
    const issue = await abrirIssueGitHub('cortex-alerta', corpo);
    issuesAbertas.add('cortex-alerta');
    return issue;
  }
  issuesAbertas.add('cortex-alerta');
  return { titulo: 'cortex-alerta', corpo, url };
}

async function fecharIssueAlerta() {
  if (!issuesAbertas.has('cortex-alerta')) {
    return { jaEstavaFechada: true };
  }
  if (fecharIssueGitHub) {
    await fecharIssueGitHub('cortex-alerta');
  }
  issuesAbertas.delete('cortex-alerta');
  return { fechada: true };
}

async function verificarSite(produto) {
  const { site, id } = produto;
  if (!site) {
    return { id, site: null, status: 'sem-site' };
  }
  try {
    await requisitarComTentativas(site);
    // Voltou ao normal.
    if (falhasConsecutivas[id] >= LIMITE_ROLLBACK) {
      falhasConsecutivas[id] = 0;
      await fecharIssueAlerta();
    }
    return { id, site, status: 'ok', falhas: 0 };
  } catch (erro) {
    falhasConsecutivas[id] = (falhasConsecutivas[id] || 0) + 1;
    const falhas = falhasConsecutivas[id];
    if (falhas >= LIMITE_ROLLBACK) {
      await rollbackSite(site);
      await abrirIssueAlerta(site, falhas);
    }
    return { id, site, status: 'falha', falhas, erro: String(erro && erro.message ? erro.message : erro) };
  }
}

async function vigiar() {
  const resultados = [];
  for (const produto of NO_AR) {
    resultados.push(await verificarSite(produto));
  }
  return resultados;
}

module.exports = {
  vigiar,
  verificarSite,
  requisitarComTentativas,
  rollbackSite,
  abrirIssueAlerta,
  fecharIssueAlerta,
  setInjetaveis,
  falhasConsecutivas,
  issuesAbertas,
  LIMITE_ROLLBACK,
};
