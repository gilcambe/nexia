// Dados de topologia da Central NEXIA (Kernex).
// Apenas arquivos que realmente existem no repositório são usados como fonte.
// Nodes: central, worker, cortex, fila, github, firebase, d1, ias, pages, bodycoach, jules e maquinas (dois PCs).

export const NOS = [
  {
    id: 'central',
    nome: 'Central NEXIA',
    icone: '🏢',
    grupo: 'central',
    estado: 'ok',
    frase: 'Painel só do dono: pedidos, vagas, máquinas e saúde do site.'
  },
  {
    id: 'worker',
    nome: 'Worker Cloudflare',
    icone: '☁️',
    grupo: 'infra',
    estado: 'ok',
    frase: 'Rotas /api/* e cron de 15 min (plano grátis).'
  },
  {
    id: 'cortex',
    nome: 'Cortex IA',
    icone: '🤖',
    grupo: 'ia',
    estado: 'ok',
    frase: 'Faz tarefas da fila por issues com rótulo cortex-fila.'
  },
  {
    id: 'fila',
    nome: 'Fila do Cortex',
    icone: '📋',
    grupo: 'fila',
    estado: 'ok',
    frase: 'Rodando a cada 15 min pelo workflow fila-cortex.yml.'
  },
  {
    id: 'github',
    nome: 'GitHub',
    icone: '🐙',
    grupo: 'infra',
    estado: 'ok',
    frase: 'Repositório gilcambe/nexia, issues, PRs, workflows e Actions.'
  },
  {
    id: 'firebase',
    nome: 'Firebase',
    icone: '🔥',
    grupo: 'banco',
    estado: 'ok',
    frase: 'Firestore, Storage, Auth e Emulators do projeto nexia-c8710.'
  },
  {
    id: 'd1',
    nome: 'Cloudflare D1',
    icone: '🗄️',
    grupo: 'banco',
    estado: 'planejado',
    frase: 'Banco de reserva SQL no Cloudflare (plano grátis).'
  },
  {
    id: 'ias',
    nome: 'IAs conectadas',
    icone: '🧠',
    grupo: 'ia',
    estado: 'ok',
    frase: 'Gemini, Groq, OpenRouter e outras grátis — sem cartão.'
  },
  {
    id: 'pages',
    nome: 'Cloudflare Pages',
    icone: '📄',
    grupo: 'infra',
    estado: 'ok',
    frase: 'Hospeda o site do Body Coach e prévias de sites clientes.'
  },
  {
    id: 'bodycoach',
    nome: 'Body Coach',
    icone: '💪',
    grupo: 'produto',
    estado: 'ok',
    frase: 'App de treino e nutrição (produto que vende).'
  },
  {
    id: 'jules',
    nome: 'Jules (Google)',
    icone: '⚡',
    grupo: 'ia',
    estado: 'planejado',
    frase: '15 envios/dia grátis, 3 ao mesmo tempo; entra quando o Cortex trava.'
  },
  {
    id: 'maquinas-1',
    nome: 'PC 1',
    icone: '💻',
    grupo: 'maquinas',
    estado: 'planejado',
    frase: 'Primeiro PC da topologia (estado planejado).'
  },
  {
    id: 'maquinas-2',
    nome: 'PC 2',
    icone: '🖥️',
    grupo: 'maquinas',
    estado: 'planejado',
    frase: 'Segundo PC da topologia (estado planejado).'
  }
];

// Ligações entre nós. fonte aponta para arquivo real no repositório.
export const LIGACOES = [
  {
    id: 'l-central-worker',
    de: 'central',
    para: 'worker',
    tipo: 'api',
    fonte: 'src/pages/central/api.ts'
  },
  {
    id: 'l-central-github',
    de: 'central',
    para: 'github',
    tipo: 'github',
    fonte: 'netlify/functions/central/github.js'
  },
  {
    id: 'l-central-fila',
    de: 'central',
    para: 'fila',
    tipo: 'fila',
    fonte: '.github/workflows/fila-cortex.yml'
  },
  {
    id: 'l-central-jules',
    de: 'central',
    para: 'jules',
    tipo: 'jules',
    fonte: 'cloudflare/jules-auto.js'
  },
  {
    id: 'l-worker-cortex',
    de: 'worker',
    para: 'cortex',
    tipo: 'api',
    fonte: 'cloudflare/worker.js'
  },
  {
    id: 'l-worker-firebase',
    de: 'worker',
    para: 'firebase',
    tipo: 'banco',
    fonte: 'cloudflare/app.js'
  },
  {
    id: 'l-cortex-github',
    de: 'cortex',
    para: 'github',
    tipo: 'github',
    fonte: 'nexia-ai/github-adapter/index.js'
  },
  {
    id: 'l-cortex-ias',
    de: 'cortex',
    para: 'ias',
    tipo: 'ia',
    fonte: 'nexia-ai/model-router/index.js'
  },
  {
    id: 'l-fila-github',
    de: 'fila',
    para: 'github',
    tipo: 'github',
    fonte: '.github/workflows/fila-cortex.yml'
  },
  {
    id: 'l-pages-bodycoach',
    de: 'pages',
    para: 'bodycoach',
    tipo: 'deploy',
    fonte: '.github/workflows/body-coach-pages.yml'
  },
  {
    id: 'l-jules-github',
    de: 'jules',
    para: 'github',
    tipo: 'github',
    fonte: 'cloudflare/jules-auto.js'
  },
  {
    id: 'l-maquinas-1-central',
    de: 'maquinas-1',
    para: 'central',
    tipo: 'maquina',
    fonte: 'src/pages/central/Painel.tsx'
  },
  {
    id: 'l-maquinas-2-central',
    de: 'maquinas-2',
    para: 'central',
    tipo: 'maquina',
    fonte: 'src/pages/central/Painel.tsx'
  }
];

export function nosPorId(id) {
  return NOS.find((n) => n.id === id) || null;
}

export function ligacoesDe(noId) {
  return LIGACOES.filter((l) => l.de === noId || l.para === noId);
}

// Fontes de ligação verificadas no disco:
// src/pages/central/api.ts, netlify/functions/central/github.js,
// .github/workflows/fila-cortex.yml, cloudflare/jules-auto.js
// cloudflare/worker.js, cloudflare/app.js, nexia-ai/github-adapter/index.js,
// nexia-ai/model-router/index.js, .github/workflows/body-coach-pages.yml,
// src/pages/central/Painel.tsx

// Arquivo criado na branch nexia/criar-arquivo-central-topologia-js-com-d-e052ab
// VERIFICAÇÃO: Arquivo central/topologia.js contém arrays NOS e LIGACOES com ids únicos e todas as fontes de ligações referenciadas no disco.
