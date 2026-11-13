'use strict';
// #3564 (13/11/2026): mapa produto → pastas (fonte única). O planejador da fila usa para recusar parte que manda
// criar arquivo em pasta que o produto não usa (ex.: Kernex Finance mandado para src/lib/… ou workers/…).
const PRODUTOS = Object.freeze([
  { id: 'finance', nome: 'Kernex Finance', palavras: /\b(kernex finance|finance|prumo|fortune)\b/i, pastas: ['prumo/', 'netlify/functions/prumo', 'tests/unit/prumo-', 'public/prumo'] },
  { id: 'bodycoach', nome: 'Body Coach', palavras: /\bbody ?coach\b/i, pastas: ['apps/body-coach/', 'tests/unit/body-coach', 'divulga/'] },
  { id: 'viajante', nome: 'Viajante Pro', palavras: /\bviajante( ?pro)?\b/i, pastas: ['viajante-pro/', 'sites/viajantepro/', 'tests/unit/viajante', 'public/vp-', 'public/css/vp-', 'public/js/vp-'] },
  { id: 'central', nome: 'Central / Cortex', palavras: /\b(central|cortex)\b/i, pastas: ['src/', 'netlify/functions/central', 'nexia-ai/', 'scripts/', 'tests/'] },
]);

/** Produto citado no texto da issue (o primeiro que casar, na ordem acima: o mais específico vem antes). */
function produtoDoTexto(texto) {
  const t = String(texto || '');
  return PRODUTOS.find((p) => p.palavras.test(t)) || null;
}

const pastaMae = (c) => (c.includes('/') ? c.slice(0, c.lastIndexOf('/')) : '');

/**
 * Caminho aceito se: o arquivo já existe; ou (com produto) fica dentro das pastas do produto;
 * ou (sem produto identificado) a pasta-mãe já existe. `existe(caminho)` vem de fora (árvore real da develop).
 */
function caminhoValido(caminho, produto, existe) {
  const c = String(caminho || '').replace(/^\.?\//, '');
  if (!c || c.includes('..')) return false;
  if (existe(c)) return true;
  if (produto) return produto.pastas.some((p) => c.startsWith(p));
  const mae = pastaMae(c);
  return mae === '' ? false : existe(mae);
}

/** Lista dos caminhos recusados de um plano (vazia = plano ok). */
function caminhosRecusados(partes, texto, existe) {
  const produto = produtoDoTexto(texto);
  const ruins = [];
  for (const p of partes || []) for (const a of p.arquivos || []) if (!caminhoValido(a, produto, existe) && !ruins.includes(a)) ruins.push(a);
  return ruins;
}

module.exports = { PRODUTOS, produtoDoTexto, caminhoValido, caminhosRecusados };
