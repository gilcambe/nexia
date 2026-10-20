const { exec } = require('child_process');

console.log('Executando npm test...');
exec('npm test', (error, stdout, stderr) => {
  if (error) {
    console.error('Erro ao executar os testes:', error);
    process.exit(1);
  }
  if (stderr) {
    console.error('Saída de erro:', stderr);
    process.exit(1);
  }
  console.log('Saída dos testes:');
  console.log(stdout);
  console.log('\n✅ Todos os testes passaram com sucesso!');
  process.exit(0);
});