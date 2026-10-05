'use strict';
// ADR-CORTEX-01: plano B de escrita para modelos grátis. Quando a chamada de ferramenta falha (JSON
// cortado, modelo que não chama ferramenta), o agente pode responder em texto com blocos de edição;
// o runtime transforma esses blocos em github.edit_files / github.commit_files, que passam pelo
// Tool Gateway (política, Vault, aprovação) como qualquer outra chamada. Nada é gravado direto daqui.
//
// Formatos aceitos:
//   ARQUIVO: caminho/do/arquivo.tsx
//   <<<<<<< SEARCH
//   trecho exato do arquivo
//   =======
//   trecho novo
//   >>>>>>> REPLACE
// (vários blocos seguidos valem para o último ARQUIVO; podem vir dentro de ``` ```), e arquivo inteiro:
//   ARQUIVO: caminho/novo.ts
//   ```ts
//   conteúdo completo
//   ```

const FORMAT_HELP = [
  'ARQUIVO: caminho/do/arquivo.ext',
  '<<<<<<< SEARCH',
  '(trecho exato copiado do arquivo)',
  '=======',
  '(trecho novo)',
  '>>>>>>> REPLACE',
].join('\n');

const HEADER = /^\s*(?:[#>*\-\s]*)(?:\*\*)?\s*(?:ARQUIVO|FILE|PATH|CAMINHO)\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s*`?([^`*\s]+)`?/i;
const BARE_PATH = /^\s*(?:#+\s*)?(?:\*\*)?`?((?:[\w@.()[\]-]+\/)*[\w@.()[\]-]+\.[A-Za-z0-9]{1,8})`?(?:\*\*)?\s*:?\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const S_OPEN = /^\s*<{5,}\s*SEARCH\s*$/i;
const S_MID = /^\s*={5,}\s*$/;
const S_CLOSE = /^\s*>{5,}\s*REPLACE\s*$/i;
// Arquivo inteiro com "..." no lugar de código não é arquivo inteiro.
const PLACEHOLDER = /^\s*(?:\/\/|#|\/\*|\{\/\*|<!--)?\s*(?:\.\.\.|…)\s*(?:\(?\s*(?:resto|restante|o resto|rest|existing|código existente|mesmo|igual)[^\n]*)?(?:\*\/\}?|-->)?\s*$/im;
const ELLIPSIS_NOTE = /(?:\.\.\.|…)\s*\(?\s*(?:resto|restante|o resto do|rest of|existing code|código existente|sem alteraç)/i;

/** Caminho relativo do repositório, sem "..", sem barra inicial, sem caracteres estranhos. */
function safePath(p) {
  const s = String(p || '').trim().replace(/^\.\//, '');
  if (!s || s.length > 300 || s.startsWith('/') || s.includes('\\') || s.split('/').some(x => x === '..' || x === '')) return null;
  return /^[\w@.()[\] +-]+(?:\/[\w@.()[\] +-]+)*$/.test(s) ? s : null;
}

/** Blocos SEARCH/REPLACE em `lines` (sem cercas). */
function searchBlocks(lines, path, out) {
  for (let i = 0; i < lines.length; i++) {
    const h = HEADER.exec(lines[i]);
    if (h) {   // caminho inválido (absoluto, com "..") não herda o anterior: os blocos seguintes ficam sem arquivo
      path = safePath(h[1]);
      if (!path) out.problems.push(`caminho recusado: ${String(h[1]).slice(0, 80)}`);
      continue;
    }
    if (!S_OPEN.test(lines[i])) {
      const b = BARE_PATH.exec(lines[i]);
      if (b && safePath(b[1]) && b[1].includes('/')) path = safePath(b[1]);
      continue;
    }
    const find = [], repl = [];
    let j = i + 1, mid = false, closed = false;
    for (; j < lines.length; j++) {
      if (!mid && S_MID.test(lines[j])) { mid = true; continue; }
      if (mid && S_CLOSE.test(lines[j])) { closed = true; break; }
      (mid ? repl : find).push(lines[j]);
    }
    if (closed && path && find.join('\n').trim()) out.edits.push({ path, find: find.join('\n'), replace: repl.join('\n') });
    else if (!closed || !path) out.problems.push(!path ? 'bloco SEARCH sem "ARQUIVO: caminho" antes' : 'bloco SEARCH sem ">>>>>>> REPLACE"');
    i = j;
  }
  return path;
}

/**
 * Extrai edições de um texto de agente.
 * @returns {{ edits: {path,find,replace}[], files: {path,content}[], problems: string[] }}
 */
function parseEditBlocks(text) {
  const out = { edits: [], files: [], problems: [] };
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let path = null;        // último caminho declarado (vale para os blocos SEARCH seguintes)
  let pending = null;     // caminho declarado na linha logo antes de uma cerca (arquivo inteiro)
  const plain = [];
  const flush = () => { if (plain.length) { path = searchBlocks(plain.splice(0), path, out); } };
  for (let i = 0; i < lines.length; i++) {
    const f = FENCE.exec(lines[i]);
    if (!f) {
      const h = HEADER.exec(lines[i]) || (BARE_PATH.exec(lines[i]) && lines[i].includes('/') ? BARE_PATH.exec(lines[i]) : null);
      if (h && safePath(h[1])) pending = safePath(h[1]);
      else if (lines[i].trim()) pending = S_OPEN.test(lines[i]) ? pending : null;
      plain.push(lines[i]);
      continue;
    }
    flush();
    const marker = f[1];
    const info = f[2].trim();
    const body = [];
    let j = i + 1;
    for (; j < lines.length && !(lines[j].trim().startsWith(marker[0].repeat(marker.length)) && !lines[j].trim().slice(marker.length).trim()); j++) body.push(lines[j]);
    i = j;
    const infoPath = safePath((/(?:^|\s)(?:path|file|arquivo)?=?((?:[\w@.()[\]-]+\/)+[\w@.()[\]-]+\.[A-Za-z0-9]{1,8})\b/.exec(info) || [])[1]);
    if (body.some(l => S_OPEN.test(l))) { path = searchBlocks(body, infoPath || path, out); pending = null; continue; }
    const target = pending || infoPath;
    pending = null;
    if (!target) continue;   // trecho de código ilustrativo, sem caminho: não é edição
    const content = `${body.join('\n')}\n`;
    if (PLACEHOLDER.test(content) || ELLIPSIS_NOTE.test(content)) { out.problems.push(`${target}: arquivo inteiro com "..." no lugar de código; mande o arquivo completo ou blocos SEARCH/REPLACE`); continue; }
    if (!content.trim()) continue;
    out.files = out.files.filter(x => x.path !== target);
    out.files.push({ path: target, content });
    path = target;
  }
  flush();
  // Mesmo arquivo como inteiro e por trechos: o arquivo inteiro já tem tudo.
  const whole = new Set(out.files.map(x => x.path));
  out.edits = out.edits.filter(e => !whole.has(e.path));
  return out;
}

module.exports = { parseEditBlocks, safePath, FORMAT_HELP };
