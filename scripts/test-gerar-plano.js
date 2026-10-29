'use strict';

const { gerarPlano } = require('./cortex-plano.js');

// Teste da função gerarPlano
console.log('Testando a função gerarPlano...');

// Pedido de exemplo
const pedidoExemplo = {
  id: 'test-123',
  corpo: 'Crie uma tela de login com React e TypeScript',
  tipo: 'desenvolvimento'
};

// Callback para testar o resultado
const callback = (error, pedido) => {
  if (error) {
    console.error('Erro:', error.message);
    return;
  }
  
  console.log('Pedido recebido:', pedido);
  
  // Verifica se a propriedade arquivosReais foi adicionada
  if (pedido.arquivosReais && Array.isArray(pedido.arquivosReais)) {
    console.log('✅ Sucesso: A propriedade arquivosReais foi adicionada ao pedido');
    console.log(`Quantidade de arquivos encontrados: ${pedido.arquivosReais.length}`);
    console.log('Primeiros 5 arquivos:', pedido.arquivosReais.slice(0, 5));
  } else {
    console.log('❌ Falha: A propriedade arquivosReais não foi encontrada no pedido');
  }
};

// Executa a função
gerarPlano(pedidoExemplo, callback);
