const { github__list_issues, github__list_pulls, github__commit_files } = require('../../nexia-ai/tool-gateway/tools/github');
const fs = require('fs');
const path = require('path');

async function atualizaEstado() {
  try {
    // Consulta a fila de vagas
    const repository_id = 'repo_9dc1440334294659a71ebed5a8843af7';

    // Consulta a fila de vagas
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

    // Filtra issues com rótulo 'cortex-fila'
    const cortexIssues = issues.filter(issue =>
      issue.labels.some(label => label.name === 'cortex-fila')
    );

    // Filtra PRs com rótulo 'cortex-fila'
    const cortexPulls = pulls.filter(pull =>
      pull.labels.some(label => label.name === 'cortex-fila')
    );

    // Gera o resumo
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

    // Sobrescreve o arquivo ESTADO-IA.md usando github__commit_files
    const branchAtual = process.env.GITHUB_REF_NAME || 'nexia/criar-script-nexia-ai-cron-atualizaestad-110143';
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
    throw error;
  }
}

if (require.main === module) {
  atualizaEstado();
}

module.exports = { atualizaEstado };
