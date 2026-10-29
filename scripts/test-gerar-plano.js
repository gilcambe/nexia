'use strict';
const { gerarPlano } = require('./cortex-plano.js');

// Teste simples para verificar se a função gerarPlano funciona corretamente
console.log('Testando gerarPlano...');

const pedidoExemplo = {
  texto: 'Crie uma nova página de contato em src/pages/contato/index.tsx',
  tipo: 'pedido'
};

gerarPlano(pedidoExemplo, (err, pedidoEnriquecido) => {
  if (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
  
  console.log('Pedido enriquecido:', pedidoEnriquecido);
  
  // Verifica se a propriedade arquivosReais foi adicionada
  if (pedidoEnriquecido.arquivosReais && Array.isArray(pedidoEnriquecido.arquivosReais)) {
    console.log('✓ Propriedade arquivosReais adicionada com sucesso!');
    console.log(`Quantidade de arquivos encontrados: ${pedidoEnriquecido.arquivosReais.length}`);
    console.log('Primeiros 5 arquivos:', pedidoEnriquecido.arquivosReais.slice(0, 5));
    process.exit(0);
  } else {
    console.error('✗ Propriedade arquivosReais não encontrada ou não é um array');
    process.exit(1);
  }
});
