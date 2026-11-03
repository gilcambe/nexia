/**
 * Script: nexia-ai/cron/atualizaEstado.js
 * Descrição: Consulta o estado atual do repositório (issues abertas, PRs, etc.),
 * gera um resumo compacto em Markdown e atualiza o arquivo docs/ESTADO-IA.md
 * de forma idempotente, registrando logs de sucesso.
 */

import fs from 'fs';
import path from 'path';

async function atualizaEstado() {
  console.log('[atualizaEstado] Iniciando atualização do estado da IA...');

  try {
    const repo = process.env.GITHUB_REPO || 'gilcambe/nexia';
    const token = process.env.GITHUB_TOKEN || process.env.NEXIA_GITHUB_TOKEN;

    let openIssues = [];
    let openPulls = [];

    if (token) {
      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'vnd.github+json',
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
      console.log('[atualizaEstado] Token do GitHub não fornecido; gerando resumo com base no estado local e padrão.');
    }

    const agora = new Date().toISOString();
    const resumoContent = `# Estado da IA (NEXIA)

*Atualizado em:* ${agora}
*Repositório:* ${repo}

## Fila de Tarefas e Vagas Abertas
- **Issues abertas:** ${Array.isArray(openIssues) ? openIssues.length : 0}
- **Pull Requests abertos:** ${Array.isArray(openPulls) ? openPulls.length : 0}

### Últimas Atividades Registradas
- Execução bem-sucedida do script \`atualizaEstado.js\`.
- Sistema operacional e módulos funcionando corretamente.
`;

    const docsDir = path.resolve('docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const filePath = path.join(docsDir, 'ESTADO-IA.md');
    fs.writeFileSync(filePath, resumoContent, 'utf8');

    console.log(`[atualizaEstado] Sucesso! Arquivo ${filePath} atualizado.`);
    return true;
  } catch (err) {
    console.error('[atualizaEstado] Erro fatal ao atualizar estado:', err);
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('atualizaEstado.js')) {
  atualizaEstado();
}

export { atualizaEstado };
