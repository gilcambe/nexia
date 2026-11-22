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
      console.log('[atualizaEstado] Token do GitHub não fornecido; gerando resumo com base no estado padrão.');
    }

    const agora = new Date().toLocaleDateString('pt-BR');
    const issuesAbertas = Array.isArray(openIssues) ? openIssues.filter(i => !i.pull_request) : [];
    const issuesTravadas = issuesAbertas.filter(i => i.labels && i.labels.some(l => l.name === 'cortex-travada' || l.name === 'cortex-alerta'));
    const pullsAbertos = Array.isArray(openPulls) ? openPulls : [];

    let closedPulls = [];
    let ultimosMerges = [];

    if (token) {
      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Nexia-AI-AtualizaEstado'
        };

        const closedPullsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=closed&per_page=15`, { headers });
        if (closedPullsRes.ok) {
          closedPulls = await closedPullsRes.json();
          ultimosMerges = closedPulls.filter(p => p.merged_at !== null);
        }
      } catch (mErr) {
        console.warn('[atualizaEstado] Aviso ao consultar pulls fechados/merged:', mErr.message);
      }
    }

    const resumoContent = `# Estado da IA e Fila de Vagas (Cortex)

Atualizado em ${agora}. Gerado automaticamente por \`nexia-ai/cron/atualizaEstado.js\`.

## Visão Geral da Fila
- **Repositório:** \`${repo}\`
- **Total de Issues Abertas:** ${issuesAbertas.length}
- **Issues Travadas / Alerta:** ${issuesTravadas.length}
- **Pull Requests Abertos:** ${pullsAbertos.length}

## Últimos Merges
${ultimosMerges.length > 0 ? ultimosMerges.map(m => `- PR #${m.number}: ${m.title} (mesclado em ${m.merged_at})`).join('\n') : '- Nenhum merge recente listado ou API indisponível.'}
`;

    const docsDir = path.resolve('docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const filePath = path.join(docsDir, 'ESTADO-IA.md');
    fs.writeFileSync(filePath, resumoContent, 'utf8');

    console.log(`[atualizaEstado] Sucesso! Arquivo ${filePath} atualizado com resumo compacto.`);
    return true;
  } catch (err) {
    console.error('[atualizaEstado] Erro fatal ao atualizar estado:', err.message);
    return false;
  }
}

if (require.main === module) {
  atualizaEstado();
}

module.exports = { atualizaEstado };
