'use strict';
// Checagem estática dos arquivos web que um agente criou ou mudou (ADR-Q-02). Não executa nada:
// só lê o texto. Erros voltam ao agente como "changes_requested" antes da revisão por IA (que custa
// cota); avisos vão para o Reviewer conferir. Pega o que modelos grátis mais erram: tag sem fechar,
// imagem/arquivo que não existe, img sem alt, JS que nem compila, CSS com chave sobrando.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
// Fechamento opcional no HTML: o próximo irmão ou o pai fecha sozinho.
const OPTIONAL = new Set(['p', 'li', 'dt', 'dd', 'option', 'optgroup', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'colgroup', 'rt', 'rp', 'html', 'head', 'body']);
const SIBLING_CLOSES = new Set(['p', 'li', 'dt', 'dd', 'option', 'tr', 'td', 'th']);
const WEB = /\.(html?|css|m?js)$/i;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{\{|\$\{)/i;

const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
const attrsOf = raw => {
  const out = {};
  for (const m of String(raw || '').matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
};

/** Caminho relativo de um arquivo do repositório → caminho no repositório (ou null se externo). */
function resolveRef(fromPath, ref) {
  const clean = String(ref || '').trim().split(/[?#]/)[0];
  if (!clean || EXTERNAL.test(ref.trim())) return null;
  const parts = clean.startsWith('/') ? [] : fromPath.split('/').slice(0, -1);
  for (const seg of clean.replace(/^\/+/, '').split('/')) {
    if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function checkHtml(path, html) {
  const errors = [], warnings = [], refs = [];
  const err = (i, msg) => errors.push({ file: path, line: lineAt(html, i), message: msg });
  const warn = (i, msg) => warnings.push({ file: path, line: lineAt(html, i), message: msg });
  const src = html.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length));
  const stack = [];
  const ids = new Map();
  const labelsFor = new Set();
  const fields = [];
  const anchors = [];
  const media = [];
  let mediaCount = 0;
  let tags = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    const text = src.slice(last, m.index).trim();
    if (text && /^["'`]+$/.test(text)) err(last, `texto solto ${text} no meio do HTML (provável tag apagada por engano)`);
    last = re.lastIndex;
    tags++;
    const [, close, rawName, rawAttrs] = m;
    const name = rawName.toLowerCase();
    if (close) {
      if (VOID.has(name)) continue;
      let k = stack.length - 1;
      while (k >= 0 && stack[k].name !== name && OPTIONAL.has(stack[k].name)) k--;
      if (k >= 0 && stack[k].name === name) { stack.length = k; continue; }
      const top = stack[stack.length - 1];
      err(m.index, top ? `</${name}> fecha <${top.name}> aberto na linha ${lineAt(html, top.at)}` : `</${name}> sem <${name}> aberto`);
      const j = stack.map(s => s.name).lastIndexOf(name);
      if (j >= 0) stack.length = j;
      continue;
    }
    const a = attrsOf(rawAttrs);
    if (a.id !== undefined) {
      if (ids.has(a.id)) err(m.index, `id "${a.id}" repetido (já usado na linha ${lineAt(html, ids.get(a.id))})`);
      else ids.set(a.id, m.index);
    }
    if (name === 'html' && !a.lang) warn(m.index, '<html> sem lang');
    if (name === 'img') {
      if (a.alt === undefined) err(m.index, '<img> sem alt (acessibilidade)');
      if (!a.width || !a.height) warn(m.index, '<img> sem width/height (a página "pula" ao carregar)');
    }
    if (name === 'label' && a.for) labelsFor.add(a.for);
    if (['input', 'select', 'textarea'].includes(name) && !['hidden', 'submit', 'button', 'reset', 'image'].includes((a.type || '').toLowerCase())) {
      fields.push({ at: m.index, id: a.id, labelled: a['aria-label'] !== undefined || a['aria-labelledby'] !== undefined, inLabel: stack.some(s => s.name === 'label') });
    }
    if (name === 'button' && a.disabled !== undefined && (a.type || 'submit') === 'submit') warn(m.index, 'botão de envio começa desabilitado; confira se o JavaScript o habilita');
    if (name === 'a' && a.href !== undefined) anchors.push({ at: m.index, href: a.href });
    for (const k of ['src', 'href', 'poster']) if (a[k] && !(name === 'a' && k === 'href')) refs.push({ file: path, line: lineAt(html, m.index), ref: a[k] });
    if (['img', 'video', 'source'].includes(name)) {
      for (const k of ['src', 'poster']) if (a[k] && /^https?:\/\//i.test(a[k])) media.push({ file: path, line: lineAt(html, m.index), url: a[k] });
      if (name === 'img' || name === 'video') mediaCount++;
    }
    if (name === 'a' && a.href) refs.push({ file: path, line: lineAt(html, m.index), ref: a.href, page: true });
    if (/\/\s*$/.test(rawAttrs) || VOID.has(name)) continue;
    if (RAW.has(name)) {
      const end = src.toLowerCase().indexOf(`</${name}`, re.lastIndex);
      if (end < 0) { err(m.index, `<${name}> sem </${name}>`); break; }
      re.lastIndex = end; last = end;
    }
    const top = stack[stack.length - 1];
    if (top && top.name === name && SIBLING_CLOSES.has(name)) stack.pop();   // <li>…<li>: o segundo fecha o primeiro
    stack.push({ name, at: m.index });
  }
  for (const s of stack) if (!OPTIONAL.has(s.name)) err(s.at, `<${s.name}> nunca foi fechado`);
  if (tags && /<html[\s>]/i.test(src)) {
    if (!/<title[\s>]/i.test(src)) warn(0, 'página sem <title>');
    if (!/<meta[^>]+name=["']?viewport/i.test(src)) warn(0, 'página sem <meta name="viewport"> (não fica responsiva no celular)');
  }
  for (const f of fields) if (!f.labelled && !f.inLabel && !(f.id && labelsFor.has(f.id))) warn(f.at, 'campo de formulário sem <label> ligado a ele');
  for (const x of anchors) {
    if (x.href === '#' || x.href === '') warn(x.at, 'link vazio (href="#")');
    else if (x.href.startsWith('#') && !/^#[/!]/.test(x.href) && !ids.has(decodeURIComponent(x.href.slice(1)))) err(x.at, `link para ${x.href}, mas não existe elemento com esse id`);
  }
  return { errors, warnings, refs, media, mediaCount, isPage: /<html[\s>]/i.test(src) };
}

function checkCss(path, css) {
  const errors = [], refs = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, m => m.replace(/[{}]/g, ' '));
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth < 0) { errors.push({ file: path, line: lineAt(css, i), message: '"}" sobrando no CSS' }); depth = 0; }
  }
  if (depth > 0) errors.push({ file: path, line: lineAt(css, css.length), message: `${depth} bloco(s) do CSS sem "}"` });
  const media = [];
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    refs.push({ file: path, line: lineAt(css, m.index), ref: m[1] });
    if (/^https?:\/\//i.test(m[1]) && !/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(m[1])) media.push({ file: path, line: lineAt(css, m.index), url: m[1] });
  }
  return { errors, warnings: [], refs, media, mediaCount: media.length };
}

function checkJs(path, code) {
  // Só checa sintaxe de script comum (módulos com import/export ficam para o Reviewer). Function()
  // compila sem executar; onde não existe (Worker), a checagem é pulada.
  if (/^\s*(?:import|export)\b/m.test(code)) return { errors: [], warnings: [], refs: [] };
  try { new Function(code); } catch (e) { // eslint-disable-line no-new-func
    if (e instanceof SyntaxError) return { errors: [{ file: path, message: `JavaScript não compila: ${e.message}` }], warnings: [], refs: [] };
  }
  return { errors: [], warnings: [], refs: [] };
}

// ADR-Q-03: o mínimo visual de uma página NOVA de site ou sistema. Lê o HTML e o CSS/JS que ele usa
// (arquivos alterados); estilo inline (<style>) também conta.
function checkDesign(page, files, kind) {
  const errors = [], warnings = [];
  const err = msg => errors.push({ file: page.path, message: msg });
  const css = files.filter(f => /\.css$/i.test(f.path)).map(f => f.content).join('\n') + (page.content.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
  const js = files.filter(f => /\.m?js$/i.test(f.path)).map(f => f.content).join('\n') + (page.content.match(/<script[\s\S]*?<\/script>/gi) || []).join('\n');
  if (!/fonts\.googleapis\.com|@font-face/i.test(page.content + css)) err('sem fonte da web: use um par do Google Fonts (link no <head>)');
  if (!/:root\s*\{[^}]*--[\w-]+\s*:/.test(css)) err('sem variáveis de cor/medida no :root (--primary, --accent, --bg, --text...)');
  if (!/@media[^{]*\(\s*(max|min)-width/i.test(css)) err('sem @media (max-width/min-width): o layout não se adapta ao celular');
  if (!/\btransition\s*:|\banimation\s*:|@keyframes/i.test(css)) err('sem movimento: falta transition/animation/@keyframes (hover, entrada do topo, revelar ao rolar)');
  if (kind === 'site' && !/IntersectionObserver/.test(js)) warnings.push({ file: page.path, message: 'nada aparece ao rolar a página (IntersectionObserver + .reveal)' });
  if (kind === 'site') {
    const imgs = page.mediaCount + files.filter(f => /\.css$/i.test(f.path)).reduce((n, f) => n + (f.check.mediaCount || 0), 0)
      + (page.content.match(/url\(\s*["']?https?:/gi) || []).length;
    if (imgs < 4) err(`só ${imgs} foto(s)/vídeo(s): um site precisa de pelo menos 4 fotos reais (use media.search_images), incluindo o topo`);
    if (!/<header[\s>]/i.test(page.content) || !/<footer[\s>]/i.test(page.content)) err('falta <header> ou <footer>');
  }
  if (kind === 'system' && !/<(nav|aside)[\s>]/i.test(page.content)) err('sistema sem navegação (<nav> ou <aside> com o menu)');
  return { errors, warnings };
}

/**
 * @param {{ path: string, content: string }[]} files  arquivos web alterados (conteúdo final)
 * @param {{ design?: 'site'|'system'|null, added?: Set<string> }} [opts]  design: checa o padrão visual das páginas novas
 * @returns {{ errors, warnings, missingCandidates: { file, line, ref, path }[], externalMedia: { file, line, url }[] }}
 *   missingCandidates: arquivos locais referenciados que não estão entre os alterados (o chamador confere se existem)
 *   externalMedia: fotos/vídeos por link externo (o chamador confere se abrem)
 */
function checkWebFiles(files, opts = {}) {
  const errors = [], warnings = [], refs = [], externalMedia = [];
  const checked = [];
  for (const f of files) {
    const fn = /\.html?$/i.test(f.path) ? checkHtml : /\.css$/i.test(f.path) ? checkCss : /\.m?js$/i.test(f.path) ? checkJs : null;
    if (!fn || typeof f.content !== 'string') continue;
    const r = fn(f.path, f.content);
    errors.push(...r.errors); warnings.push(...r.warnings); refs.push(...r.refs);
    for (const m of r.media || []) if (!externalMedia.some(x => x.url === m.url)) externalMedia.push(m);
    checked.push({ ...f, check: r, mediaCount: r.mediaCount || 0 });
  }
  if (opts.design) {
    for (const page of checked.filter(f => f.check.isPage && (!opts.added || opts.added.has(f.path)))) {
      const d = checkDesign(page, checked, opts.design);
      errors.push(...d.errors); warnings.push(...d.warnings);
    }
  }
  const have = new Set(files.map(f => f.path));
  const missingCandidates = [];
  for (const r of refs) {
    const p = resolveRef(r.file, r.ref);
    if (!p || have.has(p) || (r.page && !/\.[a-z0-9]+$/i.test(p))) continue;
    if (!missingCandidates.some(x => x.path === p)) missingCandidates.push({ ...r, path: p });
  }
  return { errors, warnings, missingCandidates, externalMedia };
}

const fmt = list => list.map(x => `${x.file}${x.line ? `:${x.line}` : ''}: ${x.message}`).join(' | ');

module.exports = { WEB, checkWebFiles, checkDesign, checkHtml, checkCss, checkJs, resolveRef, fmt };
