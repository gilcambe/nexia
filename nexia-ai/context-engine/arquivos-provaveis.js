'use strict';
// #819 Contexto do projeto no prompt: antes de agir, o Cortex procura no repositório (ripgrep, ou a busca
// em Node quando o rg não existe) as palavras do pedido e entrega ao modelo só o MAPA.md e os 5 a 8 arquivos
// mais prováveis. Assim o modelo grátis não gasta os passos lendo arquivo por arquivo e termina sem editar.
// Só roda quando o repositório da execução é o mesmo que está no disco (GITHUB_WORKSPACE no Actions).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_ARQUIVOS = 8;
const MAX_PALAVRAS = 12;
const MAX_BYTES = 300 * 1024;
const MAPA_LINHAS = 80;

// Pastas e arquivos que não são código do produto (gerados, cópias de referência, relatórios).
const FORA = ['node_modules', '.git', 'out', 'dist', 'build', '.worker-assets', 'coverage', 'docs/referencia', 'nexia-audit', 'cortex-anexos', 'test-results', 'playwright-report'];
const FORA_ARQ = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.(?:png|jpe?g|gif|webp|ico|svg|mp4|webm|mp3|woff2?|ttf|otf|pdf|zip|gz|apk|aab|jar|keystore|map|min\.js)$/i;
const CODIGO = /\.(?:js|cjs|mjs|ts|tsx|jsx|json|html|css|yml|yaml|rules|md|sh|py)$/i;

const VAZIAS = new Set(('a o os as um uma uns umas de do da dos das no na nos nas em por para pra com sem que quem qual quais como quando onde '
  + 'e ou se nao não mais menos muito pouco ja já so só tambem também isso esse essa este esta aqui ali todo toda todos todas cada '
  + 'ser estar ter fazer faça faz feito deve devem pode podem precisa quero queria favor hoje agora depois antes sempre nunca '
  + 'arquivo arquivos codigo código pedido usuario usuário projeto app mudar mudança alterar altere crie criar adicione adicionar '
  + 'the and for with from that this into when then dentro fora parte partes melhoria cortex nexia porque por que custo').split(/\s+/));

const tirarAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palavras que valem a busca: identificadores e palavras de 4+ letras, sem as vazias, as mais longas primeiro. */
function palavrasDoPedido(texto) {
  const t = String(texto || '').replace(/https?:\/\/\S+/g, ' ');
  const vistas = new Map();
  for (const m of t.matchAll(/[A-Za-zÀ-ÿ_][\wÀ-ÿ-]{3,}/g)) {
    const bruto = m[0].replace(/-+$/, '');
    const chave = tirarAcento(bruto).toLowerCase();
    if (chave.length < 4 || VAZIAS.has(chave) || VAZIAS.has(bruto.toLowerCase()) || /^\d+$/.test(chave)) continue;
    // Identificador (camelCase, snake_case, com hífen) pesa mais que palavra solta.
    const ident = /[a-z][A-Z]|_|-/.test(bruto);
    const atual = vistas.get(chave);
    vistas.set(chave, { termo: ident ? bruto : bruto.toLowerCase(), peso: (atual ? atual.peso : 0) + (ident ? 3 : 1) });
  }
  return [...vistas.values()].sort((a, b) => b.peso - a.peso || b.termo.length - a.termo.length).slice(0, MAX_PALAVRAS).map((x) => x.termo);
}

const foraDaBusca = (rel) => FORA.some((f) => rel === f || rel.startsWith(f + '/')) || /(?:^|\/)referencia\//.test(rel) || FORA_ARQ.test(rel);

function listarArquivos(raiz, limite = 8000) {
  const out = [];
  const andar = (dir) => {
    if (out.length >= limite) return;
    let itens = [];
    try { itens = fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      const rel = dir ? `${dir}/${it.name}` : it.name;
      if (foraDaBusca(rel) || it.isSymbolicLink()) continue;
      if (it.isDirectory()) andar(rel);
      else if (it.isFile() && CODIGO.test(it.name)) out.push(rel);
      if (out.length >= limite) return;
    }
  };
  andar('');
  return out;
}

// "refeicao" acha "refeição" e vice-versa: cada vogal e o c viram uma classe com as variantes acentuadas.
const VARIANTES = { a: 'aáàâã', e: 'eéê', i: 'ií', o: 'oóôõ', u: 'uúü', c: 'cç' };
function regexSemAcento(termo) {
  return [...tirarAcento(termo).toLowerCase()].map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : ch.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))).join('');
}

/** Com o rg: arquivos que contêm a palavra (sem diferença de maiúscula). Devolve null se o rg não rodar. */
function buscarComRg(raiz, termo, spawn = spawnSync) {
  const globs = FORA.flatMap((f) => ['-g', `!${f}/**`]).concat(['-g', '!package-lock.json', '-g', '!*.min.js', '-g', '!*.map']);
  const r = spawn('rg', ['-l', '-i', '--no-messages', '--max-filesize', '300K', ...globs, '-e', regexSemAcento(termo), '.'], { cwd: raiz, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  if (!r || r.error || (r.status !== 0 && r.status !== 1)) return null;
  return String(r.stdout || '').split('\n').map((s) => s.trim().replace(/^\.\//, '')).filter((s) => s && !foraDaBusca(s) && CODIGO.test(s));
}

function buscarEmNode(raiz, termos, arquivos) {
  const achados = new Map(termos.map((t) => [t, []]));
  const baixos = termos.map((t) => [t, tirarAcento(t).toLowerCase()]);
  for (const rel of arquivos) {
    let txt = '';
    try { const st = fs.statSync(path.join(raiz, rel)); if (st.size > MAX_BYTES) continue; txt = tirarAcento(fs.readFileSync(path.join(raiz, rel), 'utf8')).toLowerCase(); } catch { continue; }
    for (const [t, b] of baixos) if (txt.includes(b)) achados.get(t).push(rel);
  }
  return achados;
}

/**
 * @param {{ raiz: string, texto: string, max?: number, spawn?: Function }} o
 * @returns {{ palavras: string[], arquivos: { path: string, palavras: string[], pontos: number }[], busca: 'rg'|'node' }}
 */
function arquivosProvaveis({ raiz, texto, max = MAX_ARQUIVOS, spawn = spawnSync }) {
  const termos = palavrasDoPedido(texto);
  if (!raiz || !termos.length) return { palavras: termos, arquivos: [], busca: 'node' };
  let busca = 'rg';
  let porTermo = new Map();
  for (const t of termos) {
    const r = busca === 'rg' ? buscarComRg(raiz, t, spawn) : null;
    if (r === null) { busca = 'node'; break; }
    porTermo.set(t, r);
  }
  const todos = listarArquivos(raiz);
  if (busca === 'node') porTermo = buscarEmNode(raiz, termos, todos);

  const placar = new Map();
  const somar = (rel, termo, pontos) => {
    const p = placar.get(rel) || { path: rel, palavras: [], pontos: 0 };
    if (!p.palavras.includes(termo)) p.palavras.push(termo);
    p.pontos += pontos;
    placar.set(rel, p);
  };
  const nArq = todos.length || 1;
  for (const [t, lista] of porTermo) {
    if (!lista.length) continue;
    // Palavra rara diz mais que palavra que aparece em metade do repositório.
    const raridade = Math.max(0.2, Math.log(1 + nArq / lista.length));
    const tb = tirarAcento(t).toLowerCase();
    for (const rel of lista) somar(rel, t, raridade * (tirarAcento(rel).toLowerCase().includes(tb) ? 4 : 1));
  }
  // Nome do arquivo com a palavra, mesmo sem o texto dentro (arquivo novo ao lado dos parecidos).
  for (const rel of todos) {
    const rb = tirarAcento(rel).toLowerCase();
    for (const t of termos) if (rb.includes(tirarAcento(t).toLowerCase()) && !(placar.get(rel) || { palavras: [] }).palavras.includes(t)) somar(rel, t, 2);
  }
  const teste = (p) => /(?:^|\/)tests?\//.test(p) || /\.test\.[jt]sx?$/.test(p);
  // Relatórios e notas em .md ajudam pouco a editar: o código vem antes (o MAPA.md já vai inteiro).
  const peso = (p) => (teste(p) ? 0.6 : 1) * (/\.md$/i.test(p) ? 0.35 : 1);
  const arquivos = [...placar.values()]
    .map((p) => ({ ...p, pontos: Math.round((p.pontos * (1 + 0.5 * (p.palavras.length - 1)) * peso(p.path)) * 100) / 100 }))
    .sort((a, b) => b.pontos - a.pontos || a.path.length - b.path.length)
    .slice(0, max);
  return { palavras: termos, arquivos, busca };
}

function lerMapa(raiz, linhas = MAPA_LINHAS) {
  try { return fs.readFileSync(path.join(raiz, 'MAPA.md'), 'utf8').split('\n').slice(0, linhas).join('\n').trim(); } catch { return ''; }
}

/** Texto pronto para o prompt: MAPA.md (resumo) e os arquivos prováveis com as palavras achadas. */
function contextoDoRepo({ raiz, texto, max = MAX_ARQUIVOS, spawn = spawnSync }) {
  if (!raiz) return { texto: '', arquivos: [] };
  const mapa = lerMapa(raiz);
  const r = arquivosProvaveis({ raiz, texto, max, spawn });
  const partes = [];
  if (mapa) partes.push(`### Mapa do repositório (MAPA.md)\n${mapa}`);
  if (r.arquivos.length) {
    partes.push(`### Arquivos prováveis para este pedido (busca por: ${r.palavras.join(', ')})\n`
      + r.arquivos.map((a) => `- ${a.path} (tem: ${a.palavras.join(', ')})`).join('\n')
      + '\nComece por estes arquivos (eles existem). Não invente caminhos: se o pedido citar um arquivo que não existe, faça a mudança no arquivo real equivalente desta lista.');
  }
  return { texto: partes.length ? `\n\n${partes.join('\n\n')}` : '', arquivos: r.arquivos.map((a) => a.path), palavras: r.palavras, busca: r.busca };
}

/** Pasta local do repositório da execução, quando é o mesmo do disco (Actions); senão null. */
function raizLocal(repo, env = process.env) {
  const ws = env.GITHUB_WORKSPACE;
  const nome = String(env.GITHUB_REPOSITORY || '').toLowerCase();
  if (!ws || !repo || !nome || `${repo.owner}/${repo.repo}`.toLowerCase() !== nome) return null;
  try { return fs.statSync(ws).isDirectory() ? ws : null; } catch { return null; }
}

module.exports = { regexSemAcento, palavrasDoPedido, arquivosProvaveis, contextoDoRepo, raizLocal, lerMapa, MAX_ARQUIVOS };
