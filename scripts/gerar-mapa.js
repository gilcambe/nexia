#!/usr/bin/env node
// Documentação viva (#818): gera docs/MAPA.md direto do código (rotas da API, páginas dos clientes,
// nomes de segredos e workflows). Só NOMES de segredos, nunca valores. Grátis, sem dependência nova.
//   node scripts/gerar-mapa.js          → reescreve docs/MAPA.md
//   node scripts/gerar-mapa.js --check  → sai com 1 se docs/MAPA.md estiver desatualizado
// O Cortex não depende do arquivo gravado: lê o resumo gerado na hora (resumoParaCortex), sempre atual.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const GATILHOS = ['push', 'pull_request', 'schedule', 'workflow_dispatch', 'workflow_run', 'issues', 'issue_comment', 'repository_dispatch'];

function ler(raiz, rel) { try { return fs.readFileSync(path.join(raiz, rel), 'utf8'); } catch { return ''; } }

function rotas(raiz) {
  try {
    const caminho = path.join(raiz, 'lib', 'routes.js');
    delete require.cache[require.resolve(caminho)];
    const r = require(caminho);
    return { api: Object.entries(r.API_ROUTES || {}), paginas: Object.entries(r.TENANT_PAGES || {}) };
  } catch { return { api: [], paginas: [] }; }
}

function segredosDoEnv(raiz) {
  return [...new Set(ler(raiz, '.env.example').split('\n').map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l.trim())).filter(Boolean).map((m) => m[1]))];
}

function workflows(raiz) {
  const dir = path.join(raiz, '.github', 'workflows');
  let arquivos = [];
  try { arquivos = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort(); } catch { return []; }
  return arquivos.map((f) => {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const nome = ((/^name:\s*['"]?(.+?)['"]?\s*$/m.exec(t) || [])[1] || f).trim();
    const blocoOn = (/^on:\s*\n([\s\S]*?)^\S/m.exec(t + '\nfim') || [])[1] || ((/^on:\s*(.+)$/m.exec(t) || [])[1] || '');
    const gatilhos = GATILHOS.filter((g) => new RegExp(`(^|[\\s\\[,])${g}\\s*[:,\\]]|^\\s+${g}\\s*$`, 'm').test(blocoOn) || blocoOn.trim() === g);
    const segredos = [...new Set([...t.matchAll(/secrets\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))].sort();
    return { arquivo: f, nome, gatilhos, segredos };
  });
}

function gerarMapa(raiz = RAIZ) {
  const { api, paginas } = rotas(raiz);
  const wf = workflows(raiz);
  const doEnv = segredosDoEnv(raiz);
  const usoPorSegredo = {};
  for (const w of wf) for (const s of w.segredos) (usoPorSegredo[s] = usoPorSegredo[s] || []).push(w.arquivo);
  const todos = [...new Set([...doEnv, ...Object.keys(usoPorSegredo)])].sort();
  const l = [];
  l.push('# MAPA vivo do NEXIA (gerado do código)', '');
  l.push('Gerado por `node scripts/gerar-mapa.js` a partir de `lib/routes.js`, `.env.example` e `.github/workflows/`. Não edite à mão: rode o script. O mapa escrito à mão (onde fica cada coisa) é o `MAPA.md` da raiz.', '');
  l.push(`## Rotas da API (${api.length})`, '', 'Caminho → handler em `netlify/functions/<handler>.js` (o Worker chama pelo `cloudflare/functions.js`).', '');
  for (const [p, fn] of api) l.push(`- \`${p}\` → \`${fn}\``);
  l.push('', `## Páginas dos clientes (${paginas.length})`, '');
  for (const [p, [pasta, arq]] of paginas) l.push(`- \`${p}\` → \`${pasta}/${arq}\``);
  l.push('', `## Segredos e variáveis (${todos.length}, só nomes)`, '', 'Origem: `.env.example` (E) e/ou workflows que usam (W).', '');
  for (const s of todos) {
    const ws = usoPorSegredo[s] || [];
    l.push(`- \`${s}\` ${doEnv.includes(s) ? 'E' : ''}${ws.length ? 'W' : ''}${ws.length ? ': ' + ws.join(', ') : ''}`);
  }
  l.push('', `## Workflows (${wf.length})`, '');
  for (const w of wf) l.push(`- \`${w.arquivo}\` — ${w.nome}${w.gatilhos.length ? ' (' + w.gatilhos.join(', ') + ')' : ''}`);
  l.push('');
  return l.join('\n');
}

/** Versão curta para o prompt do Cortex (cabe em poucas linhas). */
function resumoParaCortex(raiz = RAIZ) {
  const { api } = rotas(raiz);
  const wf = workflows(raiz);
  if (!api.length && !wf.length) return '';
  return [
    `Rotas da API (caminho→handler em netlify/functions/): ${api.map(([p, fn]) => `${p}→${fn}`).join(', ')}`,
    `Workflows (.github/workflows/): ${wf.map((w) => `${w.arquivo} "${w.nome}"`).join('; ')}`,
    `Segredos (só nomes, em .env.example): ${segredosDoEnv(raiz).join(', ')}`,
  ].join('\n');
}

if (require.main === module) {
  const destino = path.join(RAIZ, 'docs', 'MAPA.md');
  const novo = gerarMapa(RAIZ);
  if (process.argv.includes('--check')) {
    const atual = ler(RAIZ, 'docs/MAPA.md');
    if (atual !== novo) { console.error('docs/MAPA.md desatualizado: rode "npm run mapa".'); process.exit(1); }
    console.log('docs/MAPA.md em dia.');
  } else {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, novo);
    console.log(`docs/MAPA.md: ${novo.split('\n').length} linhas.`);
  }
}

module.exports = { gerarMapa, resumoParaCortex, workflows, segredosDoEnv, rotas };
