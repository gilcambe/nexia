const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');

// Configurações
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = 'gilcambe';
const REPO_NAME = 'nexia';
const FIREBASE_CONFIG = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'))
  : null;

// Inicializa o Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Inicializa o Firebase
if (FIREBASE_CONFIG) {
  initializeApp({ credential: cert(FIREBASE_CONFIG) });
}

// Função para verificar sites
async function checkSites() {
  const produtosPath = path.join(__dirname, '..', 'central', 'produtos.js');
  const produtos = require(produtosPath);
  const sites = produtos.NO_AR.map(p => p.site).filter(Boolean);

  const results = [];

  for (const site of sites) {
    try {
      const response = await axios.get(`${site}/health`, { timeout: 5000 });
      results.push({ site, status: response.status, ok: response.status === 200 });
    } catch (error) {
      results.push({ site, status: error.response?.status || 'error', ok: false });
    }
  }

  return results;
}

// Função para verificar GitHub Actions
async function checkGitHubActions() {
  try {
    const { data: workflows } = await octokit.actions.listRepoWorkflows({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });

    const results = [];

    for (const workflow of workflows.workflows) {
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        workflow_id: workflow.id,
        status: 'completed',
        conclusion: 'failure',
        per_page: 1,
      });

      if (runs.workflow_runs.length > 0) {
        const run = runs.workflow_runs[0];
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        if (new Date(run.created_at) < twoHoursAgo) {
          results.push({
            workflow: workflow.name,
            runId: run.id,
            createdAt: run.created_at,
            conclusion: run.conclusion,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Erro ao verificar GitHub Actions:', error);
    return [];
  }
}

// Função para verificar Cortex Queue
async function checkCortexQueue() {
  if (!FIREBASE_CONFIG) {
    console.log('Firebase não configurado. Pulando verificação do Cortex Queue.');
    return [];
  }

  try {
    const db = getFirestore();
    const tasksRef = db.collection('tasks');
    const snapshot = await tasksRef.where('status', '==', 'travado').get();

    const results = [];

    snapshot.forEach(doc => {
      const task = doc.data();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      if (new Date(task.updatedAt) < twoHoursAgo) {
        results.push({
          taskId: doc.id,
          status: task.status,
          updatedAt: task.updatedAt,
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Erro ao verificar Cortex Queue:', error);
    return [];
  }
}

// Função para verificar Free AIs
async function checkFreeAIs() {
  // Implementação simplificada para exemplo
  // Em produção, você precisaria de uma implementação real para cada IA gratuita
  const results = [];

  // Exemplo de IAs gratuitas
  const freeAIs = ['groq', 'gemini', 'codestral', 'nvidia', 'workers-ai', 'mistral', 'openrouter-free', 'z-ai', 'llm7', 'ollama'];

  for (const ai of freeAIs) {
    try {
      // Simulação de chamada a uma IA gratuita
      // Em produção, você precisaria de uma implementação real para cada IA
      const response = await axios.post(`https://api.${ai}.com/test`, { prompt: 'test' }, { timeout: 5000 });
      results.push({ ai, status: response.status, ok: response.status === 200 });
    } catch (error) {
      results.push({ ai, status: error.response?.status || 'error', ok: false });
    }
  }

  return results;
}

// Função para verificar Firebase/D1
async function checkFirebaseD1() {
  if (!FIREBASE_CONFIG) {
    console.log('Firebase não configurado. Pulando verificação do Firebase/D1.');
    return { ok: false, message: 'Firebase não configurado' };
  }

  try {
    const db = getFirestore();
    const snapshot = await db.collection('test').limit(1).get();

    if (snapshot.empty) {
      return { ok: true, message: 'Firestore está acessível' };
    } else {
      return { ok: true, message: 'Firestore está acessível com dados' };
    }
  } catch (error) {
    console.error('Erro ao verificar Firebase/D1:', error);
    return { ok: false, message: error.message };
  }
}

// Função para verificar Deploy
async function checkDeploy() {
  try {
    const { data: workflows } = await octokit.actions.listRepoWorkflows({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });

    const deployWorkflow = workflows.workflows.find(w => w.name === 'Deploy Cloudflare');

    if (!deployWorkflow) {
      return { ok: false, message: 'Workflow de deploy não encontrado' };
    }

    const { data: runs } = await octokit.actions.listWorkflowRuns({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      workflow_id: deployWorkflow.id,
      status: 'completed',
      conclusion: 'failure',
      per_page: 1,
    });

    if (runs.workflow_runs.length > 0) {
      const run = runs.workflow_runs[0];
      return { ok: false, message: `Deploy falhou: ${run.html_url}` };
    }

    return { ok: true, message: 'Último deploy foi bem-sucedido' };
  } catch (error) {
    console.error('Erro ao verificar deploy:', error);
    return { ok: false, message: error.message };
  }
}

// Função para consertar problemas
async function fixProblems() {
  // Consertar sites (se necessário)
  // Consertar GitHub Actions
  // Consertar Cortex Queue
  // Consertar Free AIs
  // Consertar Firebase/D1
  // Consertar Deploy
}

// Função principal
async function main() {
  console.log('Iniciando verificação do Sentinel...');

  // Verificar sites
  const sitesResults = await checkSites();
  console.log('Resultados dos sites:', sitesResults);

  // Verificar GitHub Actions
  const githubActionsResults = await checkGitHubActions();
  console.log('Resultados dos GitHub Actions:', githubActionsResults);

  // Verificar Cortex Queue
  const cortexQueueResults = await checkCortexQueue();
  console.log('Resultados do Cortex Queue:', cortexQueueResults);

  // Verificar Free AIs
  const freeAIsResults = await checkFreeAIs();
  console.log('Resultados das Free AIs:', freeAIsResults);

  // Verificar Firebase/D1
  const firebaseD1Results = await checkFirebaseD1();
  console.log('Resultados do Firebase/D1:', firebaseD1Results);

  // Verificar Deploy
  const deployResults = await checkDeploy();
  console.log('Resultados do Deploy:', deployResults);

  // Consertar problemas
  await fixProblems();

  console.log('Verificação do Sentinel concluída.');
}

main().catch(console.error);
