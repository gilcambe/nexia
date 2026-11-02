const { github__list_issues, github__list_pulls, github__commit_files } = require('../../nexia-ai/tool-gateway/tools/github');
const path = require('path');

async function atualizaEstado() {
  try {
    const repository_id = process.env.GITHUB_REPOSITORY_ID || process.env.REPOSITORY_ID || 'repo_bd8628059cc64b168ef5c0d30d5e675c';

    const issues = await github__list_issues({
      repository_id,
      state: 'open',
      limit: 100
    });

    const pulls = await github__list_pulls({
      repository_id,
      state: 'open',
      limit: 100
    });

    const cortexIssues = issues.filter(issue =>
      issue.labels.some(label => label.name === 'cortex-fila')
    );

    const cortexPulls = pulls.filter(pull =>
      pull.labels.some(label => label.name === 'cortex-fila')
    );

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    let resumo = `# Estado do projeto e memória (para qualquer IA continuar)\n\n`;
    resumo += `Atualizado em ${dataAtual}.\n\n`;
    resumo += `## Fila do Cortex (${dataAtual})\n\n`;
    resumo += `### Issues abertas (${cortexIssues.length}):\n`;
    cortexIssues.forEach(issue => {
      resumo += `- ${issue.title} (#${issue.number})\n`;
    });

    resumo += `\n### Pull Requests abertos (${cortexPulls.length}):\n`;
    cortexPulls.forEach(pull => {
      resumo += `- ${pull.title} (#${pull.number})\n`;
    });

    const branchAtual = process.env.GITHUB_REF_NAME || 'develop';
    await github__commit_files({
      repository_id,
      branch: branchAtual,
      message: 'Atualiza docs/ESTADO-IA.md via script atualizaEstado.js',
      files: [
        {
          path: 'docs/ESTADO-IA.md',
          content: resumo
        }
      ]
    });

    console.log('Estado atualizado com sucesso!');
    console.log(`Resumo gerado com ${cortexIssues.length} issues e ${cortexPulls.length} PRs.`);
  } catch (error) {
    console.error('Erro ao atualizar estado:', error);
    // O bloco try/catch deve conter toda a lógica de atualização para garantir o tratamento de erros.
  }
}

if (require.main === module) {
  atualizaEstado();
}

module.exports = { atualizaEstado };
