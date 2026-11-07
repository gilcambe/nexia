/**
 * Script: nexia-ai/cron/atualizaEstado.js
 * Descrição: Consulta o estado atual do repositório (issues abertas, travadas, PRs, etc.),
 * gera um resumo compacto em Markdown e atualiza o arquivo docs/ESTADO-IA.md
 * de forma idempotente, registrando logs de sucesso.
 */

const fs = require('fs');
const path = require('path');

async function atualizaEstado() {
  console.log('[atualizaEstado] Iniciando atualização do estado da IA (idempotente)...');

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

    const agora = new Date().toLocaleString('pt-BR');
    const issuesAbertas = Array.isArray(openIssues) ? openIssues.filter(i => !i.pull_request) : [];
    const issuesTravadas = issuesAbertas.filter(i => i.labels && i.labels.some(l => l.name === 'cortex-travada' || l.name === 'cortex-alerta'));
    const pullsAbertos = Array.isArray(openPulls) ? openPulls : [];

    const resumoContent = `# Estado do projeto e memória (para qualquer IA continuar)

Atualizado em ${agora}. Complementa \`docs/CONTEXTO-IA.md\` (regras). A Central junta os dois arquivos com a fila do Cortex ao vivo no botão **📦 Continuar em outra IA** (aba 🧠 Cortex). **Nunca coloque chave ou senha aqui.**

## Foco atual
- **Body Coach** é o produto para vender agora: https://nexiabodycoach.pages.dev (PWA, nada de dado falso). Play Store: conta paga, esperando verificação do Google; precisa de 12 testadores.
- **Cortex é de uso INTERNO** (decisão do dono): não vai ser vendido por enquanto. Ele serve para construir de graça os sites, páginas, SaaS e apps dos clientes.
- Marca pública **Kernex**; nomes internos seguem \`nexia\`.

## Fila de Vagas e Tarefas (Atualizado automaticamente)
- **Repositório:** \`${repo}\`
- **Issues Abertas:** ${issuesAbertas.length}
- **Issues Travadas/Alerta:** ${issuesTravadas.length}
- **Pull Requests Abertos:** ${pullsAbertos.length}

---
*Este arquivo é gerado automaticamente e de forma idempotente pelo script \`nexia-ai/cron/atualizaEstado.js\` para fornecer um panorama rápido do estado atual do projeto.*
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
