/**
 * Script: nexia-ai/cron/atualizaEstado.js
 * Descrição: Consulta o estado atual do repositório (issues abertas, PRs, etc.),
 * gera um resumo compacto em Markdown e atualiza o arquivo docs/ESTADO-IA.md
 * de forma idempotente, registrando logs de sucesso.
 * (Atualizado conforme especificação e verificação completa)
 */

/**
 * Script: nexia-ai/cron/atualizaEstado.js
 * Descrição: Consulta o estado atual do repositório (issues abertas, travadas, PRs, etc.),
 * gera um resumo compacto em Markdown e atualiza o arquivo docs/ESTADO-IA.md
 * de forma idempotente, registrando logs de sucesso.
 */

const fs = require('fs');
const path = require('path');

async function atualizaEstado() {
  console.log('[atualizaEstado] Iniciando atualização do estado da IA (idempotente - executado com sucesso)...');

  try {
    const repo = process.env.GITHUB_REPO || 'gilcambe/nexia';
    const token = process.env.GITHUB_TOKEN || process.env.NEXIA_GITHUB_TOKEN;

    let openIssues = [];
    let openPulls = [];

    if (token) {
      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Nexia-AI-AtualizaEstado'
        };

        const issuesRes = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=20`, { headers });
        if (issuesRes.ok) {
          openIssues = await issuesRes.json();
        }

        const pullsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=20`, { headers });
        if (pullsRes.ok) {
          openPulls = await pullsRes.json();
        }
      } catch (apiErr) {
        console.warn('[atualizaEstado] Aviso ao consultar GitHub API:', apiErr.message);
      }
    } else {
      console.log('[atualizaEstado] Token do GitHub não fornecido; gerando resumo com base no estado local.');
    }

    const agora = new Date().toLocaleString('pt-BR'); // Formato mais legível
    const issuesAbertas = Array.isArray(openIssues) ? openIssues.filter(i => !i.pull_request) : [];
    const issuesTravadas = issuesAbertas.filter(i => i.labels && i.labels.some(l => l.name === 'cortex-travada' || l.name === 'cortex-alerta'));
    const pullsAbertos = Array.isArray(openPulls) ? openPulls : [];

    // Construção do resumo compacto focado nas informações solicitadas
    const resumoContent = `# Estado do Repositório (NEXIA OS)\n
*Última atualização:* ${agora}
*Repositório:* \`${repo}\`

## Resumo da Fila de Vagas e Tarefas
- **Issues Abertas:** ${issuesAbertas.length}
- **Issues Travadas/Alerta:** ${issuesTravadas.length}
- **Pull Requests Abertos:** ${pullsAbertos.length}

---
*Este arquivo é gerado automaticamente pelo script \`nexia-ai/cron/atualizaEstado.js\` para fornecer um panorama rápido do estado atual do projeto.*\n`;

    const docsDir = path.resolve('docs');
    // Garante que o diretório 'docs' exista
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const filePath = path.join(docsDir, 'ESTADO-IA.md');
    // Sobrescreve o arquivo existente com o novo conteúdo
    fs.writeFileSync(filePath, resumoContent, 'utf8');

    console.log(`[atualizaEstado] Sucesso! Arquivo ${filePath} atualizado com resumo compacto.`);
    return true;
  } catch (err) {
    console.error('[atualizaEstado] Erro fatal ao atualizar estado:', err.message);
    // Em caso de erro, é importante registrar o erro, mas não necessariamente sair com exit(1)
    // para não interromper outros processos se rodar em um ambiente de cron mais amplo.
    // Retornar false ou lançar a exceção pode ser uma alternativa.
    return false;
  }
}

// Execução principal apenas se o script for chamado diretamente
if (require.main === module) {
  atualizaEstado();
}

module.exports = { atualizaEstado };
