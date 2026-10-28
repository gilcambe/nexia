'use strict';
// Fila fixa do Cortex: decisões puras (sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { decidir, MAX_TENTATIVAS, precisaDividir, paisConcluidos, dividirComIA, sondarCota } = require('../../scripts/cortex-fila');

const AGORA = Date.parse('2026-10-07T10:00:00Z');
const issue = (n, labels = [], extra = {}) => ({ number: n, body: `tarefa ${n}`, author_association: 'OWNER', updated_at: '2026-10-07T09:59:00Z', labels: ['cortex-fila', ...labels].map(name => ({ name })), ...extra });
const run = (n, status, conclusion, minAtras = 1, id = n * 10) => ({ id, name: `Cortex #${n}`, status, conclusion, updated_at: new Date(AGORA - minAtras * 60000).toISOString() });

test('CF1. despacha em até 3 pistas, cada uma com o seu número', () => {
  const a = decidir({ issues: [1, 2, 3, 4].map(n => issue(n)), runs: [], agora: AGORA, pistas: 3 });
  assert.deepEqual(a.map(x => [x.tipo, x.numero, x.pista]), [['despachar', 1, 1], ['despachar', 2, 2], ['despachar', 3, 3]]);
});

test('CF2. ignora Issue de quem não é dono/membro/colaborador e pull requests', () => {
  const a = decidir({ issues: [issue(1, [], { author_association: 'NONE' }), issue(2, [], { pull_request: {} })], runs: [], agora: AGORA });
  assert.deepEqual(a, []);
});

test('CF3. execução com sucesso conclui; falha reenfileira com tentativa+1', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1']), issue(2, ['cortex-rodando', 'pista-2', 'tentativa-3'])], runs: [run(1, 'completed', 'success'), run(2, 'completed', 'failure')], agora: AGORA });
  assert.equal(a[0].tipo, 'concluir');
  assert.deepEqual([a[1].tipo, a[1].tentativa], ['reenfileirar', 4]);
});

test('CF4. na última tentativa trava e avisa', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando', `tentativa-${MAX_TENTATIVAS - 1}`])], runs: [run(1, 'completed', 'failure')], agora: AGORA });
  assert.equal(a[0].tipo, 'travar');
});

test('CF5. tarefa que falhou é despachada na hora (sem espera de horário), respeitando pistas', () => {
  const issues = [issue(1, ['tentativa-2']), issue(2, ['cortex-rodando', 'pista-1']), issue(3)];
  const a = decidir({ issues, runs: [run(1, 'completed', 'failure', 1), run(2, 'in_progress', null)], agora: AGORA });
  assert.deepEqual(a.map(x => [x.numero, x.pista]), [[1, 2], [3, 3]]);
});

test('CF6. "rodando" sem execução por mais de 20 minutos volta para a fila', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando'], { updated_at: '2026-10-07T09:30:00Z' })], runs: [], agora: AGORA });
  assert.equal(a[0].tipo, 'reenfileirar');
});

test('CF-cota. falha por cota do banco não gasta tentativa e a fila NÃO pausa por horário', () => {
  const r = { ...run(1, 'completed', 'failure', 5), cota: true };
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1', 'tentativa-2']), issue(2)], runs: [r], agora: AGORA });
  assert.deepEqual([a[0].tipo, a[0].tentativa], ['reenfileirar', 2]);
  assert.equal(a.some(x => x.tipo === 'despachar' && x.numero === 2), true);
});

test('CF-teste-final. fila vazia depois de entregas sem teste novo dispara o teste de pessoa', () => {
  const { precisaTesteFinal } = require('../../scripts/cortex-fila');
  assert.strictEqual(precisaTesteFinal({ abertas: 1, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), false, 'ainda há tarefas');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: null, testeEm: null }), false, 'nada foi entregue');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), true);
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T09:00:00Z' }), true, 'teste é anterior à entrega');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T11:00:00Z' }), false, 'já testado');
});

test('CF-D1. tarefa grande é dividida (não despachada); pequena segue; parte e já dividida nunca se dividem de novo', () => {
  const grande = issue(1, [], { body: 'x'.repeat(2600) });
  const muitosArquivos = issue(2, [], { body: 'Edite a.js, b.js, c.js, d.js e e.js' });
  const pequena = issue(3, []);
  const parte = issue(4, ['cortex-parte'], { body: 'y'.repeat(2600) });
  const a = decidir({ issues: [grande, muitosArquivos, pequena, parte], runs: [], agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.numero]), [['dividir', 1], ['dividir', 2], ['despachar', 3], ['despachar', 4]]);
  assert.equal(precisaDividir(issue(5, ['cortex-sem-divisao'], { body: 'z'.repeat(3000) })), false);
  assert.equal(decidir({ issues: [issue(6, ['cortex-dividido'])], runs: [], agora: AGORA }).length, 0, 'pai dividido não é despachado');
});

test('CF-D2. pai é concluído só quando todas as partes estão feitas', () => {
  const pais = [{ number: 10, labels: ['cortex-dividido'] }];
  const parte = (k, estado, feito) => ({ title: `[Parte ${k}/2 de #10] x`, state: estado, labels: feito ? ['cortex-parte', 'cortex-feito'] : ['cortex-parte'] });
  assert.deepEqual(paisConcluidos({ pais, partes: [parte(1, 'closed', true), parte(2, 'open', false)] }), []);
  assert.deepEqual(paisConcluidos({ pais, partes: [parte(1, 'closed', true), parte(2, 'closed', true)] }), [10]);
  assert.deepEqual(paisConcluidos({ pais, partes: [] }), []);
});

test('CF-D3. divisor aceita só 2 a 5 partes completas e tenta o próximo modelo', async () => {
  const resp = textos => ({ capabilities: () => ({ available: true }), chat: async () => ({ text: textos }) });
  const boa = JSON.stringify(['Parte um com texto bem completo do arquivo a.js', 'Parte dois com texto bem completo do arquivo b.js']);
  assert.equal(await dividirComIA('t', resp('sem json'), [{}]), null);
  assert.equal(await dividirComIA('t', resp('["curta"]'), [{}]), null);
  const r = { capabilities: d => ({ available: d.ok }), chat: async () => ({ text: boa }) };
  assert.equal((await dividirComIA('t', r, [{ ok: false }, { ok: true }])).length, 2);
});

test('CF-Q1. sonda de cota: sem conta segue; 429/RESOURCE_EXHAUSTED segura; outro erro não trava a fila', async () => {
  assert.equal((await sondarCota({}, async () => { throw new Error('não deveria chamar'); })).ok, true);
  const sa = { project_id: 'p', client_email: 'a@b.c', private_key: 'x' };
  const env = { FIREBASE_SERVICE_ACCOUNT_B: JSON.stringify(sa) };
  const tok = async () => 't';
  assert.equal((await sondarCota(env, async () => ({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' }), tok)).ok, false);
  assert.equal((await sondarCota(env, async () => ({ ok: true }), tok)).ok, true);
  const soLeituraEsgotada = async (u, o) => (o.method === 'GET' ? { ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' } : { ok: true });
  assert.equal((await sondarCota(env, soLeituraEsgotada, tok)).ok, false, 'leitura esgotada com escrita ok também segura');
  assert.equal((await sondarCota(env, async () => ({ ok: false, status: 500, text: async () => 'erro' }), tok)).ok, true, 'erro desconhecido não trava a fila');
  assert.equal((await sondarCota(env, async () => { throw new Error('rede'); }, tok)).ok, true);
});

test('CF-Q2. sondarCota com 429 e 200', async () => {
  const sa = { project_id: 'p', client_email: 'a@b.c', private_key: 'x' };
  const env = { FIREBASE_SERVICE_ACCOUNT_B: JSON.stringify(sa) };
  const tok = async () => 't';
  
  // Resposta 429 com mensagem 'free tier daily row read limit'
  const fetch429 = async () => ({
    ok: false,
    status: 429,
    text: async () => 'free tier daily row read limit'
  });
  assert.equal((await sondarCota(env, fetch429, tok)).ok, false);

  // Resposta 200
  const fetch200 = async () => ({
    ok: true,
    status: 200,
    text: async () => 'ok'
  });
  assert.equal((await sondarCota(env, fetch200, tok)).ok, true);
});

test('CF13. partes criadas pela própria fila (github-actions[bot]) são despachadas, uma de cada vez e em ordem', () => {
  const parte = (n, k) => issue(n, ['cortex-parte'], { author_association: 'CONTRIBUTOR', user: { login: 'github-actions[bot]' }, title: `[Parte ${k}/2 de #359] Bezsan: fontes` });
  const a = decidir({ issues: [parte(364, 1), parte(365, 2)], runs: [], agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.numero]), [['despachar', 364]]);
  // Quando a parte 1 sai da fila (concluída), a 2 é despachada.
  const b = decidir({ issues: [parte(365, 2)], runs: [], agora: AGORA });
  assert.deepEqual(b.map(x => [x.tipo, x.numero]), [['despachar', 365]]);
});

test('CF14. Issue com rótulo de parte, mas de outra pessoa de fora, continua ignorada', () => {
  const a = decidir({ issues: [issue(1, ['cortex-parte'], { author_association: 'CONTRIBUTOR', user: { login: 'alguem' }, title: '[Parte 1/2 de #9] x' })], runs: [], agora: AGORA });
  assert.deepEqual(a, []);
});

test('FILA-CAM: caminhosDoPedido pega só arquivos entre crases com pasta', () => {
  const { caminhosDoPedido } = require('../../scripts/cortex-fila');
  assert.deepEqual(caminhosDoPedido('Crie `src/a/b.ts` e `README.md` e `/health` e `../x/y.js` e `src/a/b.ts`'), ['src/a/b.ts']);
  assert.deepEqual(caminhosDoPedido('sem nada'), []);
});

test('FILA-DIV3. tarefa que falha 3 vezes é dividida em partes em vez de repetir até travar', () => {
  const { decidir } = require('../../scripts/cortex-fila.js');
  const issue = (extra = []) => ({ number: 9, title: 'NEXIA: loja grande', body: 'Faça a loja.', author_association: 'OWNER', labels: ['cortex-fila', 'cortex-rodando', 'pista-1', 'tentativa-2', ...extra].map(name => ({ name })) });
  const runs = [{ id: 5, name: 'Cortex #9', status: 'completed', conclusion: 'failure' }];
  const a = decidir({ issues: [issue()], runs, agora: Date.now() }).find(x => x.numero === 9);
  assert.equal(a.tipo, 'dividir');
  assert.equal(a.limpar, true);
  assert.equal(a.tentativa, 3);
  // já dividida antes (sem divisão): continua o caminho normal de repetir
  const b = decidir({ issues: [issue(['cortex-sem-divisao'])], runs, agora: Date.now() }).find(x => x.numero === 9);
  assert.equal(b.tipo, 'reenfileirar');
});

test('cópia exata grande nunca vai para o divisor (perderia o código)', () => {
  const corpo = 'Copie EXATAMENTE:\n\n' + ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map((f) => '`src/' + f + '`\n```\n' + 'x'.repeat(900) + '\n```\n').join('\n');
  assert.equal(precisaDividir(issue(7, ['cortex-fila'], { body: corpo })), false);
  assert.equal(precisaDividir(issue(8, ['cortex-fila'], { body: 'Faça algo em src/a.js. ' + 'z'.repeat(3000) })), true);
});

test('CF-PRIO. rótulo cortex-prioridade passa na frente das tarefas antigas', () => {
  const a = decidir({ issues: [issue(1), issue(2), issue(3), issue(9, ['cortex-prioridade'])], runs: [], agora: AGORA, pistas: 3 });
  assert.deepEqual(a.map(x => x.numero), [9, 1, 2]);
});

test('CF-VAZAO. padrão de 6 pistas; parte anterior travada não segura as seguintes', () => {
  const a = decidir({ issues: [1, 2, 3, 4, 5, 6, 7].map(n => issue(n)), runs: [], agora: AGORA });
  assert.strictEqual(a.filter(x => x.tipo === 'despachar').length, 6);
  const p1 = issue(10, ['cortex-parte', 'cortex-travado'], { title: '[Parte 1/2 de #9] x' });
  const p2 = issue(11, ['cortex-parte'], { title: '[Parte 2/2 de #9] x' });
  assert.deepEqual(decidir({ issues: [p1, p2], runs: [], agora: AGORA }).map(x => x.numero), [11]);
});

test('CF-1016a. tarefa aberta com cortex-feito fecha como concluída (e não ocupa pista)', () => {
  const a = decidir({ issues: [issue(800, ['cortex-feito', 'cortex-rodando', 'pista-2']), issue(2)], runs: [], agora: AGORA, pistas: 1 });
  assert.deepEqual(a.map(x => [x.tipo, x.numero, x.pista]), [['fechar-feito', 800, undefined], ['despachar', 2, 1]]);
});

test('CF-1016b. "rodando" com execução que não termina há mais de 2 h volta para a fila e libera a pista', () => {
  const velha = { ...run(1, 'queued', null), created_at: new Date(AGORA - 121 * 60000).toISOString() };
  const nova = { ...run(2, 'in_progress', null), created_at: new Date(AGORA - 30 * 60000).toISOString() };
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1']), issue(2, ['cortex-rodando', 'pista-2']), issue(3)], runs: [velha, nova], agora: AGORA, pistas: 2 });
  assert.deepEqual(a.map(x => [x.tipo, x.numero, x.pista]), [['reenfileirar', 1, undefined], ['despachar', 3, 1]]);
});

test('CF-1016c. reenfileirar, travar, dividir e concluir tiram todos os pista-*; despachar deixa só a nova', async () => {
  const fonte = require('fs').readFileSync(require('path').join(__dirname, '../../scripts/cortex-fila.js'), 'utf8');
  const bloco = tipo => { const ini = fonte.indexOf(`acao.tipo === '${tipo}')`); return ini < 0 ? '' : fonte.slice(ini, fonte.indexOf('\n  }', ini)); };
  for (const t of ['reenfileirar', 'travar', 'dividir', 'fechar-feito']) assert.match(bloco(t), /limparPistas\(\)/, t);
  assert.match(bloco('concluir'), /limparPistas\(\)/);
  assert.match(bloco('despachar'), /limparPistas\(acao\.pista\)/);
});

// #852: pedido que muda arquivo que já existia, sem commit depois do início e sem PR, não é concluído.
async function comFetch(rotas, fn) {
  const antes = global.fetch;
  const chamadas = [];
  global.fetch = async url => {
    chamadas.push(url);
    const r = rotas.find(([re]) => re.test(url));
    const [status, json] = r ? r[1] : [404, {}];
    return { status, text: async () => JSON.stringify(json) };
  };
  try { return await fn(chamadas); } finally { global.fetch = antes; }
}
const { entregouAlgo } = require('../../scripts/cortex-fila');
const PEDIDO = 'Mudar `central/produtos.js` para mostrar o preço.';

test('CF-852a. arquivo já existente sem commit depois do início e sem PR: NÃO entregou', async () => {
  const ok = await comFetch([[/\/contents\//, [200, {}]], [/\/commits\?/, [200, []]], [/\/pulls\?/, [200, []]]],
    chamadas => entregouAlgo('t', PEDIDO, 'x', 1, '2026-10-18T10:00:00Z').then(v => { assert.ok(chamadas.some(u => /since=2026-10-18/.test(u))); return v; }));
  assert.equal(ok, false);
});

test('CF-852b. arquivo já existente com commit na develop depois do início: entregou', async () => {
  const ok = await comFetch([[/\/contents\//, [200, {}]], [/\/commits\?/, [200, [{ sha: 'a' }]]]],
    () => entregouAlgo('t', PEDIDO, 'x', 1, '2026-10-18T10:00:00Z'));
  assert.equal(ok, true);
});

test('CF-852c. PR aberto nexia/* com o arquivo continua contando', async () => {
  const ok = await comFetch([[/\/contents\//, [200, {}]], [/\/commits\?/, [200, []]], [/\/pulls\/7\/files/, [200, [{ filename: 'central/produtos.js' }]]], [/\/pulls\?/, [200, [{ number: 7, head: { ref: 'nexia/x' } }]]]],
    () => entregouAlgo('t', PEDIDO, 'x', 1, '2026-10-18T10:00:00Z'));
  assert.equal(ok, true);
});

test('CF-852d. concluir leva o created_at da issue em acao.desde', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1'], { created_at: '2026-10-18T10:00:00Z' })], runs: [run(1, 'completed', 'success')], agora: AGORA });
  assert.equal(a[0].tipo, 'concluir');
  assert.equal(a[0].desde, '2026-10-18T10:00:00Z');
});
