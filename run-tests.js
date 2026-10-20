const { spawn } = require('child_process');

console.log('Executando npm test...');
const testProcess = spawn('npm', ['test'], { stdio: 'inherit' });

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Todos os testes passaram!');
    console.log('✅ O novo comportamento está implementado corretamente.');
    console.log('✅ Nenhuma mudança de código adicional é necessária.');
  } else {
    console.log(`\n❌ Testes falharam com código: ${code}`);
    console.log('❌ Verifique os logs acima para detalhes das falhas.');
  }
});