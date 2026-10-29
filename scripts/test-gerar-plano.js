'use strict';
const { gerarPlano } = require('./scripts/cortex-plano.js');

// Teste da função gerarPlano
console.log('Testando a função gerarPlano...');

const pedidoExemplo = {
  id: 'test-123',
  texto: 'Crie uma nova tela de login com validação de email e senha',
  arquivosCitados: ['src/pages/login.js', 'src/styles/login.css']
};

gerarPlano(pedidoExemplo, (error, pedidoEnriquecido) => {
  if (error) {
    console.error('Erro ao gerar plano:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Sucesso! Pedido enriquecido com arquivosReais:');
  console.log('ID do pedido:', pedidoEnriquecido.id);
  console.log('Texto:', pedidoEnriquecido.texto);
  console.log('Arquivos citados:', pedidoEnriquecido.arquivosCitados);
  console.log('Arquivos reais do repositório (primeiros 10):', pedidoEnriquecido.arquivosReais.slice(0, 10));
  console.log('Total de arquivos encontrados:', pedidoEnriquecido.arquivosReais.length);
  
  // Verifica se a propriedade arquivosReais foi adicionada
  if (pedidoEnriquecido.arquivosReais && Array.isArray(pedidoEnriquecido.arquivosReais)) {
    console.log('✅ Teste passado: a propriedade arquivosReais foi adicionada ao pedido');
    process.exit(0);
  } else {
    console.error('❌ Teste falhou: a propriedade arquivosReais não foi encontrada no pedido');
    process.exit(1);
  }
});