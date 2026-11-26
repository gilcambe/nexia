const assert = require('node:assert');
const { listar, catalogo, escolher, carregar } = require('../nexia-ai/skills/index');
const fs = require('fs');
const path = require('path');

// Setup: criar estruturas de teste
const skillsDir = path.join(__dirname, '../nexia-ai/skills');

async function testSkills() {
    console.log('Testando listar...');
    const lista = listar();
    assert.ok(lista.some(s => s.nome === 'tela-finance'), 'Deve achar tela-finance');
    assert.ok(lista.some(s => s.nome === 'job-agendado'), 'Deve achar job-agendado');

    console.log('Testando catalogo...');
    const cat = catalogo(lista);
    assert.ok(cat.includes('SKILLS DISPONÍVEIS:'), 'Catálogo deve ter cabeçalho');
    assert.ok(!cat.includes('# SKILL tela-finance'), 'Catálogo não deve ter corpo');

    console.log('Testando escolher...');
    const pedido = "criar cron que atualiza o estado";
    const escolhidas = escolher(pedido, lista);
    assert.strictEqual(escolhidas[0].nome, 'job-agendado', 'Deve escolher job-agendado');

    console.log('Testando carregar...');
    const corpo = carregar('tela-finance');
    assert.ok(!corpo.includes('name: tela-finance'), 'Corpo não deve ter frontmatter');
    assert.ok(corpo.includes('Regras de uso:'), 'Corpo deve ter conteúdo');

    console.log('Testando pasta quebrada...');
    // Criar pasta temporária com arquivo inválido
    const tempDir = path.join(skillsDir, 'temp-quebrado');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), 'invalido');
    
    try {
        const lista2 = listar();
        assert.strictEqual(lista2.length, lista.length, 'Não deve derrubar o sistema');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

testSkills().then(() => console.log('Todos os testes passaram!')).catch(err => {
    console.error(err);
    process.exit(1);
});
