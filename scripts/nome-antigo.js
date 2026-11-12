'use strict';
// K5 (#3571): acha o nome antigo (NEXIA, Prumo) em tudo que o CLIENTE VÊ. Nome interno (import, caminho,
// variável, comentário, rota /api/nexia/) não conta. Linha com `// nome-antigo:permitido` também não.
// Uso: node scripts/nome-antigo.js  -> lista as sobras e sai com 1 se houver alguma.
const fs = require('node:fs');
const path = require('node:path');

const MARCADOR = 'nome-antigo:permitido';
const PALAVRA = /\b(nexia|prumo)\b(?![-_/]\w)/gi;
const LINK = /\b(nexia[\w-]*\.pages\.dev|nexia\.gcbezerra\.workers\.dev|nexiaos\.com\.br|nexia\.app)\b/gi;
const ATRIBUTO_TEXTO = /\b(?:alt|title|placeholder|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/gi;
const ATRIBUTO_LINK = /\b(?:href|src|content|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/gi;
const META_TEXTO = /<meta\b[^>]*\b(?:property|name)\s*=\s*["'](?:og:title|og:description|twitter:title|twitter:description|description|application-name|apple-mobile-web-app-title)["'][^>]*>/gi;

/** Tira comentários de código e HTML da linha (sem confundir com `https://`). */
function semComentario(linha) {
  return linha
    .replace(/<!--.*?-->/g, ' ')
    .replace(/\/\*.*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/.*$/, '$1');
}

/** Trechos da linha que o cliente vê: título, texto entre tags, atributos de texto e metas de título/descrição. */
function trechosVisiveis(linha) {
  const t = [];
  for (const m of linha.matchAll(/<title>([^<]*)<\/title>/gi)) t.push(m[1]);
  for (const m of linha.matchAll(/>([^<>{}]+)</g)) t.push(m[1]);
  for (const m of linha.matchAll(/>\s*\{\s*["'`]([^"'`]+)["'`]\s*\}\s*</g)) t.push(m[1]);
  for (const m of linha.matchAll(ATRIBUTO_TEXTO)) t.push(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of linha.matchAll(META_TEXTO)) { const c = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(m[0]); if (c) t.push(c[1]); }
  return t;
}

/** Links visíveis: nos atributos href/src/content/action e no texto. */
function trechosDeLink(linha) {
  const t = [];
  for (const m of linha.matchAll(ATRIBUTO_LINK)) t.push(m[1] ?? m[2] ?? m[3] ?? '');
  return t.concat(trechosVisiveis(linha));
}

/** Ocorrências visíveis de nome antigo no texto. Devolve [{ linha, trecho }] (linha começa em 1). */
function achar(texto, caminho = '') {
  const achados = [];
  const linhas = String(texto || '').split(/\r?\n/);
  linhas.forEach((original, i) => {
    if (original.includes(MARCADOR)) return;
    const linha = semComentario(original);
    const vistos = new Set();
    const anota = (trecho) => { const k = trecho.toLowerCase(); if (!vistos.has(k)) { vistos.add(k); achados.push({ linha: i + 1, trecho }); } };
    for (const tr of trechosVisiveis(linha)) {
      // Link e rota interna são tratados à parte: tira antes de procurar a palavra solta.
      const limpo = tr.replace(LINK, ' ').replace(/\/api\/nexia\/\S*/gi, ' ');
      for (const m of limpo.matchAll(PALAVRA)) anota(m[0]);
    }
    for (const tr of trechosDeLink(linha)) for (const m of tr.matchAll(LINK)) anota(m[0]);
  });
  void caminho; // reservado: regras por tipo de arquivo, se precisar
  return achados;
}

const PASTAS = [['src/pages'], ['src/components'], ['apps', '*', 'src'], ['public']];
const EXT_CODIGO = new Set(['.html', '.htm', '.tsx', '.jsx', '.ts', '.js']);
const PULA = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

function varrer(dir, soHtml, saida) {
  let itens = [];
  try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return saida; }
  for (const e of itens) {
    if (PULA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p, soHtml, saida);
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (soHtml ? ext === '.html' || ext === '.htm' : EXT_CODIGO.has(ext)) saida.push(p);
    }
  }
  return saida;
}

/** Varre só o que o cliente vê e devolve [{ arquivo, linha, trecho }] com caminho relativo à raiz. */
function listarVisiveis(raiz = process.cwd()) {
  const arquivos = [];
  for (const partes of PASTAS) {
    if (partes[1] === '*') {
      let apps = [];
      try { apps = fs.readdirSync(path.join(raiz, partes[0]), { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { /* sem apps */ }
      for (const a of apps) varrer(path.join(raiz, partes[0], a.name, partes[2]), false, arquivos);
    } else varrer(path.join(raiz, ...partes), partes[0] === 'public', arquivos);
  }
  const lista = [];
  for (const arq of arquivos) {
    const rel = path.relative(raiz, arq).split(path.sep).join('/');
    for (const a of achar(fs.readFileSync(arq, 'utf8'), rel)) lista.push({ arquivo: rel, ...a });
  }
  return lista;
}

module.exports = { achar, listarVisiveis, MARCADOR };

if (require.main === module) {
  const lista = listarVisiveis(process.argv[2] || process.cwd());
  for (const a of lista) console.log(`${a.arquivo}:${a.linha}  ${a.trecho}`);
  console.log(lista.length ? `${lista.length} nome(s) antigo(s) visível(is).` : 'Nenhum nome antigo visível.');
  process.exitCode = lista.length ? 1 : 0;
}
