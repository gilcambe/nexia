const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? 'gilcambe';
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? 'nexia';
const STATE_BRANCH = 'cortex-dados';
const STATE_PATH = 'sentinel/estado.json';

if (!GITHUB_TOKEN || typeof GITHUB_TOKEN !== 'string' || !GITHUB_TOKEN.trim()) {
  throw new Error('GITHUB_TOKEN não está definido. Defina a variável de ambiente GITHUB_TOKEN antes de executar o script.');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN.trim() });

const CAMPOS_OBRIGATORIOS = [
  'O que aconteceu:',
  'Impacto:',
  'Já tentei consertar:',
  'O que você faz:',
];

function validarProblema(problem) {
  if (!problem || typeof problem !== 'object' || Array.isArray(problem)) {
    throw new Error('Problema inválido: esperado um objeto.');
  }
  const { title, body, status } = problem;
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Problema inválido: "title" é obrigatório e deve ser uma string não vazia.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('Problema inválido: "body" é obrigatório e deve ser uma string não vazia.');
  }
  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (!body.includes(campo)) {
      throw new Error(`Problema inválido: o corpo da issue deve conter o campo "${campo}".`);
    }
  }
  if (status !== undefined && status !== 'ok' && status !== 'error') {
    throw new Error('Problema inválido: "status" deve ser "ok" ou "error".');
  }
  return { title: title.trim(), body, status: status || 'error' };
}

function corpoTemCamposObrigatorios(body) {
  return CAMPOS_OBRIGATORIOS.every(campo => body.includes(campo));
}

async function getBranchRefSha(branch) {
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${branch}`,
    });
    return ref.object.sha;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function ensureBranch(branch, fromBranch) {
  const fromSha = await getBranchRefSha(fromBranch);
  if (!fromSha) {
    throw new Error(`Não foi possível encontrar a branch de origem "${fromBranch}".`);
  }
  const exists = await getBranchRefSha(branch);
  if (!exists) {
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branch}`,
      sha: fromSha,
    });
    console.log(`Branch "${branch}" criada a partir de "${fromBranch}".`);
  }
  return await getBranchRefSha(branch);
}

async function getFileContentOnBranch(branch, filePath) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      ref: branch,
    });
    if (Array.isArray(data)) {
      throw new Error(`O caminho ${filePath} é uma pasta, não um arquivo.`);
    }
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { content, sha: data.sha };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function writeStateToGitHub(state, branch, filePath) {
  const content = JSON.stringify(state, null, 2);
  await ensureBranch(branch, 'develop');
  const existing = await getFileContentOnBranch(branch, filePath);

  const payload = {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    branch,
    message: `sentinel: atualiza ${filePath}`,
    content: Buffer.from(content).toString('base64'),
  };
  if (existing) {
    payload.sha = existing.sha;
  }

  const { data: commit } = await octokit.repos.createOrUpdateFileContents(payload);
  console.log(`Estado gravado em ${filePath} no branch "${branch}" (commit ${commit.commit.sha.slice(0, 7)}).`);
  return commit.commit.sha;
}

async function verificarEscoposToken() {
  try {
    const { headers } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });
    const scopes = (headers['x-oauth-scopes'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const necessarios = ['repo', 'issues', 'contents'];
    const faltando = necessarios.filter(escopo => !scopes.includes(escopo));
    if (faltando.length) {
      throw new Error(
        `Token do GitHub sem escopos necessários: ${faltando.join(', ')}. ` +
        `Escopos encontrados: ${scopes.length ? scopes.join(', ') : '(nenhum)'}.`
      );
    }
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      throw new Error(
        `Token do GitHub inválido ou sem acesso ao repositório ${REPO_OWNER}/${REPO_NAME}: ${error.message}`
      );
    }
    throw error;
  }
}

async function createOrUpdateIssue(problem) {
  const { title, body, status } = validarProblema(problem);
  const label = 'sentinel';

  try {
    const issues = await octokit.paginate(octokit.issues.listForRepo, {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: label,
      state: 'all',
      per_page: 100,
    });

    const existingIssue = issues.find(issue => issue.title === title);

    if (existingIssue) {
      if (status === 'ok') {
        if (existingIssue.state === 'open') {
          await octokit.issues.update({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            issue_number: existingIssue.number,
            state: 'closed',
          });
          console.log(`Issue #${existingIssue.number} fechada (problema voltou ao normal).`);
        } else {
          console.log(`Issue #${existingIssue.number} já está fechada.`);
        }
      } else if (corpoTemCamposObrigatorios(body)) {
        await octokit.issues.createComment({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          issue_number: existingIssue.number,
          body: `Atualização:

${body}`,
        });
        console.log(`Comentário adicionado à issue #${existingIssue.number}.`);
      } else {
        throw new Error(`Não foi possível comentar na issue #${existingIssue.number}: o corpo não contém os campos obrigatórios.`);
      }
    } else {
      if (!corpoTemCamposObrigatorios(body)) {
        throw new Error(`Não foi possível criar issue para "${title}": o corpo não contém os campos obrigatórios.`);
      }
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
    const detalhe = error && error.response ? ` (status ${error.response.status})` : '';
    throw new Error(`Falha ao gerenciar issue "${title}":${detalhe} ${error.message}`);
  }
}

function lerProblemasDeEntrada() {
  const arg = process.argv.slice(2).find(a => a.startsWith('--problemas='));
  const env = process.env.SENTINEL_PROBLEMS;
  let raw = null;
  if (arg) {
    raw = arg.slice('--problemas='.length);
  } else if (env) {
    raw = env;
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('A entrada de problemas deve ser um array JSON.');
    return parsed.map(p => validarProblema(p));
  } catch (error) {
    throw new Error(`Falha ao ler problemas de entrada: ${error.message}`);
  }
}

async function main() {
  let state;
  try {
    const problemas = lerProblemasDeEntrada();
    state = { problems: problemas, atualizado_em: new Date().toISOString() };
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  try {
    await verificarEscoposToken();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  try {
    await writeStateToGitHub(state, STATE_BRANCH, STATE_PATH);
  } catch (error) {
    console.error(`Falha ao gravar estado no GitHub: ${error.message}`);
    process.exit(1);
  }

  let falhou = false;
  for (const problem of state.problems) {
    try {
      await createOrUpdateIssue(problem);
    } catch (error) {
      console.error(error.message);
      falhou = true;
    }
  }

  if (falhou) process.exit(1);
}

main().catch(error => {
  console.error(`Erro inesperado: ${error.message}`);
  process.exit(1);
});
