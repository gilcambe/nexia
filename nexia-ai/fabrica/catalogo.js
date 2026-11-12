'use strict';
// Biblioteca KERNEX (fábrica por módulos, 12/11/2026): carrega e confere o catalogo.json.
const CATALOGO = require('./catalogo.json');

// E-mail, telefone com DDI, ou valor de segredo ("senha: x", "token=x", chave sk-...). Descrever "painel com senha" pode.
const DADO_SENSIVEL = /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}|\b55\d{10,11}\b|\b(senha|token|apikey|api_key|secret)\s*[:=]|\bsk-[a-z0-9]{8,}/i;
const sem = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function carregar() { return CATALOGO; }

/** Lista de problemas (vazia = ok): ids únicos, modelo só com módulo existente, sem dado pessoal. */
function validarCatalogo(c) {
  const erros = [];
  const ids = new Set();
  for (const m of c.modulos || []) {
    if (!m.id || ids.has(m.id)) erros.push(`módulo sem id ou repetido: ${m.id}`);
    ids.add(m.id);
    if (![1, 2, 3].includes(m.nivel)) erros.push(`${m.id}: nível deve ser 1, 2 ou 3`);
    if (!m.nome || !m.faz || !m.onde) erros.push(`${m.id}: falta nome, faz ou onde`);
  }
  const idsModelo = new Set();
  for (const mo of c.modelos || []) {
    if (!mo.id || idsModelo.has(mo.id)) erros.push(`modelo sem id ou repetido: ${mo.id}`);
    idsModelo.add(mo.id);
    for (const x of mo.modulos || []) if (!ids.has(x)) erros.push(`${mo.id}: usa módulo que não existe (${x})`);
  }
  if (DADO_SENSIVEL.test(JSON.stringify(c))) erros.push('catálogo com dado pessoal ou segredo');
  return erros;
}

module.exports = { carregar, validarCatalogo, sem, DADO_SENSIVEL };
