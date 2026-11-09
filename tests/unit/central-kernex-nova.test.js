'use strict';
// #3219 partes 1-3: Central nova (casca, Início, Tarefas).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const PASTA = path.join(__dirname, '../../src/pages/central/kernex');

async function regras() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'regras.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-'));
  fs.writeFileSync(path.join(dir, 'regras.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'regras.mjs')).href);
}

test('KX1. menu tem as 10 telas do Plano-Mestre + Homologação (pedido do dono 09/11)', async () => {
  const { TELAS } = await regras();
  assert.deepEqual(TELAS.map((t) => t.nome), ['Início', 'Pedir', 'Projetos', 'Clientes e modelos', 'Máquinas', 'IA & Cortex', 'Tarefas', 'Arquivos', 'Publicações', 'Homologação', 'Cofre', 'Relatórios', 'Configurações']);
  assert.ok(TELAS.every((t) => t.serve.length > 10));
});

test('KX2. tela vem da URL; inválida cai no Início', async () => {
  const { telaDaUrl } = await regras();
  assert.equal(telaDaUrl('?nova=1&tela=tarefas'), 'tarefas');
  assert.equal(telaDaUrl('?tela=xyz'), 'inicio');
});

test('KX3. semáforo: vermelho, amarelo, verde', async () => {
  const { corSemaforo } = await regras();
  assert.equal(corSemaforo({ precisa: 1 }).cor, 'vermelho');
  assert.equal(corSemaforo({ servicosFora: 1 }).cor, 'vermelho');
  assert.equal(corSemaforo({ travadas: 2 }).cor, 'amarelo');
  assert.equal(corSemaforo({}).texto, 'Tudo certo');
});

test('KX4. casca sem rolagem e Bloco mostra "sem dados" sem fonte', () => {
  const css = fs.readFileSync(path.join(PASTA, 'tema.ts'), 'utf8');
  assert.match(css, /height:100vh;overflow:hidden/);
  const bloco = fs.readFileSync(path.join(PASTA, 'Bloco.tsx'), 'utf8');
  assert.match(bloco, /sem dados/);
});

test('KX5. auditor: todo Bloco tem fonte e hora; nada de status fixo', () => {
  for (const f of fs.readdirSync(PASTA).filter((x) => x.endsWith('.tsx'))) {
    const src = fs.readFileSync(path.join(PASTA, f), 'utf8');
    for (const m of src.matchAll(/<Bloco\b[^>]*>/g)) {
      assert.match(m[0], /fonte=/, `${f}: Bloco sem fonte`);
      assert.match(m[0], /atualizadoEm=/, `${f}: Bloco sem atualizadoEm`);
    }
    assert.doesNotMatch(src, /Operacional|Resolvendo sozinho|ilimitad/i, f);
    assert.doesNotMatch(src, />\s*\d+%\s*</, `${f}: porcentagem fixa`);
  }
});

test('KX6. cota nunca diz ilimitado; deploy tem 4 textos', async () => {
  const { textoCota, textoDeploy } = await regras();
  for (const s of ['ativa', 'ociosa', 'sem-cota', 'erro', undefined]) assert.doesNotMatch(textoCota(s), /ilimitad/i);
  assert.equal(textoCota(undefined), 'não informado pelo provedor');
  assert.match(textoDeploy({ emAndamento: true }), /Publicando/);
  assert.match(textoDeploy({ falhou: true }), /falhou/);
  assert.match(textoDeploy({ mudancas: 2 }), /2 mudança/);
  assert.match(textoDeploy({}), /no ar/);
});

test('KX7. busca acha tela sem acento; relatório conta por dia e IA', async () => {
  const { buscarTelas, porDiaEIa } = await regras();
  assert.equal(buscarTelas('tare')[0].nome, 'Tarefas');
  assert.equal(buscarTelas('configuracoes')[0].nome, 'Configurações');
  assert.deepEqual(buscarTelas('  '), []);
  const agora = Date.parse('2026-11-08T20:00:00Z');
  const r = porDiaEIa([{ quando: '2026-11-08T15:00:00Z', ia: 'Jules' }, { quando: '2026-11-08T16:00:00Z' }, { quando: '2026-10-01T10:00:00Z' }], agora);
  assert.equal(r.dias[0].n, 2);
  assert.deepEqual(r.ias.map((x) => x.ia).sort(), ['Cortex', 'Jules']);
});

test('KX8. projetos: % só com prova; roteiro não definido', () => {
  const { percentual } = require('../../netlify/functions/central/projetos');
  const md = '# X\n- [x] A (peso 10) evidencia: PR #12\n- [x] B (peso 10)\n- [ ] C (peso 20) quem: Cortex\n';
  const p = percentual(md);
  assert.equal(p.pct, 25);
  assert.equal(p.faltam.length, 2);
  assert.equal(p.faltam[1].quem, 'Cortex');
  assert.equal(percentual('# Y\nstatus: ainda-nao-definido\n').definido, false);
});

test('KX9. cofre devolve só nome e data', async () => {
  const { cofre } = require('../../netlify/functions/pedidos');
  const r = await cofre(async () => ({ secrets: [{ name: 'A', updated_at: '2026-01-01T00:00:00Z', valor: 'xx', visibility: 'all' }] }));
  assert.deepEqual(r.segredos, [{ name: 'A', updated_at: '2026-01-01T00:00:00Z' }]);
});

test('KX9. /central com # velho (ex.: #inicio) abre a NOVA; antiga só com ?antiga=1 ou #sistema (bug do dono 09/11)', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../src/pages/central/page.tsx'), 'utf8');
  const linha = s.split('\n').find((l) => l.includes('const [antiga]'));
  assert.ok(linha, 'achou a regra da antiga');
  assert.ok(!/location\.hash\.length/.test(linha), 'qualquer # não pode abrir a antiga');
  const antiga = (search, hash) => new Function('location', 'URLSearchParams', 'return ' + linha.match(/useState\(\(\) => (.*)\);/)[1])({ search, hash }, URLSearchParams);
  assert.equal(antiga('', '#inicio'), false);
  assert.equal(antiga('', ''), false);
  assert.equal(antiga('?nova=1', '#cortex'), false);
  assert.equal(antiga('?antiga=1', '#inicio'), true);
  assert.equal(antiga('', '#sistema'), true);
});

test('KX10. "Precisa de você" só tem o que o dono pode fazer, cada um com passos e botão (bug do dono 09/11)', async () => {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'donos.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-'));
  fs.writeFileSync(path.join(dir, 'donos.mjs'), out);
  const { montarAcoes } = await import(pathToFileURL(path.join(dir, 'donos.mjs')).href);
  const a = montarAcoes({
    esperando: [{ tipo: 'pr', numero: 7, titulo: 'Robô novo', link: 'https://x/7', passos: ['Abrir', 'Merge'] }, { tipo: 'pr', numero: 8, titulo: 'Sem passos', link: 'https://x/8' }],
    maquinas: [{ nome: 'PC1', online: true, visto_em: 'x' }, { nome: 'PC2', online: false, visto_em: '2026-10-29T00:00:00Z' }],
    projetos: [{ id: 'cortex', proposto: true }, { id: 'bezsan' }],
  });
  assert.deepEqual(a.map((x) => x.id), ['pr7', 'maq-PC2', 'rot-cortex']);
  for (const x of a) { assert.ok(x.passos.length >= 2, x.id + ' tem passos'); assert.ok(x.botao.href || x.botao.tela, x.id + ' tem botão'); }
});

test('KX11. PC sem sinal não aparece como "Desligado" e mostra o que fazer (PC2, 09/11)', () => {
  const s = fs.readFileSync(path.join(PASTA, 'Maquinas.tsx'), 'utf8');
  assert.ok(!/"Desligado"/.test(s));
  assert.ok(/Agendador de Tarefas/.test(s) && /NEXIA Agente/.test(s));
});

test('KX12. Início tem "Status de tudo" com paradas há mais de 1 dia e Destravar (dono, 09/11)', () => {
  const s = fs.readFileSync(path.join(PASTA, 'StatusTudo.tsx'), 'utf8');
  assert.ok(/acao: "destravar"/.test(s) && /Paradas há mais de 1 dia/.test(s) && /prontos de/.test(s));
  assert.ok(/<StatusTudo /.test(fs.readFileSync(path.join(PASTA, 'Inicio.tsx'), 'utf8')));
});
