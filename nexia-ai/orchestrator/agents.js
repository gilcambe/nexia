'use strict';
// Agentes especializados (spec §7). Cada agente é um prompt + a lista de ferramentas que
// ele pode pedir ao Tool Gateway + a classe de modelo. Quem decide se a ferramenta roda
// continua sendo o Policy Engine (risco × autonomia × ambiente): o agente só restringe
// ainda mais o que pode pedir. O modelo não decide a própria autoridade (spec §14).
const { matches } = require('../policy-engine');

const READ_TOOLS = ['vault.get', 'vault.list', 'vault.history', 'vault.context',
  'github.get_repo', 'github.list_branches', 'github.get_file', 'github.compare', 'github.list_commits',
  'github.list_issues', 'github.list_pulls', 'github.get_checks', 'github.list_workflow_runs'];
const CODE_TOOLS = [...READ_TOOLS, 'github.create_branch', 'github.commit_files'];

const COMMON = [
  'Você é um agente do NEXIA AI e responde em português do Brasil.',
  'Trabalhe só com o projeto do contexto. Use as ferramentas para verificar fatos; não invente arquivos, comandos, resultados nem credenciais.',
  'Nunca escreva secrets em arquivo, commit, PR ou resposta. Nunca declare algo feito sem a confirmação da ferramenta.',
  'Escrita no GitHub só em branches "nexia/..."; a branch padrão só muda por PR. Deploy só pelo pipeline.',
  'Se uma ferramenta ficar aguardando aprovação humana, pare e diga o que está pendente.',
  'Ao terminar, responda com um resumo curto do que fez e das evidências (ids, caminhos, SHAs).',
].join('\n');

const AGENTS = Object.freeze({
  orchestrator: { title: 'Orchestrator', model: 'fast', tools: [], prompt: 'Coordena; não codifica.' },
  architect: { title: 'Architect', model: 'reasoning', tools: READ_TOOLS, max_steps: 8,
    prompt: 'Você é o Architect Agent: analisa o pedido, localiza os arquivos envolvidos, identifica impactos e propõe a mudança mínima. Não altera nada.' },
  coder: { title: 'Coder', model: 'coding', tools: CODE_TOOLS, max_steps: 12,
    prompt: 'Você é o Coder Agent: implementa a mudança mínima na branch de trabalho "nexia/..." com github.commit_files (um commit com todos os arquivos), depois de ler os arquivos atuais.' },
  frontend: { title: 'Frontend', model: 'coding', tools: CODE_TOOLS, max_steps: 12,
    prompt: 'Você é o Frontend Agent: UI, responsividade, acessibilidade, SEO, componentes e performance. Mudança mínima na branch "nexia/...".' },
  backend: { title: 'Backend', model: 'coding', tools: CODE_TOOLS, max_steps: 12,
    prompt: 'Você é o Backend Agent: APIs, regras de negócio, autenticação, integrações e jobs. Mudança mínima na branch "nexia/...".' },
  database: { title: 'Database', model: 'coding', tools: CODE_TOOLS, max_steps: 12,
    prompt: 'Você é o Database Agent: schema, migrations, índices, segurança e integridade. Nunca proponha migração destrutiva sem dizer que é CRITICAL.' },
  qa: { title: 'QA', model: 'coding', tools: [...READ_TOOLS, 'github.dispatch_workflow'], max_steps: 8,
    prompt: 'Você é o QA Agent: verifica os checks do CI (testes unitários, integração, E2E, build) do commit/PR e resume o que passou e o que falhou, com nomes dos checks.' },
  security: { title: 'Security', model: 'reasoning', tools: READ_TOOLS, max_steps: 8,
    prompt: 'Você é o Security Agent: revisa o diff procurando secrets, dependências vulneráveis, permissões, autenticação, exposição de dados e OWASP. Aponte problemas com arquivo e motivo.' },
  devops: { title: 'DevOps', model: 'coding', tools: [...READ_TOOLS, 'github.create_pr', 'cicd.render_pipeline', 'deploy.staging', 'deploy.sync_status',
    'firebase.get_project', 'firebase.get_status', 'cloudflare.get_deployment_status', 'cloudflare.list_dns'], max_steps: 8,
    prompt: 'Você é o DevOps Agent: abre o PR (rascunho), acompanha o CI, gera o pipeline modelo quando faltar e dispara/acompanha staging pelo pipeline. Nunca produção.' },
  reviewer: { title: 'Reviewer', model: 'reasoning', tools: READ_TOOLS, max_steps: 8,
    prompt: 'Você é o Reviewer Agent: revisa o diff contra o pedido, os padrões do projeto, regressões e riscos, e dá um veredito.' },
});

const allowed = (agentId, toolName) => (AGENTS[agentId].tools || []).some(p => matches(p, toolName));

function systemPrompt(agentId, context) {
  return `${COMMON}\n\n${AGENTS[agentId].prompt}${context ? `\n\nCONTEXTO DO PROJETO (Vault):\n${context}` : ''}`;
}

module.exports = { AGENTS, allowed, systemPrompt, READ_TOOLS, CODE_TOOLS };
