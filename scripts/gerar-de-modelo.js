'use strict';
// Fábrica F3 (#3620, parte de #3378): copia um modelo de projeto e preenche as variáveis {{nome}}.
// Uso: node scripts/gerar-de-modelo.js <pastaModelo> <valores.json> <destino>
const fs = require('node:fs');
const path = require('node:path');

const TEXTO = new Set(['.html', '.css', '.js', '.json', '.md', '.php', '.txt']);
const VAR = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

/** Troca {{var}} pelo valor. Lança "faltou: a, b" com todas as variáveis sem valor. Valor extra é ignorado. */
function preencher(texto, valores = {}) {
  const faltam = [];
  for (const m of String(texto).matchAll(VAR)) {
    if (!Object.prototype.hasOwnProperty.call(valores, m[1]) || valores[m[1]] == null) { if (!faltam.includes(m[1])) faltam.push(m[1]); }
  }
  if (faltam.length) throw new Error(`faltou: ${faltam.join(', ')}`);
  return String(texto).replace(VAR, (_, k) => String(valores[k]));
}

const ignorar = nome => nome === 'modelo.json' || /^\.env/i.test(nome);

function listar(raiz, rel = '') {
  const saida = [];
  for (const e of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
    if (ignorar(e.name)) continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) saida.push(...listar(raiz, r));
    else if (e.isFile()) saida.push(r);
  }
  return saida;
}

/** Copia o modelo para `destino` preenchendo as variáveis. Devolve a lista de arquivos criados (caminhos relativos). */
function gerar(pastaModelo, valores = {}, destino) {
  const modelo = JSON.parse(fs.readFileSync(path.join(pastaModelo, 'modelo.json'), 'utf8'));
  const faltam = (modelo.variaveis || []).filter(v => !Object.prototype.hasOwnProperty.call(valores, v) || valores[v] == null);
  if (faltam.length) throw new Error(`faltou: ${faltam.join(', ')}`);
  if (fs.existsSync(destino) && fs.readdirSync(destino).length) throw new Error('destino ocupado');
  const arquivos = listar(pastaModelo);
  for (const rel of arquivos) {
    const de = path.join(pastaModelo, rel), para = path.join(destino, rel);
    fs.mkdirSync(path.dirname(para), { recursive: true });
    if (TEXTO.has(path.extname(rel).toLowerCase())) fs.writeFileSync(para, preencher(fs.readFileSync(de, 'utf8'), valores));
    else fs.copyFileSync(de, para);
  }
  return arquivos.map(r => r.split(path.sep).join('/'));
}

/** Lança erro se algum {{...}} sobrar em arquivo de texto dentro de `pasta`. */
function verificarPlaceholders(pasta) {
  if (!pasta || typeof pasta !== 'string' || !fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory()) {
    throw new Error(`pasta inválida: ${pasta}`);
  }
  const sobras = [];
  for (const rel of listar(pasta)) {
    if (!TEXTO.has(path.extname(rel).toLowerCase())) continue;
    if (/\{\{[^]*?\}\}/.test(fs.readFileSync(path.join(pasta, rel), 'utf8'))) sobras.push(rel.split(path.sep).join('/'));
  }
  if (sobras.length) throw new Error(`placeholder {{...}} sobrando em: ${sobras.join(', ')}`);
}

/** Gera a partir de modelo.json (ou da pasta do modelo); variáveis sem valor recebem o próprio nome. Confere placeholders no fim. */
function gerarDeModelo(modeloPath, destino, valores = {}) {
  const pasta = path.basename(modeloPath) === 'modelo.json' ? path.dirname(modeloPath) : modeloPath;
  const modelo = JSON.parse(fs.readFileSync(path.join(pasta, 'modelo.json'), 'utf8'));
  const todos = { ...valores };
  for (const v of modelo.variaveis || []) if (todos[v] == null) todos[v] = v;
  const feitos = gerar(pasta, todos, destino);
  verificarPlaceholders(destino);
  return feitos;
}

module.exports = { preencher, gerar, gerarDeModelo, verificarPlaceholders };

if (require.main === module) {
  const [pasta, valoresArq, destino] = process.argv.slice(2);
  if (!pasta || !valoresArq || !destino) { console.error('Uso: node scripts/gerar-de-modelo.js <pastaModelo> <valores.json> <destino>'); process.exit(2); }
  try {
    const feitos = gerar(pasta, JSON.parse(fs.readFileSync(valoresArq, 'utf8')), destino);
    verificarPlaceholders(destino);
    console.log(`Pronto: ${feitos.length} arquivo(s) em ${destino}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
