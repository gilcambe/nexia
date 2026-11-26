const assert = require('node:assert');
const { listar, catalogo, escolher, carregar } = require('../nexia-ai/skills/index');
const fs = require('node:fs');
const path = require('node:path');

async function testSkills() {
    console.log('Testando skills...');

    // 1. Listar
    const skills = listar();
    assert.strictEqual(skills.length, 2, 'Deve encontrar exatamente 2 skills');
    assert.ok(skills.some(s => s.nome === 'tela-finance'), 'Deve conter tela-finance');
    assert.ok(skills.some(s => s.nome === 'job-agendado'), 'Deve conter job-agendado');

    // 2. Catálogo (verificar se não tem corpo)
    const cat = catalogo(skills);
    assert.ok(cat.includes('SKILLS DISPONÍVEIS:'), 'Catálogo deve ter o cabeçalho');
    assert.ok(cat.includes('- tela-finance:'), 'Deve listar o nome');
    assert.ok(!cat.includes('Use esta skill quando'), 'Catálogo NÃO deve conter o corpo');

    // 3. Escolher
    const pedido = "criar cron que atualiza o estado";
    const escolhidas = escolher(pedido, skills);
    assert.strictEqual(escolhidas.length, 1, 'Deve escolher apenas 1 skill');
    assert.strictEqual(escolhidas[0].nome, 'job-agendado', 'Deve escolher job-agendado pelo pedido');

    // 4. Carregar (sem frontmatter)
    const corpo = carregar('tela-finance');
    assert.ok(corpo.includes('# SKILL tela-finance'), 'Corpo deve conter o título');
    assert.ok(!corpo.includes('name: tela-finance'), 'Corpo NÃO deve ter o frontmatter');
    
    // 5. Pasta inválida
    const invalidas = listar('./pasta-inexistente');
    assert.strictEqual(invalidas.length, 0, 'Pasta inexistente deve retornar lista vazia');

    console.log('Todos os testes de skills passaram!');
}

testSkills().catch(err => {
    console.error(err);
    process.exit(1);
});
