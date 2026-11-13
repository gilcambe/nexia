"use strict";

/**
 * Compras e assinaturas cadastradas. O nome de cada uma é o que aparece
 * na notificação e no comentário de rota.
 */

const fs = require('fs');
const path = require('path');

let comprasCache = null;

function carregarCompras() {
  if (comprasCache) return comprasCache;
  try {
    const caminho = path.join(__dirname, 'dados-compras.json');
    if (fs.existsSync(caminho)) {
      comprasCache = JSON.parse(fs.readFileSync(caminho, 'utf8'));
      return comprasCache;
    }
  } catch (e) {
    // ignora e usa padrao
  }
  return [
    { id: 1, nome: "Serviço Cloud Pro", valor: 150.00, vencimento: "2026-03-10", categoria: "Infraestrutura" },
    { id: 2, nome: "Ferramenta IA Avançada", valor: 90.00, vencimento: "2026-03-15", categoria: "Software" },
    { id: 3, nome: "Hospedagem Web", valor: 45.00, vencimento: "2026-03-20", categoria: "Infraestrutura" }
  ];
}

/**
 * Lista todas as compras e formata a exibição.
 * @returns {Array<string>} Lista formatada de compras
 */
function listarCompras() {
  const listas = carregarCompras();
  return listas.map(l => {
    return 'Prumo: ' + l.nome;
  });
}

/**
 * Adiciona uma nova compra ou assinatura.
 * @param {Object} item 
 */
function adicionarCompra(item) {
  const listas = carregarCompras();
  const novoId = listas.length > 0 ? Math.max(...listas.map(i => i.id || 0)) + 1 : 1;
  const novoItem = {
    id: novoId,
    nome: item.nome || 'Novo Item',
    valor: Number(item.valor) || 0,
    vencimento: item.vencimento || new Date().toISOString().split('T')[0],
    categoria: item.categoria || 'Geral'
  };
  listas.push(novoItem);
  comprasCache = listas;
  salvarCompras(listas);
  return novoItem;
}

/**
 * Salva as compras no arquivo se possível.
 */
function salvarCompras(listas) {
  try {
    const caminho = path.join(__dirname, 'dados-compras.json');
    fs.writeFileSync(caminho, JSON.stringify(listas, null, 2), 'utf8');
  } catch (e) {
    // modo somente leitura em alguns ambientes
  }
}

/**
 * Remove uma compra pelo ID.
 */
function removerCompra(id) {
  let listas = carregarCompras();
  const antes = listas.length;
  listas = listas.filter(i => i.id !== id);
  comprasCache = listas;
  salvarCompras(listas);
  return listas.length < antes;
}

module.exports = {
  carregarCompras,
  listarCompras,
  adicionarCompra,
  removerCompra
};
