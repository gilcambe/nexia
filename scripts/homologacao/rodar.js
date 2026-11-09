#!/usr/bin/env node
// Homologação Kernex (épico #3264, parte H1 #3265): nenhuma versão sai sem verde.
// Roda TODOS os casos: (1) cada arquivo de tests/unit vira um caso automático do produto dele;
// (2) os casos do catálogo homologacao/catalogo/*.json (bugs do dono, casos obrigatórios).
// Caso que falha roda de novo 1 vez: passou na 2a = "instavel" (não bloqueia, aparece no relatório);
// falhou 2 vezes = "vermelho" (bloqueia). Caso do catálogo sem arquivo de teste = "falta-teste" (bloqueia
// se obrigatorio: true). Saída: homologacao-resultado.json + homologacao-resumo.md. Sai com 1 se bloqueou.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');

// Prefixo do nome do arquivo de teste -> produto.
const PRODUTOS = [
  [/^(body|coach|treino)/, 'body-coach'],
  [/^(prumo|kf|finance)/, 'kernex-finance'],
  [/^(central|kernex|pedidos|saude|maquinas)/, 'central'],
  [/^(cortex|orchestrator|jules|vigia|cota|model|escada|licao|gestor|passagem|ia-|revisor)/, 'cortex'],
  [/^(viajante|viagem)/, 'viajante-pro'],
  [/^bezsan/, 'bezsan'],
  [/^(agenda|studio)/, 'studio-lima'],
  [/^(site|cloner|lote|renderizar|cliente|locacao|adriano)/, 'sites-clientes'],
];
function produtoDe(arquivo) {
  const nome = path.basename(arquivo);
  for (const [re, p] of PRODUTOS) if (re.test(nome)) return p;
  return 'plataforma';
}

function casosAutomaticos(raiz = RAIZ) {
  const dir = path.join(raiz, 'tests', 'unit');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().map(f => ({
    id: 'U-' + f.replace(/\.test\.js$/, ''), produto: produtoDe(f), titulo: f, tipo: 'unit',
    teste: path.join('tests', 'unit', f), obrigatorio: true, auto: true,
  }));
}

function casosDoCatalogo(raiz = RAIZ) {
  const dir = path.join(raiz, 'homologacao', 'catalogo');
  if (!fs.existsSync(dir)) return [];
  const casos = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const dados = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const c of dados.casos || []) casos.push({ obrigatorio: true, tipo: 'unit', ...c, produto: c.produto || dados.produto });
  }
  return casos;
}

// Junta: um caso do catálogo que aponta para o mesmo arquivo de um automático substitui o automático
// (o arquivo roda 1 vez só, com o id e o título do catálogo).
function montarCasos(raiz = RAIZ) {
  const cat = casosDoCatalogo(raiz);
  const doCatalogo = new Set(cat.map(c => c.teste));
  return [...casosAutomaticos(raiz).filter(c => !doCatalogo.has(c.teste)), ...cat];
}

function comando(caso) {
  if (caso.comando) return ['bash', ['-c', caso.comando]];
  if (caso.tipo === 'unit' || /\.test\.js$/.test(caso.teste)) return [process.execPath, ['--test', caso.teste]];
  return [process.execPath, [caso.teste]];
}

function executar(caso, raiz, limiteMs) {
  return new Promise(resolve => {
    const [cmd, args] = comando(caso);
    const t0 = Date.now(); let log = '';
    const env = { ...process.env, CI: 'true' }; delete env.NODE_TEST_CONTEXT; // senão o filho conta como subteste do pai
    const p = spawn(cmd, args, { cwd: raiz, env });
    const fim = setTimeout(() => { log += `\n[homologação] passou de ${limiteMs / 1000}s, parado`; p.kill('SIGKILL'); }, limiteMs);
    p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; });
    p.on('close', code => {
      clearTimeout(fim);
      const ok = code === 0 && (!caso.sucesso || log.includes(caso.sucesso));
      resolve({ ok, ms: Date.now() - t0, log: log.slice(-4000) });
    });
  });
}

// Regras de status (testadas em tests/unit/homologacao.test.js).
function statusDoCaso(tentativas) {
  if (tentativas[0] && tentativas[0].ok) return 'verde';
  if (tentativas[1] && tentativas[1].ok) return 'instavel';
  return 'vermelho';
}
function statusDoProduto(casos) {
  if (casos.some(c => (c.status === 'vermelho' || c.status === 'falta-teste') && c.obrigatorio !== false)) return 'vermelho';
  if (casos.some(c => c.status !== 'verde')) return 'instavel';
  return 'verde';
}

async function rodarCaso(caso, raiz, limiteMs) {
  if (!caso.teste || !fs.existsSync(path.join(raiz, caso.teste))) {
    return { ...caso, status: 'falta-teste', ms: 0, log: `arquivo de teste não existe: ${caso.teste}` };
  }
  const a = await executar(caso, raiz, limiteMs);
  if (a.ok) return { ...caso, status: 'verde', ms: a.ms };
  const b = await executar(caso, raiz, limiteMs);
  return { ...caso, status: statusDoCaso([a, b]), ms: a.ms + b.ms, log: (b.ok ? a.log : b.log) };
}

async function rodarTudo({ raiz = RAIZ, produto, paralelo = Math.max(2, os.cpus().length), limiteMs = 300000 } = {}) {
  let casos = montarCasos(raiz);
  if (produto) casos = casos.filter(c => c.produto === produto);
  const saida = new Array(casos.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(paralelo, casos.length) }, async () => {
    while (i < casos.length) { const n = i++; saida[n] = await rodarCaso(casos[n], raiz, limiteMs); }
  }));
  const produtos = {};
  for (const c of saida) (produtos[c.produto] = produtos[c.produto] || { casos: [] }).casos.push(c);
  for (const p of Object.values(produtos)) {
    p.status = statusDoProduto(p.casos);
    p.total = p.casos.length; p.verdes = p.casos.filter(c => c.status === 'verde').length;
    for (const c of p.casos) if (c.status === 'verde') delete c.log;
  }
  const bloqueado = Object.values(produtos).some(p => p.status === 'vermelho');
  return { quando: new Date().toISOString(), commit: process.env.GITHUB_SHA || '', aprovado: !bloqueado, produtos };
}

function resumoMd(r) {
  const nome = { verde: '🟢 VERDE', instavel: '🟡 INSTÁVEL', vermelho: '🔴 VERMELHO', 'falta-teste': '🔴 FALTA TESTE' };
  const linhas = [`# Homologação Kernex — ${r.aprovado ? 'APROVADO' : 'REPROVADO (versão bloqueada)'}`, '',
    `Commit ${r.commit.slice(0, 7) || '(local)'} · ${r.quando}`, '', '| Produto | Status | Casos verdes |', '|---|---|---|'];
  for (const [p, d] of Object.entries(r.produtos).sort()) linhas.push(`| ${p} | ${nome[d.status]} | ${d.verdes}/${d.total} |`);
  const ruins = Object.values(r.produtos).flatMap(d => d.casos).filter(c => c.status !== 'verde');
  if (ruins.length) {
    linhas.push('', '## O que não passou', '');
    for (const c of ruins) linhas.push(`- ${nome[c.status]} **${c.id}** (${c.produto}) ${c.titulo || ''}${c.origem ? ' — origem: ' + c.origem : ''}`);
  }
  return linhas.join('\n') + '\n';
}

if (require.main === module) {
  const produto = (process.argv.find(a => a.startsWith('--produto=')) || '').split('=')[1] || process.env.HOMOLOGACAO_PRODUTO || '';
  rodarTudo({ produto: produto || undefined }).then(r => {
    fs.writeFileSync(path.join(RAIZ, 'homologacao-resultado.json'), JSON.stringify(r, null, 2));
    const md = resumoMd(r);
    fs.writeFileSync(path.join(RAIZ, 'homologacao-resumo.md'), md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    console.log(md);
    process.exit(r.aprovado ? 0 : 1);
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { produtoDe, casosAutomaticos, casosDoCatalogo, montarCasos, statusDoCaso, statusDoProduto, rodarCaso, rodarTudo, resumoMd };
