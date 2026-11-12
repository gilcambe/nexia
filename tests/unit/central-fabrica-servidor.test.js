'use strict';
// M4 (12/11/2026): servidor da Fábrica na Central (fabrica-*) e o quadro dos PCs (parte=quadro).
const test = require('node:test');
const assert = require('node:assert/strict');
const fab = require('../../netlify/functions/central/fabrica');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { createMaquinas } = require('../../nexia-ai/maquinas');

const FICHA = { nome: 'Clínica Sorriso', ramo: 'dentista', whatsapp: '81999999999', cidade: 'Recife', precisa: ['agenda', 'site'] };
function ghFalso(respostas = {}) {
  const chamadas = [];
  const gh = async (caminho, init = {}) => {
    chamadas.push({ caminho, init });
    for (const [k, v] of Object.entries(respostas)) if (caminho.includes(k)) { if (v instanceof Error) throw v; return v; }
    return {};
  };
  return { gh, chamadas };
}

test('CFS1. catálogo no formato da tela: módulos com nível/origem, modelos com clonável só se o gerador sabe copiar', () => {
  const c = fab.catalogo();
  assert.ok(c.modulos.length >= 20 && c.modelos.length >= 5);
  for (const m of c.modulos) assert.ok(m.id && m.nome && [1, 2, 3].includes(m.nivel) && typeof m.pronto === 'boolean');
  assert.equal(c.modelos.find(m => m.id === 'demo-agenda').clonavel, true);
  for (const m of c.modelos.filter(x => x.clonavel)) assert.ok(fab.GERAVEIS.includes(m.id), m.id);
});

test('CFS2. consultar devolve faltam como texto e o modelo de agenda para dentista', () => {
  const r = fab.consultar({ ...FICHA, precisa: ['agenda', 'pagamento'] });
  assert.equal(r.modelo.id, 'demo-agenda');
  assert.deepEqual(r.faltam, ['pagamento']);
  assert.equal(r.nivel, 3);
  assert.ok(r.prontos.every(p => p.id && p.nome));
});

test('CFS3. criar dispara o workflow da fábrica no kernex-clientes com a ficha limpa', async () => {
  const { gh, chamadas } = ghFalso();
  const r = await fab.criar({ ficha: FICHA }, { gh });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo, { id: 'clinica-sorriso', status: 'gerando', previa: 'https://clinica-sorriso.kernex-previas.pages.dev' });
  assert.equal(chamadas[0].caminho, '/repos/gilcambe/kernex-clientes/actions/workflows/fabrica.yml/dispatches');
  const corpo = JSON.parse(chamadas[0].init.body);
  assert.equal(corpo.ref, 'main');
  assert.deepEqual(corpo.inputs, { modelo: 'demo-agenda', slug: 'clinica-sorriso', nome: 'Clínica Sorriso', whatsapp: '5581999999999', cidade: 'Recife' });
});

test('CFS4. criar recusa ficha inválida, modelo que não clona e avisa quando a chave não tem acesso', async () => {
  const { gh, chamadas } = ghFalso();
  assert.equal((await fab.criar({ ficha: { nome: '' } }, { gh })).status, 400);
  assert.equal((await fab.criar({ ficha: FICHA, modelo: 'app-fitness' }, { gh })).status, 400);
  assert.equal(chamadas.length, 0, 'nada foi disparado');
  const e = Object.assign(new Error('Not Found'), { status: 404 });
  const r = await fab.criar({ ficha: FICHA }, ghFalso({ dispatches: e }));
  assert.equal(r.status, 502);
  assert.match(r.corpo.error, /acesso/);
});

test('CFS5. status: gerando, prévia (com portões e URL) e reprovado, pelo título da execução', async () => {
  const run = (o) => ({ workflow_runs: [{ id: 7, display_title: 'Fábrica clinica-sorriso (demo-agenda)', run_started_at: '2026-11-12T20:36:09Z', updated_at: '2026-11-12T20:36:39Z', ...o }] });
  const jobs = { jobs: [{ steps: [{ name: 'Set up job', conclusion: 'success' }, { name: 'Gerar o site do modelo (sem IA)', conclusion: 'success' }, { name: 'Publicar a prévia', conclusion: 'success' }] }] };
  assert.equal((await fab.status('clinica-sorriso', ghFalso({ '/runs?': { workflow_runs: [] } }))).corpo.status, 'gerando');
  assert.equal((await fab.status('clinica-sorriso', ghFalso({ '/runs?': run({ status: 'in_progress' }) }))).corpo.status, 'gerando');
  const ok = (await fab.status('clinica-sorriso', ghFalso({ '/jobs': jobs, '/runs?': run({ status: 'completed', conclusion: 'success' }) }))).corpo;
  assert.equal(ok.status, 'previa');
  assert.equal(ok.previa, 'https://clinica-sorriso.kernex-previas.pages.dev');
  assert.deepEqual(ok.portoes.map(p => p.nome), ['Gerar o site do modelo (sem IA)', 'Publicar a prévia']);
  assert.equal((await fab.status('clinica-sorriso', ghFalso({ '/jobs': jobs, '/runs?': run({ status: 'completed', conclusion: 'failure' }) }))).corpo.status, 'reprovado');
  assert.equal((await fab.status('outro-slug', ghFalso({ '/runs?': run({ status: 'completed', conclusion: 'success' }) }))).corpo.status, 'gerando', 'não confunde com outro cliente');
  assert.equal((await fab.status('../x', ghFalso())).status, 400);
});

test('CFS6. publicar usa a MESMA ficha da prévia (guardada no D1) e dispara o workflow de produção', async () => {
  const loja = fab.criarLoja({}, createMemoryDriver());
  const { gh, chamadas } = ghFalso();
  await fab.criar({ ficha: { ...FICHA, responsavel: 'Dra. Ana' } }, { gh, loja });
  const r = await fab.publicar({ id: 'clinica-sorriso' }, { gh, loja });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.endereco, 'https://clinica-sorriso.kernex.com.br');
  const disparo = chamadas.find(c => c.caminho.includes('fabrica-producao.yml'));
  const corpo = JSON.parse(disparo.init.body);
  assert.deepEqual(corpo.inputs, { modelo: 'demo-agenda', slug: 'clinica-sorriso', nome: 'Clínica Sorriso', whatsapp: '5581999999999', cidade: 'Recife', responsavel: 'Dra. Ana', dominio: 'sim', guardar: 'sim' });
  // sem prévia guardada: não publica nada
  const r2 = await fab.publicar({ id: 'outra-clinica' }, { gh, loja });
  assert.equal(r2.status, 409);
  assert.equal((await fab.publicar({ id: '../x' }, { gh, loja })).status, 400);
  assert.equal((await fab.publicar({ id: 'clinica-sorriso' }, { gh, loja: null })).status, 409);
});

test('CFS7. rota da Central: parte e ação da fábrica respondem; o resto passa adiante', async () => {
  const { gh } = ghFalso();
  assert.equal((await fab.rota({ parte: 'fabrica-catalogo' }, { gh })).status, 200);
  assert.equal((await fab.rota({ acao: 'fabrica-consultar', body: { ficha: FICHA } }, { gh })).corpo.modelo.id, 'demo-agenda');
  assert.equal(await fab.rota({ parte: 'saude' }, { gh }), null);
});

test('CFS8. quadro dos PCs: o PC manda (token da máquina), a Central lê só o necessário', async () => {
  const TOKEN = 'x'.repeat(30);
  const m = createMaquinas({ env: { NEXIA_MAQUINA_TOKEN: TOKEN }, driver: createMemoryDriver() });
  const json = (event, statusCode, body) => ({ statusCode, body });
  const tarefas = [{ id: 23, titulo: 'M4 servidor', status: 'fazendo', dono: 'pc1', quando: '2026-11-12T20:00:00', arquivos: ['x'] }, { titulo: 'sem id' }];
  const ev = { path: '/api/nexia/maquinas/quadro', httpMethod: 'POST', body: JSON.stringify({ nome: 'PC1', tarefas }), headers: { authorization: `Bearer ${TOKEN}` } };
  assert.equal((await m.rotaDoPc(ev, json)).statusCode, 200);
  const q = await m.lerQuadro();
  assert.deepEqual(q.tarefas, [{ id: 23, titulo: 'M4 servidor', status: 'fazendo', dono: 'pc1', quando: '2026-11-12T20:00:00' }]);
  assert.equal(q.enviado_por, 'PC1');
  assert.ok(q.em);
  const semToken = { ...ev, headers: {} };
  assert.equal((await m.rotaDoPc(semToken, json)).statusCode, 401);
});

test('CFS9. fotos (Q1): vão ao workflow como texto com vírgula e seguem para o Publicar; link ruim é recusado', async () => {
  const loja = fab.criarLoja({}, createMemoryDriver());
  const { gh, chamadas } = ghFalso();
  const r = await fab.criar({ ficha: { ...FICHA, fotos: 'https://x.com/a.jpg, https://x.com/b.jpg' } }, { gh, loja });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(chamadas[0].init.body).inputs.fotos, 'https://x.com/a.jpg,https://x.com/b.jpg');
  await fab.publicar({ id: 'clinica-sorriso' }, { gh, loja });
  const prod = JSON.parse(chamadas.find(c => c.caminho.includes('fabrica-producao.yml')).init.body);
  assert.equal(prod.inputs.fotos, 'https://x.com/a.jpg,https://x.com/b.jpg');
  const semFoto = ghFalso();
  await fab.criar({ ficha: FICHA }, { gh: semFoto.gh });
  assert.equal('fotos' in JSON.parse(semFoto.chamadas[0].init.body).inputs, false, 'sem fotos o campo nem vai (workflow antigo continua aceitando)');
  for (const ruim of ['http://x.com/a.jpg', 'https://x.com/a.jpg"onerror=1', Array(7).fill('https://x.com/a.jpg').join(',')]) {
    assert.equal((await fab.criar({ ficha: { ...FICHA, fotos: ruim } }, ghFalso())).status, 400, ruim);
  }
});
