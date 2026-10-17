'use strict';
// Cortex no celular: um pedido com a conversa inteira (comentários) e os PRs que o Cortex abriu para ele.
const { resumo, nomes, frase, REPO } = require('./pedidos-gh');

function criarDetalhe(gh) {
  const busca = (q, extra = '') => gh('/search/issues?per_page=30' + extra + '&q=' + encodeURIComponent(q));
  async function prsDe(i) {
    co