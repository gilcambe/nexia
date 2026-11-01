'use strict';
// Conectar IAs (#1958): a chave é testada, selada para o GitHub e nunca volta (resposta, estado, log).
const test = require('node:test');
const assert = require('node:assert');
const nacl = require('tweetnacl');
const { blake2b } = require('blakejs');
const v = require('../../netlify/functions/central/ia-vagas');
const { lerVaga } = require('../../scripts/ia-vagas-teste');

const CHAVE = 'gsk_TESTE1234567890abcdefXYZ';
const par = nacl.box.keyPair();
const PUB = Buffer.from(par.publicKey).toString('base64');

function abrir(b64) {
  const tudo = Uint8Array.from(Buffer.from(b64, 'base64'));
  const epk = tudo.slice(0, 32);
  const junta = new Uint8Array(64); junta.set(epk, 0); junta.set(par.publicKey, 32);
  const aberto = nacl.box.open(tudo.slice(32), blake2b(junta, undefined, 24), epk, par.secretKey);
  return aberto && new TextDecoder().decode(aberto);
}

function ghFalso({ segredos = [], issues = [], prs = [] } = {}) {
  const chamadas = [];
  const gh = async (caminho, init = {}) => {
    chamadas.push({ caminho, metodo: init.method || 'GET', body: init.body || '' });
    if (caminho === '/actions/secrets/public-key') return { key: PUB, key_id: 'k1' };
    if (caminho.startsWith('/actions/secrets?')) return { secrets: segredos };
    if (caminho.startsWith('/issues?')) return issues;
    if (caminho.startsWith('/pulls?')) return prs;
    if (caminho === '/issues' && init.method === 'POST') return { number: 99 };
    return {};
  };
  return { gh, chamadas };
}
const roteador = (resultado) => ({ createRouter: () => ({ chat: async () => { if (resultado instanceof Error) throw resultado; return { text: 'ok' }; } }) });
// GET direto no serviço: status HTTP falso (ou erro de rede).
const servico = (status, corpo = '') => ({ fetchImpl: async (url, init) => {
  if (status === 'rede') throw new TypeError('fetch failed');
  return { ok: status < 300, status, text: async () => corpo, url, init };
} });

test('VAGAS1: sealed box abre com a chave privada do repositório', () => {
  assert.strictEqual(abrir(v.selar('groq:' + CHAVE, PUB)), 'groq:' + CHAVE);
});

test('VAGAS2: salvar testa, grava segredo selado e não devolve nem guarda a chave', async () => {
  const f = ghFalso();
  const r = await v.salvar(f.gh, { vaga: 2, provedor: 'groq', chave: CHAVE }, servico(200));
  assert.strictEqual(r.corpo.ok, true);
  const put = f.chamadas.find((c) => c.metodo === 'PUT');
  assert.strictEqual(put.caminho, '/actions/secrets/IA_VAGA_2');
  assert.strictEqual(abrir(JSON.parse(put.body).encrypted_value), 'groq:' + CHAVE);
  for (const c of f.chamadas) assert.ok(!c.body.includes(CHAVE), 'chave em texto puro foi para ' + c.caminho);
  assert.ok(!JSON.stringify(r).includes(CHAVE));
  assert.ok(f.chamadas.some((c) => c.caminho === '/issues' && c.metodo === 'POST' && JSON.parse(c.body).body.includes('"provedor": "groq"')));
});

test('VAGAS3: chave recusada não é gravada e o motivo não mostra a chave', async () => {
  const f = ghFalso();
  const r = await v.salvar(f.gh, { vaga: 1, provedor: 'groq', chave: CHAVE }, servico(401, `Invalid API Key ${CHAVE}`));
  assert.strictEqual(r.corpo.ok, false);
  assert.strictEqual(r.corpo.teste.situacao, 'recusada');
  assert.ok(!f.chamadas.some((c) => c.metodo === 'PUT'));
  assert.ok(!JSON.stringify(r).includes(CHAVE));
});

test('VAGAS4: cota acabou ainda salva (chave boa); provedor pago ou vaga 4 são recusados', async () => {
  const f = ghFalso();
  const r = await v.salvar(f.gh, { vaga: 3, provedor: 'gemini', chave: 'AIza' + 'x'.repeat(35) }, servico(429));
  assert.strictEqual(r.corpo.ok, true);
  assert.strictEqual(r.corpo.teste.situacao, 'sem-cota');
  assert.strictEqual((await v.salvar(f.gh, { vaga: 1, provedor: 'openai', chave: CHAVE }, roteador())).status, 400);
  assert.strictEqual((await v.salvar(f.gh, { vaga: 51, provedor: 'groq', chave: CHAVE }, roteador())).status, 400);
});

test('VAGAS5: estado junta segredos, último teste e prova de uso dos PRs de reserva', async () => {
  const corpo = v.corpoEstado({ 1: { provedor: 'groq', teste: { situacao: 'ok', tempo: 800, em: '2026-10-27T01:00:00Z', onde: 'central' } } });
  const f = ghFalso({
    segredos: [{ name: 'IA_VAGA_1', updated_at: '2026-10-27T01:00:00Z' }, { name: 'GROQ_API_KEY' }],
    issues: [{ number: 50, body: corpo }],
    prs: [{ number: 7, html_url: 'u', head: { ref: 'nexia/reserva-12-3' }, body: 'Aplicado pela conta vaga-1-groq. Fecha #12.', created_at: 'x', merged_at: 'y' },
      { number: 8, head: { ref: 'nexia/outra' }, body: 'conta vaga-1-groq' }],
  });
  const e = await v.estado(f.gh);
  assert.strictEqual(e.vagas.length, 50);
  assert.deepStrictEqual(e.vagas.slice(0, 3).map((x) => [x.vaga, x.ligada, x.provedor]), [[1, true, 'groq'], [2, false, null], [3, false, null]]);
  assert.deepStrictEqual(e.vagas[0].usos.map((u) => [u.pr, u.tarefa, u.entrou]), [[7, 12, true]]);
  assert.ok(e.provedores.every((p) => !('env' in p) && p.passos.length));
});

test('VAGAS6: robô lê "provedor:chave" e ignora provedor desconhecido', () => {
  assert.deepStrictEqual(lerVaga('groq:' + CHAVE), { provedor: 'groq', chave: CHAVE });
  assert.strictEqual(lerVaga('openai:sk-123'), null);
  assert.strictEqual(lerVaga(''), null);
});

test('VAGAS7: reserva usa as vagas primeiro e mascara a chave no log', () => {
  const yml = require('fs').readFileSync(require('path').join(__dirname, '../../.github/workflows/cortex-reserva.yml'), 'utf8');
  assert.ok(/IA_VAGA_1: \$\{\{ secrets\.IA_VAGA_1 \}\}/.test(yml));
  assert.ok(yml.includes('::add-mask::$CH'));
  assert.ok(yml.indexOf('IA_VAGA_$N') < yml.indexOf('if [ -n "$RESERVA_GEMINI_KEY" ]'));
});

test('VAGAS8: sem conexão daqui ainda salva (não testada) e chama o robô; Google API_KEY_INVALID é recusa', async () => {
  const f = ghFalso();
  let robo = 0;
  const r = await v.salvar(f.gh, { vaga: 1, provedor: 'mistral', chave: CHAVE }, { ...servico('rede'), rodarRobo: async () => { robo++; } });
  assert.strictEqual(r.corpo.ok, true);
  assert.ok(f.chamadas.some((c) => c.metodo === 'PUT'));
  assert.ok(f.chamadas.some((c) => c.caminho === '/issues' && JSON.parse(c.body).body.includes('"teste": null')));
  assert.strictEqual(robo, 1);
  const g = await v.testarChave('gemini', 'AIza' + 'y'.repeat(35), servico(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'));
  assert.strictEqual(g.situacao, 'recusada');
});

test('VAGAS9: Groq confere no GET /models com a chave no cabeçalho; NVIDIA vai pela conversa', async () => {
  let pedido;
  const r = await v.testarChave('groq', CHAVE, { fetchImpl: async (url, init) => { pedido = { url, init }; return { ok: true, status: 200, text: async () => '' }; } });
  assert.strictEqual(r.situacao, 'ok');
  assert.strictEqual(pedido.url, 'https://api.groq.com/openai/v1/models');
  assert.strictEqual(pedido.init.headers.Authorization, 'Bearer ' + CHAVE);
  
});

test('VAGAS10: as 10 vagas estão listadas uma a uma nos dois workflows', () => {
  const ler = (f) => require('fs').readFileSync(require('path').join(__dirname, '../../.github/workflows', f), 'utf8');
  for (const f of ['cortex-reserva.yml', 'ia-vagas.yml']) for (const n of v.VAGAS) assert.ok(ler(f).includes(`IA_VAGA_${n}: \${{ secrets.IA_VAGA_${n} }}`), `${f} sem IA_VAGA_${n}`);
  const yml = ler('cortex-reserva.yml');
  for (const p of Object.keys(v.PROVEDORES)) assert.ok(yml.includes(`vaga-$N-${p}|`), `reserva sem ${p}`);
});

test('VAGAS11: sem permissão, a mensagem diz o passo, o código do GitHub e o nome do token', async () => {
  const gh = async (caminho) => { if (caminho === '/actions/secrets/public-key') { const e = new Error('Resource not accessible by personal access token'); e.status = 403; throw e; } return {}; };
  await assert.rejects(v.salvar(gh, { vaga: 1, provedor: 'groq', chave: CHAVE }, { ...servico(200), nomeToken: 'NEXIA_JOBS_TOKEN' }),
    (e) => /NEXIA_JOBS_TOKEN/.test(e.message) && /ler a chave pública do repositório: GitHub 403: Resource not accessible/.test(e.message) && !e.message.includes(CHAVE));
});

test('VAGAS12: Cerebras saiu (pede cartão); Cohere e Hugging Face entraram; NVIDIA confere com POST; Jules mostra estado real', async () => {
  assert.ok(!v.PROVEDORES.cerebras);
  assert.ok(v.PROVEDORES.cohere && v.PROVEDORES.huggingface);
  let pedido;
  const r = await v.testarChave('nvidia', 'nvapi-' + 'z'.repeat(30), { fetchImpl: async (url, init) => { pedido = { url, init }; return { ok: false, status: 401, text: async () => '' }; } });
  assert.strictEqual(r.situacao, 'recusada');
  assert.strictEqual(pedido.init.method, 'POST');
  const agora = Date.parse('2026-10-27T15:00:00Z');
  const j = v.estadoJules({ JULES_API_KEY: 'x' }, [{ number: 1 }, { number: 2, pull_request: {} }],
    [{ number: 9, user: { login: 'google-labs-jules[bot]' }, created_at: '2026-10-27T12:00:00Z', html_url: 'u' }, { number: 8, user: { login: 'outro' }, created_at: '2026-10-27T12:00:00Z' }], agora);
  assert.deepStrictEqual([j.ligado, j.comEle, j.prsHoje, j.ultimoPr.numero], [true, 1, 1, 9]);
  assert.strictEqual(v.estadoJules({}, null, []).ligado, false);
});

test('VAGAS13: NVIDIA testa no modelo da reserva; 410 (modelo saiu) com chave aceita conta como ok', async () => {
  let corpo;
  const r = await v.testarChave('nvidia', 'nvapi-' + 'z'.repeat(30), { fetchImpl: async (url, init) => { corpo = JSON.parse(init.body); return { ok: false, status: 410, text: async () => '' }; } });
  assert.strictEqual(corpo.model, v.PROVEDORES.nvidia.modelo);
  assert.strictEqual(r.situacao, 'ok');
  const g = await v.testarChave('groq', CHAVE, { fetchImpl: async () => ({ ok: false, status: 410, text: async () => '' }) });
  assert.strictEqual(g.situacao, 'erro');
});
