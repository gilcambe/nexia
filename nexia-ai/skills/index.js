'use strict';

const fs = require('node:fs');
const path = require('node:path');

function normalizar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function palavras(texto, minimo = 4) {
  return normalizar(texto).split(/\s+/).filter(p => p.length >= minimo);
}

function extrairFrontmatter(conteudo) {
  const match = conteudo.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const dados = {};
  for (const linha of match[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i === -1) continue;
    const chave = linha.slice(0, i).trim();
    const valor = linha.slice(i + 1).trim();
    if (chave) dados[chave] = valor;
  }
  return dados;
}

function listar(pasta) {
  if (typeof pasta !== 'string' || !pasta) return [];
  let entradas;
  try {
    entradas = fs.readdirSync(pasta, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const resultado = [];
  for (const entrada of entradas) {
    if (!entrada.isDirectory()) continue;
    const caminho = path.join(pasta, entrada.name, 'SKILL.md');
    let conteudo;
    try {
      conteudo = fs.readFileSync(caminho, 'utf8');
    } catch (e) {
      continue;
    }
    const fm = extrairFrontmatter(conteudo);
    if (!fm) continue;
    const nome = fm.name || entrada.name;
    const descricao = fm.description !== undefined ? fm.description : '';
    if (!nome) continue;
    resultado.push({ nome, descricao });
  }
  resultado.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  return resultado;
}

function catalogo(lista) {
  if (!Array.isArray(lista)) return 'SKILLS DISPONÍVEIS:';
  const linhas = lista
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      return `- ${String(item.nome || '')}: ${String(item.descricao || '')}`;
    })
    .filter(l => l !== '');
  if (linhas.length === 0) return 'SKILLS DISPONÍVEIS:';
  return 'SKILLS DISPONÍVEIS:\n' + linhas.join('\n');
}

function escolher(pedido, lista, max = 2) {
  if (typeof pedido !== 'string' || !pedido) return [];
  if (!Array.isArray(lista)) return [];
  const m = Number(max);
  if (!Number.isFinite(m) || m < 1) return [];
  const palavrasPedido = new Set(palavras(pedido));
  if (palavrasPedido.size === 0) return [];
  const pontuadas = [];
  for (const skill of lista) {
    if (!skill || typeof skill !== 'object') continue;
    const descPalavras = palavras(skill.descricao);
    let comuns = 0;
    for (const p of descPalavras) if (palavrasPedido.has(p)) comuns++;
    if (comuns > 0) pontuadas.push({ skill, comuns });
  }
  pontuadas.sort((a, b) => b.comuns - a.comuns);
  return pontuadas.slice(0, m).map(x => x.skill);
}

function carregar(nome, pasta) {
  if (typeof nome !== 'string' || !nome) return '';
  if (typeof pasta !== 'string' || !pasta) return '';
  const caminho = path.join(pasta, nome, 'SKILL.md');
  let conteudo;
  try {
    conteudo = fs.readFileSync(caminho, 'utf8');
  } catch (e) {
    return '';
  }
  const fm = extrairFrontmatter(conteudo);
  if (!fm) return '';
  const fimFrontmatter = conteudo.indexOf('---', conteudo.indexOf('---\n') + 4);
  let corpo;
  if (fimFrontmatter === -1) corpo = conteudo;
  else corpo = conteudo.slice(fimFrontmatter + 3);
  const corpoLimpo = corpo.replace(/^\r?\n/, '');
  return corpoLimpo.slice(0, 6000);
}

module.exports = { listar, catalogo, escolher, carregar };
