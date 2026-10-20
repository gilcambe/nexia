#!/usr/bin/env node

/**
 * Vigia da divulgação - monitora e verifica o status da divulgação
 * Executado após cada rodada do workflow de divulgação
 */

const fs = require('fs');
const path = require('path');

// Caminho para o diretório de dados
const dadosPath = path.join(process.cwd(), 'dados');

// Caminho para o diretório de mídia
const midiaPath = path.join(process.cwd(), 'midia');

console.log('🔍 Iniciando vigia da divulgação...');

// Verifica se o diretório de dados existe
if (!fs.existsSync(dadosPath)) {
  console.error('❌ Diretório de dados não encontrado:', dadosPath);
  process.exit(1);
}

// Verifica se o diretório de mídia existe
if (!fs.existsSync(midiaPath)) {
  console.warn('⚠️ Diretório de mídia não encontrado, pode ser normal em execuções sem produção');
} else {
  // Lista arquivos no diretório de mídia
  const midiaFiles = fs.readdirSync(midiaPath);
  console.log(`📁 Encontrados ${midiaFiles.length} arquivos no diretório de mídia:`);
  midiaFiles.forEach(file => {
    console.log(`  - ${file}`);
  });
}

// Verifica se há commits na branch divulga-dados
try {
  const { execSync } = require('child_process');
  // Usa caminho absoluto para o git log sem mudar o diretório de trabalho
  const gitLog = execSync('git log --oneline -n 5', { 
    encoding: 'utf8', 
    cwd: dadosPath,
    timeout: 10000
  });
  console.log('📝 Últimos commits na branch divulga-dados:');
  console.log(gitLog);
} catch (error) {
  console.warn('⚠️ Não foi possível verificar commits:', error.message);
}

console.log('✅ Vigia da divulgação concluído com sucesso!');
