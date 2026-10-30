const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.NEXIA_REPO_OWNER || 'gilcambe';
const REPO_NAME = process.env.NEXIA_REPO_NAME || 'nexia';
const BASE_URL = process.env.NEXIA_BASE_URL || 'https://nexia.gcbezerra.workers.dev';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Função para gravar estado
async function writeState(state) {
  const statePath = path.join(__dirname, '..', 'sentinel', 'estado.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('Estado gravado em sentinel/estado.json');
}

// Função para criar ou atualizar issue
async function createOrUpdateIssue(problem) {
  const { title, body, status } = problem;
  const label = 'sentinel';

  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: label,
      state: 'all',
    });

    const existingIssue = issues.find(issue => issue.title === title);

    if (existingIssue) {
      if (status === 'ok') {
        await octokit.issues.update({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          issue_number: existingIssue.number,
          state: 'closed',
        });
        console.log(`Issue #${existingIssue.number} fechada.`);
      } else {
        await octokit.issues.createComment({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          issue_number: existingIssue.number,
          body: `Atualização: ${body}`,
        });
        console.log(`Comentário adicionado à issue #${existingIssue.number}.`);
      }
    } else {
      const { data: newIssue } = await octokit.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title,
        body,
        labels: [label],
      });
      console.log(`Nova issue criada: #${newIssue.number}`);
    }
  } catch (error) {
    console.error('Erro ao gerenciar issue:', error);
  }
}

// 1. Checagem de Sites
async function checkSitesHealth() {
  console.log('Iniciando checagem de sites...');
  const produtosPath = path.join(__dirname, '..', 'central', 'produtos.js');
  const produtos = require(produtosPath);
  const sites = produtos.NO_AR || [];
  const problems = [];

  for (const site of sites) {
    try {
      const healthUrl = site.site.endsWith('/') ? site.site + 'health' : site.site + '/health';
      const response = await fetch(healthUrl, { timeout: 5000 });
      
      if (response.status !== 200) {
        problems.push({
          title: `Site ${site.nome} com status ${response.status}`,
          body: `URL: ${site.site}\nEndpoint /health retornou status ${response.status}`,
          status: 'error'
        });
      } else {
        console.log(`✅ Site ${site.nome} saudável`);
      }
    } catch (error) {
      problems.push({
        title: `Site ${site.nome} inacessível`,
        body: `URL: ${site.site}\nErro: ${error.message}`,
        status: 'error'
      });
    }
  }

  return problems;
}

// 2. Checagem de GitHub Actions
async function checkGitHubActions() {
  console.log('Iniciando checagem de GitHub Actions...');
  const problems = [];
  
  // Lista de workflows importantes para monitorar
  const workflows = [
    'deploy-cloudflare.yml',
    'ci.yml',
    'fila-cortex.yml',
    'divulga.yml',
    'afiliados.yml'
  ];

  for (const workflow of workflows) {
    try {
      // Busca runs falhadas nos últimos 24 horas
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        workflow_id: workflow,
        status: 'failure',
        created: '>=24h'
      });

      if (runs.total_count > 0) {
        console.log(`⚠️ Encontradas ${runs.total_count} runs falhadas para ${workflow}`);
        
        // Tenta rerun apenas uma vez para cada run falhada
        for (const run of runs.workflow_runs) {
          try {
            await octokit.actions.createWorkflowRunDispatch({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              workflow_id: workflow,
              ref: 'develop'
            });
            console.log(`✅ Disparado rerun para run #${run.id}`);
          } catch (error) {
            console.error(`❌ Falha ao disparar rerun para run #${run.id}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar workflow ${workflow}:`, error.message);
    }
  }

  return problems;
}

// 3. Checagem de Cortex Queue
async function checkCortexQueue() {
  console.log('Iniciando checagem de Cortex Queue...');
  const problems = [];
  
  try {
    // Busca tasks travadas por mais de 2 horas
    const { data: tasks } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'cortex-fila',
      state: 'open'
    });

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    for (const task of tasks) {
      const createdAt = new Date(task.created_at);
      
      if (createdAt < twoHoursAgo) {
        console.log(`⚠️ Task travada por mais de 2h: #${task.number} - ${task.title}`);
        
        // Aplica lógica de ESCADA-IA
        try {
          // Marca flag 'vez-do-claude'
          const flagPath = path.join(__dirname, '..', 'sentinel', 'vez-do-claude.flag');
          fs.writeFileSync(flagPath, JSON.stringify({ 
            task_id: task.number,
            timestamp: now.toISOString(),
            reason: 'task travada por mais de 2h'
          }));
          
          console.log(`✅ Flag 'vez-do-claude' criada para task #${task.number}`);
          
          // Adiciona comentário na task
          await octokit.issues.createComment({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            issue_number: task.number,
            body: `Sentinel detectou task travada por mais de 2h. Atribuindo para Claude.`
          });
          
        } catch (error) {
          console.error(`Erro ao processar task #${task.number}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar Cortex Queue:', error.message);
    problems.push({
      title: 'Falha ao verificar Cortex Queue',
      body: error.message,
      status: 'error'
    });
  }

  return problems;
}

// 4. Checagem de Free AIs
async function checkFreeAIs() {
  console.log('Iniciando checagem de Free AIs...');
  const problems = [];
  
  // Lista de IAs gratuitas para testar
  const freeAIs = [
    { name: 'Gemini', endpoint: `${BASE_URL}/api/models/test/gemini` },
    { name: 'Groq', endpoint: `${BASE_URL}/api/models/test/groq` },
    { name: 'Mistral', endpoint: `${BASE_URL}/api/models/test/mistral` },
    { name: 'DeepSeek', endpoint: `${BASE_URL}/api/models/test/deepseek` }
  ];
  
  let allFailed = true;
  
  for (const ai of freeAIs) {
    try {
      const response = await fetch(ai.endpoint, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' }),
        timeout: 10000
      });
      
      if (response.ok) {
        console.log(`✅ ${ai.name} respondendo`);
        allFailed = false;
      } else {
        console.log(`❌ ${ai.name} retornou status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${ai.name} falhou: ${error.message}`);
    }
  }
  
  // Se todas falharam, marcar flag 'vez-do-claude'
  if (allFailed) {
    try {
      const flagPath = path.join(__dirname, '..', 'sentinel', 'vez-do-claude.flag');
      fs.writeFileSync(flagPath, JSON.stringify({ 
        reason: 'todas as IAs gratuitas falharam',
        timestamp: new Date().toISOString()
      }));
      
      console.log('✅ Flag "vez-do-claude" criada devido à falha de todas as IAs');
      problems.push({
        title: 'Todas as IAs gratuitas falharam',
        body: 'Todas as IAs gratuitas testadas falharam. Flag "vez-do-claude" criada.',
        status: 'error'
      });
    } catch (error) {
      console.error('Erro ao criar flag:', error.message);
    }
  }
  
  return problems;
}

// 5. Checagem de Firebase/D1
async function checkFirebaseD1() {
  console.log('Iniciando checagem de Firebase/D1...');
  const problems = [];
  
  try {
    // Teste de leitura simples no D1
    const response = await fetch(`${BASE_URL}/api/test/d1`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (!response.ok) {
      problems.push({
        title: 'Falha no D1',
        body: `Endpoint de teste do D1 retornou status ${response.status}`,
        status: 'error'
      });
    } else {
      console.log('✅ D1 respondendo');
    }
  } catch (error) {
    problems.push({
      title: 'Falha ao acessar D1',
      body: error.message,
      status: 'error'
    });
  }
  
  return problems;
}

// 6. Checagem de Deploy
async function checkDeployStatus() {
  console.log('Iniciando checagem de Deploy...');
  const problems = [];
  
  try {
    // Busca runs recentes do deploy-cloudflare
    const { data: runs } = await octokit.actions.listWorkflowRuns({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      workflow_id: 'deploy-cloudflare.yml',
      status: 'completed',
      per_page: 10
    });
    
    if (runs.total_count === 0) {
      console.log('Nenhuma run de deploy encontrada');
      return problems;
    }
    
    // Verifica logs de erro 5xx nas últimas runs
    for (const run of runs.workflow_runs) {
      if (run.conclusion === 'failure') {
        console.log(`⚠️ Run de deploy falhada: #${run.id}`);
        
        try {
          // Tenta re-disparar o workflow
          await octokit.actions.createWorkflowRunDispatch({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            workflow_id: 'deploy-cloudflare.yml',
            ref: 'develop'
          });
          
          console.log(`✅ Workflow de deploy re-disparado`);
          
        } catch (error) {
          console.error(`Falha ao re-disparar workflow:`, error.message);
          problems.push({
            title: `Falha ao re-disparar deploy #${run.id}`,
            body: error.message,
            status: 'error'
          });
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar status de deploy:', error.message);
    problems.push({
      title: 'Falha ao verificar status de deploy',
      body: error.message,
      status: 'error'
    });
  }
  
  return problems;
}

// Função principal que executa todas as checagens
async function main() {
  console.log('Iniciando Sentinel - Sistema de Monitoramento');
  
  const allProblems = [];
  
  // Executa todas as checagens
  const siteProblems = await checkSitesHealth();
  allProblems.push(...siteProblems);
  
  const ghProblems = await checkGitHubActions();
  allProblems.push(...ghProblems);
  
  const cortexProblems = await checkCortexQueue();
  allProblems.push(...cortexProblems);
  
  const aiProblems = await checkFreeAIs();
  allProblems.push(...aiProblems);
  
  const firebaseProblems = await checkFirebaseD1();
  allProblems.push(...firebaseProblems);
  
  const deployProblems = await checkDeployStatus();
  allProblems.push(...deployProblems);
  
  // Prepara estado final
  const state = {
    timestamp: new Date().toISOString(),
    problems: allProblems
  };
  
  // Grava estado
  await writeState(state);
  
  // Cria/gerencia issues para problemas
  for (const problem of allProblems) {
    await createOrUpdateIssue(problem);
  }
  
  if (allProblems.length > 0) {
    console.log(`\n🚨 Encontrados ${allProblems.length} problemas`);
  } else {
    console.log('\n✅ Nenhum problema detectado');
  }
  
  process.exit(allProblems.length > 0 ? 1 : 0);
}

// Executa o script
main().catch(error => {
  console.error('Erro crítico no Sentinel:', error);
  process.exit(1);
});
