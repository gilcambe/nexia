'use strict';
// Detecção de stack, scripts, Firebase, Cloudflare, hosting e documentação a
// partir dos ARQUIVOS do repositório (spec §20, passos 5–8 e 10). Só lê; não
// executa nada do repositório. Cada conclusão vem com a evidência (arquivo).

const MAX_LIST = 300;

// dependência → [stack, framework]
const DEP_MAP = {
  react: ['react', 'react'], 'react-dom': ['react', null], next: ['react', 'next'], vue: ['vue', 'vue'], nuxt: ['vue', 'nuxt'],
  svelte: ['svelte', 'svelte'], '@sveltejs/kit': ['svelte', 'sveltekit'], '@angular/core': ['angular', 'angular'],
  vite: [null, 'vite'], express: [null, 'express'], fastify: [null, 'fastify'], koa: [null, 'koa'], '@nestjs/core': [null, 'nestjs'],
  tailwindcss: [null, 'tailwindcss'], typescript: ['typescript', null], firebase: ['firebase', null], 'firebase-admin': ['firebase', null],
  'firebase-functions': ['firebase', 'firebase-functions'], '@playwright/test': [null, 'playwright'], jest: [null, 'jest'], vitest: [null, 'vitest'],
  'react-router-dom': [null, 'react-router'], i18next: [null, 'i18next'], wrangler: ['cloudflare', null], '@cloudflare/workers-types': ['cloudflare', null],
  '@anthropic-ai/sdk': [null, 'anthropic-sdk'], prisma: [null, 'prisma'], '@prisma/client': [null, 'prisma'], mongoose: [null, 'mongoose'],
};

// Valores de exemplo comuns em configs web do Firebase: não são projetos reais.
const PLACEHOLDER_PROJECT = /^(your|my|example|demo|test|sample)[-_]|^\d+$|project-id$|-project$/;

const FILE_LANG = { '.js': 'javascript', '.cjs': 'javascript', '.mjs': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.go': 'go', '.rb': 'ruby', '.php': 'php', '.java': 'java', '.kt': 'kotlin', '.rs': 'rust', '.dart': 'dart', '.cs': 'csharp' };

const ext = p => { const m = /\.[^./]+$/.exec(p); return m ? m[0].toLowerCase() : ''; };
const uniq = a => [...new Set(a.filter(Boolean))];

function parseJson(text) { try { return JSON.parse(text); } catch { return null; } }

/** YAML mínimo para render.yaml: extrai serviços (name, type, branch, URLs nos envVars). */
function parseRenderYaml(text) {
  const services = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    const item = /^\s{2}-\s+type:\s*(\S+)/.exec(line);
    if (item) { cur = { type: item[1], name: null, branch: null, urls: [] }; services.push(cur); continue; }
    if (!cur) continue;
    let m;
    if ((m = /^\s{4}name:\s*["']?([^"'\s]+)/.exec(line))) cur.name = m[1];
    else if ((m = /^\s{4}branch:\s*["']?([^"'\s]+)/.exec(line))) cur.branch = m[1];
    else if ((m = /^\s+value:\s*["']?(https:\/\/[^"'\s]+)/.exec(line))) cur.urls.push(m[1].replace(/\/$/, ''));
  }
  for (const s of services) s.urls = uniq(s.urls);
  return services;
}

/** Nomes de variáveis declarados num .env.example (nunca os valores). */
function envNames(text) {
  return uniq(text.split(/\r?\n/).map(l => /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(l)).map(m => m && m[1]));
}

/**
 * @param {string[]} files  caminhos relativos (separador '/')
 * @param {(path: string) => Promise<string|null>} read  conteúdo de um arquivo ou null
 */
async function detect(files, read) {
  const set = new Set(files);
  const has = p => set.has(p);
  const evidence = [];
  const ev = (what, file) => evidence.push({ what, file });

  const stack = [];
  const frameworks = [];
  const patterns = [];
  const commands = {};
  let nodeEngine = null;

  // Linguagens pela contagem de arquivos (fora de dependências e build)
  const langCount = {};
  for (const f of files) {
    if (/(^|\/)(node_modules|dist|out|build|vendor)\//.test(f)) continue;
    const l = FILE_LANG[ext(f)];
    if (l) langCount[l] = (langCount[l] || 0) + 1;
  }
  const languages = Object.entries(langCount).sort((a, b) => b[1] - a[1]).map(([l]) => l);

  if (has('package.json')) {
    const pkg = parseJson(await read('package.json')) || {};
    stack.push('node'); ev('stack:node', 'package.json');
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const dep of Object.keys(deps).sort()) {
      const m = DEP_MAP[dep];
      if (!m) continue;
      if (m[0]) stack.push(m[0]);
      if (m[1]) frameworks.push(m[1]);
      ev(`dependency:${dep}`, 'package.json');
    }
    const scripts = pkg.scripts || {};
    const pick = names => names.map(n => (scripts[n] ? `npm run ${n}` : null)).find(Boolean);
    commands.dev = pick(['dev', 'serve', 'develop']);
    commands.build = pick(['build']);
    commands.test = scripts.test ? 'npm test' : pick(['test:unit']);
    commands.start = scripts.start ? 'npm start' : undefined;
    for (const k of Object.keys(commands)) if (!commands[k]) delete commands[k];
    if (Object.keys(commands).length) ev('commands', 'package.json');
    nodeEngine = pkg.engines && typeof pkg.engines.node === 'string' ? pkg.engines.node : null;
  }
  if (has('requirements.txt') || has('pyproject.toml')) { stack.push('python'); ev('stack:python', has('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt'); }
  if (has('go.mod')) { stack.push('go'); ev('stack:go', 'go.mod'); }
  if (has('tsconfig.json')) { stack.push('typescript'); ev('stack:typescript', 'tsconfig.json'); }

  // Firebase
  let firebase = null;
  if (has('firebase.json')) {
    const fb = parseJson(await read('firebase.json')) || {};
    firebase = { services: Object.keys(fb).filter(k => ['hosting', 'functions', 'firestore', 'storage', 'database', 'emulators', 'remoteconfig', 'extensions'].includes(k)).sort() };
    stack.push('firebase'); ev('firebase.json', 'firebase.json');
  }
  let firebaseProject = null;
  if (has('.firebaserc')) {
    const rc = parseJson(await read('.firebaserc')) || {};
    const p = rc.projects && (rc.projects.default || Object.values(rc.projects)[0]);
    if (typeof p === 'string') { firebaseProject = p; ev('firebase_project', '.firebaserc'); }
  }
  if (!firebaseProject) {
    // Config web do Firebase embutida no código (pública por natureza). Ignora valores de exemplo.
    const candidates = files.filter(f => ['.html', '.js', '.ts', '.tsx', '.jsx'].includes(ext(f))
      && !/(^|\/)(node_modules|tests?|__tests__|dist|out|build|docs?)\//.test(f)).slice(0, 60);
    const votes = {};
    for (const f of candidates) {
      const text = await read(f);
      if (!text) continue;
      for (const m of text.matchAll(/projectId\s*:\s*["']([a-z0-9-]{4,30})["']/g)) {
        if (PLACEHOLDER_PROJECT.test(m[1])) continue;
        (votes[m[1]] = votes[m[1]] || []).push(f);
      }
    }
    const best = Object.entries(votes).sort((a, b) => b[1].length - a[1].length)[0];
    if (best) { firebaseProject = best[0]; ev('firebase_project', best[1][0]); }
  }

  // Cloudflare
  let cloudflareRef = null;
  const wrangler = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].find(has);
  if (wrangler) {
    stack.push('cloudflare'); ev('cloudflare', wrangler);
    const text = (await read(wrangler)) || '';
    const m = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(text) || /"name"\s*:\s*"([^"]+)"/.exec(text);
    if (m && /^[A-Za-z0-9_./:@-]+$/.test(m[1])) cloudflareRef = m[1];
  }

  // Hosting / deploy target e ambientes
  const environments = [];
  let deployTarget = null;
  if (has('render.yaml')) {
    const services = parseRenderYaml((await read('render.yaml')) || '');
    if (services.length) {
      deployTarget = 'render'; ev('deploy_target:render', 'render.yaml');
      environments.push({ name: 'production', provider: 'render', urls: uniq(services.flatMap(s => s.urls)),
        branch: services.find(s => s.branch)?.branch || null, source: 'render.yaml' });
    }
  }
  const hostingFiles = [['netlify.toml', 'netlify'], ['vercel.json', 'vercel']];
  for (const [file, provider] of hostingFiles) {
    if (has(file)) { deployTarget = deployTarget || provider; ev(`hosting:${provider}`, file); }
  }
  if (!deployTarget && wrangler) deployTarget = 'cloudflare';
  if (!deployTarget && firebase && firebase.services.includes('hosting')) deployTarget = 'firebase';

  // Padrões e CI
  const workflows = files.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).sort();
  if (workflows.length) { patterns.push('github-actions'); ev('ci', workflows[0]); }
  if (files.some(f => f.startsWith('netlify/functions/'))) patterns.push('netlify-functions-style handlers');
  if (has('firestore.rules')) patterns.push('firestore-rules-versioned');
  if (files.some(f => /(^|\/)tests?\/e2e\//.test(f)) || frameworks.includes('playwright')) patterns.push('e2e-tests');
  if (has('Dockerfile')) patterns.push('docker');

  // Documentação (spec §20 passo 10): lista, sem copiar conteúdo
  const docs = files.filter(f => /\.(md|mdx)$/i.test(f) && !/(^|\/)node_modules\//.test(f)
    && (!f.includes('/') || /^docs?\//i.test(f))).sort().slice(0, 50);

  // Variáveis de ambiente esperadas (somente nomes)
  const envFile = ['.env.example', '.env.sample', '.env.template'].find(has);
  const secretNames = envFile ? envNames((await read(envFile)) || '') : [];
  if (envFile) ev('env_names', envFile);

  // Estrutura: pastas de primeiro nível com contagem + arquivos da raiz
  const topDirs = {};
  const rootFiles = [];
  for (const f of files) {
    const i = f.indexOf('/');
    if (i === -1) rootFiles.push(f);
    else topDirs[f.slice(0, i)] = (topDirs[f.slice(0, i)] || 0) + 1;
  }
  const directoryStructure = [
    ...Object.keys(topDirs).sort().map(d => `${d}/ (${topDirs[d]})`),
    ...rootFiles.sort(),
  ].slice(0, MAX_LIST);

  const fw = uniq(frameworks).sort();
  const st = uniq(stack);
  const architecture = [
    st.length ? `Stack: ${st.join(', ')}.` : null,
    fw.length ? `Frameworks/bibliotecas: ${fw.join(', ')}.` : null,
    languages.length ? `Linguagens por número de arquivos: ${languages.slice(0, 4).join(', ')}.` : null,
    deployTarget ? `Deploy: ${deployTarget}.` : null,
    firebase ? `Firebase: ${firebase.services.join(', ') || 'configurado'}${firebaseProject ? ` (projeto ${firebaseProject})` : ''}.` : null,
    nodeEngine ? `Node ${nodeEngine}.` : null,
  ].filter(Boolean).join(' ');

  return {
    stack: st, frameworks: fw, languages, commands, nodeEngine,
    firebase, firebaseProject, cloudflareRef, deployTarget, environments,
    workflows, patterns: uniq(patterns), docs, secretNames, envFile: envFile || null, directoryStructure, architecture,
    fileCount: files.length, evidence,
  };
}

module.exports = { detect, parseRenderYaml, envNames, PLACEHOLDER_PROJECT };
