'use strict';
// Pedido de cópia literal: "Copie EXATAMENTE ... `caminho` ... ```bloco```". Os modelos grátis reescrevem ou cortam
// o código mesmo assim (o arquivo ficava com 366 bytes e não compilava), então o orquestrador grava o conteúdo
// direto pelo Tool Gateway, sem modelo, e só chama o agente se o pedido ainda manda editar outro arquivo.

const CAMINHO = /^[\w@.()[\]-]+(?:\/[\w@.()[\]-]+)*\.[A-Za-z0-9]{1,8}$/;

function arquivosLiterais(message) {
  const t = String(message || '');
  if (!/copie exatamente/i.test(t)) return [];
  const out = [];
  for (const m of t.matchAll(/`([^`\n]+)`[^\n`]*\n\s*```[\w-]*\n([\s\S]*?)\n```/g)) {
    const path = m[1].trim().replace(/^\.\//, '');
    if (CAMINHO.test(path) && !path.startsWith('/') && !path.split('/').includes('..') && !out.some(f => f.path === path)) out.push({ path, content: `${m[2]}\n` });
  }
  return out.slice(0, 8);
}

// Fora dos blocos de código ainda há instrução de editar um arquivo existente (ex.: "acrescente uma linha em ...").
function temEdicaoExtra(message) {
  const fora = String(message || '').replace(/```[\s\S]*?```/g, '');
  return /\b(acrescente|troque|substitua|edite|altere|adicione)\b/i.test(fora) && !/n[ãa]o (?:edite|altere|mexa)/i.test(fora);
}

module.exports = { arquivosLiterais, temEdicaoExtra };
