const { github__list_issues, github__list_pulls, github__commit_files } = require('../../nexia-ai/tool-gateway/tools/github');
const fs = require('fs');
const path = require('path');

async function atualizaEstado() {
  try {
    // Consulta a fila de vagas
    const issues = await github__list_issues({
      repository_id: 'repo_bd8628059cc64b168ef5c0d30d5e675c',
      state: 'open',
      limit: 100
    });

    const pulls = await github__list_pulls({
      repository_id: 'repo_bd8628059cc64b168ef5c0d30d5e675c',
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

    // Sobrescreve o arquivo ESTADO-IA.md
    const filePath = path.join(__dirname, '../../docs/ESTADO-IA.md');
    fs.writeFileSync(filePath, resumo);

    console.log('Estado atualizado com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar estado:', error);
  }
}

atualizaEstado();
  } catch (error) {
    console.error('Erro ao atualizar estado:', error);
  }
}

atualizaEstado();
  } catch (error) {
    console.error('Erro ao atualizar estado:', error);
  }
}

atualizaEstado();
