const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'your-repo-owner';
const REPO_NAME = 'your-repo-name';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function writeState(state) {
  const statePath = path.join(__dirname, '..', 'sentinel', 'estado.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('Estado gravado em sentinel/estado.json');
}

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

async function main() {
  const state = {
    problems: [
      {
        title: 'Problema de exemplo',
        body: `O que aconteceu: Descrição do problema.
Impacto: Descrição do impacto.
Já tentei consertar: Passos que já foram tentados.
O que você faz: Passos exatos para resolver o problema.`,
        status: 'error',
      },
    ],
  };

  await writeState(state);

  for (const problem of state.problems) {
    await createOrUpdateIssue(problem);
  }
}

main().catch(console.error);
