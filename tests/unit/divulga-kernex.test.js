'use strict';
// C2-F5 (PC 2, 13/11): Instagram da KERNEX automático, no mesmo robô do Body Coach, sem misturar as contas.
// Decisão do dono: SÓ Instagram (Instagram API with Instagram Login, sem Página do Facebook); LinkedIn só a interface.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const robo = require('../../divulga/robo');
const { CANAIS } = require('../../divulga/lib/canais');

const RAIZ = path.join(__dirname, '../..');
const canal = (id) => CANAIS.find((c) => c.id === id);

test('DK1. perfil kernex usa SÓ KERNEX_IG_* e apaga todos os segredos de rede do Body Coach', () => {
  const env = robo.envDoPerfil({ DIVULGA_META_PAGE_TOKEN: 'bc', DIVULGA_META_PAGE_ID: 'pg', DIVULGA_META_IG_USER_ID: 'bcig', META_PAGE_TOKEN: 'velho', DIVULGA_THREADS_TOKEN: 'th', DIVULGA_IG_TOKEN: 'outro', KERNEX_META_PAGE_TOKEN: 'nao', KERNEX_IG_USER_ID: 'kxig', KERNEX_IG_TOKEN: 'kx', GROQ_API_KEY: 'g' }, 'kernex');
  assert.equal(env.DIVULGA_IG_USER_ID, 'kxig');
  assert.equal(env.DIVULGA_IG_TOKEN, 'kx');
  for (const k of ['DIVULGA_META_PAGE_TOKEN', 'DIVULGA_META_PAGE_ID', 'DIVULGA_META_IG_USER_ID', 'META_PAGE_TOKEN', 'DIVULGA_THREADS_TOKEN']) assert.equal(env[k], undefined, k);
  assert.equal(env.GROQ_API_KEY, 'g', 'a IA do texto continua');
  assert.equal(canal('facebook').ativo(env), false, 'Facebook da KERNEX desligado');
  assert.equal(canal('instagram').ativo(env), true);
  assert.equal(canal('instagram').ativo(robo.envDoPerfil({ DIVULGA_META_IG_USER_ID: 'bcig', DIVULGA_META_PAGE_TOKEN: 'bc' }, 'kernex')), false, 'sem segredo da KERNEX não cai no do Body Coach');
  assert.deepEqual(robo.envDoPerfil({ A: '1' }, null), { A: '1' }, 'sem perfil nada muda (Body Coach)');
  assert.throws(() => robo.envDoPerfil({}, 'outro'), /Perfil desconhecido/);
});

test('DK2. Instagram Login publica em graph.instagram.com com o token da KERNEX', async () => {
  const chamadas = [];
  const fetchImpl = async (url, op = {}) => {
    chamadas.push({ url: String(url), corpo: op.body ? String(op.body) : '' });
    const id = /media_publish/.test(url) ? 'post9' : 'cont1';
    return { ok: true, status: 200, json: async () => (/fields=status_code/.test(url) ? { status_code: 'FINISHED' } : { id }), text: async () => '' };
  };
  const env = { DIVULGA_IG_USER_ID: '178', DIVULGA_IG_TOKEN: 'tok-kx', DIVULGA_PAUSA_MS: '0' };
  const r = await canal('instagram').publicar({ titulo: 'KERNEX', texto: 'Site profissional', imagem: 'https://raw.githubusercontent.com/gilcambe/nexia/develop/divulga/imagens/kernex-1.jpg' }, { env, fetchImpl });
  assert.equal(r.ref, 'post9');
  assert.ok(chamadas.length >= 2);
  for (const c of chamadas) {
    assert.match(c.url, /^https:\/\/graph\.instagram\.com\//, c.url);
    assert.doesNotMatch(c.url + c.corpo, /graph\.facebook\.com/);
  }
  assert.match(chamadas.find((c) => /\/178\/media$/.test(c.url)).corpo, /access_token=tok-kx/);
});

test('DK3. perfil kernex tem post pronto (imagens existem) e o ensaio não publica nada', async () => {
  const dados = robo.carregar(robo.raizDoPerfil('kernex'));
  assert.deepEqual(Object.keys(dados.clientes), ['kernex']);
  const c = dados.clientes.kernex;
  assert.ok(c.ativo !== false && c.assuntos.length >= 6);
  for (const i of c.imagens) assert.ok(fs.existsSync(path.join(RAIZ, 'divulga/imagens', i)), i);
  const logs = [];
  const r = await robo.rodar({ acao: 'ensaio', perfil: 'kernex', env: { KERNEX_IG_USER_ID: 'x', KERNEX_IG_TOKEN: 'y' }, fetchImpl: async () => { throw new Error('não pode chamar a rede'); }, log: (m) => logs.push(m) });
  assert.equal(r.postou, false);
  assert.equal(r.post.cliente, 'kernex');
  assert.match(logs.join('\n'), /Ensaio: nada foi publicado/);
});

test('DK4. workflow só à mão até a conta existir, com KERNEX_IG_* e dados separados; LinkedIn desligado', () => {
  const y = fs.readFileSync(path.join(RAIZ, '.github/workflows/divulga-kernex.yml'), 'utf8');
  assert.match(y, /node divulga\/robo\.js "\$ACAO" --perfil kernex --dados dados/);
  assert.match(y, /^ {2}# schedule:/m, 'sem horário automático enquanto a conta não existe');
  assert.doesNotMatch(y, /^ {2}schedule:/m);
  assert.match(y, /secrets\.KERNEX_IG_TOKEN/);
  assert.doesNotMatch(y, /secrets\.(DIVULGA_|KERNEX_META_)/, 'nunca lê segredo do Body Coach nem de Página');
  assert.doesNotMatch(y, /divulga-midia/, 'não pisa na mídia do Body Coach');
  assert.match(fs.readFileSync(path.join(RAIZ, 'divulga/configurar-instagram-kernex.ps1'), 'utf8'), /gh secret set KERNEX_IG_TOKEN/);
  assert.equal(canal('linkedin').ativo({ DIVULGA_LINKEDIN_TOKEN: 'a', DIVULGA_LINKEDIN_AUTOR: 'b' }), false, 'LinkedIn só liga com DIVULGA_LINKEDIN_LIGADO=1');
});
