'use strict';
// C2-F5 (PC 2, 13/11): redes da KERNEX automáticas, no mesmo robô do Body Coach, sem misturar as contas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const robo = require('../../divulga/robo');

const RAIZ = path.join(__dirname, '../..');

test('DK1. perfil kernex usa SÓ KERNEX_META_* e apaga os segredos do Body Coach desta rodada', () => {
  const env = robo.envDoPerfil({ DIVULGA_META_PAGE_TOKEN: 'bc', DIVULGA_META_IG_USER_ID: 'bcig', META_PAGE_TOKEN: 'velho', DIVULGA_THREADS_TOKEN: 'th', KERNEX_META_PAGE_TOKEN: 'kx', KERNEX_META_IG_USER_ID: 'kxig', GROQ_API_KEY: 'g' }, 'kernex');
  assert.equal(env.DIVULGA_META_PAGE_TOKEN, 'kx');
  assert.equal(env.DIVULGA_META_IG_USER_ID, 'kxig');
  assert.equal(env.META_PAGE_TOKEN, undefined);
  assert.equal(env.DIVULGA_THREADS_TOKEN, undefined, 'Threads do Body Coach não posta a KERNEX');
  assert.equal(env.GROQ_API_KEY, 'g', 'a IA do texto continua');
  const semKx = robo.envDoPerfil({ DIVULGA_META_PAGE_TOKEN: 'bc' }, 'kernex');
  assert.equal(semKx.DIVULGA_META_PAGE_TOKEN, undefined, 'sem segredo da KERNEX não cai no do Body Coach');
  assert.deepEqual(robo.envDoPerfil({ A: '1' }, null), { A: '1' }, 'sem perfil nada muda (Body Coach)');
  assert.throws(() => robo.envDoPerfil({}, 'outro'), /Perfil desconhecido/);
});

test('DK2. o perfil kernex tem post pronto (imagens existem) e o ensaio não publica nada', async () => {
  const dados = robo.carregar(robo.raizDoPerfil('kernex'));
  assert.deepEqual(Object.keys(dados.clientes), ['kernex']);
  const c = dados.clientes.kernex;
  assert.ok(c.ativo !== false && c.assuntos.length >= 6);
  for (const i of c.imagens) assert.ok(fs.existsSync(path.join(RAIZ, 'divulga/imagens', i)), i);
  const logs = [];
  const r = await robo.rodar({ acao: 'ensaio', perfil: 'kernex', env: { KERNEX_META_PAGE_TOKEN: 'x', KERNEX_META_IG_USER_ID: 'y' }, fetchImpl: async () => { throw new Error('não pode chamar a rede'); }, log: (m) => logs.push(m) });
  assert.equal(r.postou, false);
  assert.equal(r.post.cliente, 'kernex');
  assert.match(logs.join('\n'), /Ensaio: nada foi publicado/);
});

test('DK3. workflow próprio, com segredos KERNEX_META_* e dados separados do Body Coach', () => {
  const y = fs.readFileSync(path.join(RAIZ, '.github/workflows/divulga-kernex.yml'), 'utf8');
  assert.match(y, /node divulga\/robo\.js "\$ACAO" --perfil kernex --dados dados/);
  assert.match(y, /divulga-kernex-dados/);
  assert.doesNotMatch(y, /secrets\.DIVULGA_/, 'nunca lê segredo do Body Coach');
  assert.doesNotMatch(y, /divulga-midia/, 'não pisa na mídia do Body Coach');
  const ps = fs.readFileSync(path.join(RAIZ, 'divulga/configurar-meta.ps1'), 'utf8');
  assert.match(ps, /'KERNEX_META'/);
  assert.match(fs.readFileSync(path.join(RAIZ, 'divulga/configurar-meta-kernex.bat'), 'utf8'), /-Perfil kernex/);
});
