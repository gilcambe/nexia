'use strict';
// 26/11/2026 (PC2): o Cortex não pode ficar travado sem saída. Cobre as 4 causas achadas nas 15 travadas.
const test = require('node:test');
const assert = require('node:assert/strict');
const { caminhosDoPedido, validarCortexFeito, planoDeDestrava, feitoPorComentario, travadasPeloCofre, MAX_DESTRAVAS } = require('../../scripts/cortex-fila');
const plano = require('../../scripts/cortex-plano');

const parte = plano.corpoDaParte(
  { tarefa: 'Criar executor', arquivos: ['nexia-ai/skills/executor.js'], depende: [], pronto: 'testes passam' }, 4, 5, 4146, [],
  'Criar `nexia-ai/skills/index.js`, `nexia-ai/skills/job-agendado/SKILL.md` e `tests/unit/cortex-skills.test.js`.');
const iss = (n, labels, extra = {}) => ({ number: n, body: 'x', author_association: 'OWNER', labels: labels.map(name => ({ name })), ...extra });

test('T1. parte de pedido grande confere só os arquivos do plano, não os do "pedido original" (#4155-#4157)', () => {
  assert.ok(parte.includes('index.js'), 'o corpo da parte leva o pedido original para consulta');
  assert.deepEqual(caminhosDoPedido(parte), ['nexia-ai/skills/executor.js']);
  assert.deepEqual(caminhosDoPedido('Mudar `src/a/b.ts`\n\nPedido original de #9 (só consulta)\n`src/x/y.js`'), ['src/a/b.ts']);
  assert.deepEqual(caminhosDoPedido('Mudar `src/a/b.ts` e `src/c/d.js`'), ['src/a/b.ts', 'src/c/d.js']);
});

function ghFalso({ fechados = [], abertos = [], arquivos = {}, runs = [] } = {}) {
  return async (_t, _m, c) => {
    if (c.startsWith('/pulls?state=closed')) return { status: 200, json: fechados };
    if (c.startsWith('/pulls?state=open')) return { status: 200, json: abertos };
    if (c.startsWith('/contents/')) return { status: arquivos[c.slice(10).split('?')[0]] ? 200 : 404, json: {} };
    if (c.startsWith('/actions/runs')) return { status: 200, json: { workflow_runs: runs } };
    return { status: 200, json: [] };
  };
}

test('T2. PR do Cortex ainda ABERTO citando a issue não é falta de entrega (#4093, #4097, #4189, #4203)', async () => {
  const aberto = { number: 7, title: 'Cortex #50', body: 'Closes #50', base: { ref: 'develop' }, head: { ref: 'nexia/cortex-50' } };
  const v = await validarCortexFeito('t', { number: 50, body: 'Mexa em `src/a/b.js`' }, ghFalso({ abertos: [aberto] }));
  assert.equal(v.ok, true, v.faltas.join('; '));
});

test('T3. sem nenhum PR (nem aberto) continua falhando; PR aberto de outro ramo não vale', async () => {
  const deOutro = { number: 8, title: 'x', body: 'Closes #50', base: { ref: 'develop' }, head: { ref: 'feature/x' } };
  const v = await validarCortexFeito('t', { number: 50, body: 'x' }, ghFalso({ abertos: [deOutro] }));
  assert.equal(v.ok, false);
  assert.ok(v.faltas[0].includes('Nenhum PR mesclado'));
});

test('T4. CI: vale a execução mais recente de cada fluxo (falha antiga já refeita não trava)', async () => {
  const pr = { number: 9, merged_at: '2026-11-20T10:00:00Z', title: 'x', body: 'Closes #51', base: { ref: 'develop' }, merge_commit_sha: 'abc1234' };
  const runs = [{ workflow_id: 1, conclusion: 'failure', created_at: '2026-11-20T10:00:00Z' }, { workflow_id: 1, conclusion: 'success', created_at: '2026-11-20T10:30:00Z' }];
  assert.equal((await validarCortexFeito('t', { number: 51, body: 'x' }, ghFalso({ fechados: [pr], runs }))).ok, true);
  const ruim = [{ workflow_id: 1, conclusion: 'success', created_at: '2026-11-20T10:00:00Z' }, { workflow_id: 1, conclusion: 'failure', created_at: '2026-11-20T10:30:00Z' }];
  assert.equal((await validarCortexFeito('t', { number: 51, body: 'x' }, ghFalso({ fechados: [pr], runs: ruim }))).ok, false);
});

test('T5. planoDeDestrava: espera 2 h, sobe os degraus e no fim pede uma pessoa (nunca repete igual)', () => {
  const t = iss(1, ['cortex-travado', 'contrato-nao-testavel', 'sem-entrega-2']);
  const agora = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(planoDeDestrava(t, '2026-11-26T11:00:00Z', agora), null, 'muito cedo');
  assert.deepEqual(planoDeDestrava(t, '2026-11-26T09:00:00Z', agora), { tipo: 'destravar', passo: 1 });
  assert.deepEqual(planoDeDestrava(iss(1, ['cortex-travado', 'contrato-falhou', 'destrava-1']), null, agora), { tipo: 'destravar', passo: 2 });
  assert.deepEqual(planoDeDestrava(iss(1, ['cortex-travado', 'contrato-falhou', `destrava-${MAX_DESTRAVAS}`]), null, agora), { tipo: 'pedir-humano', passo: MAX_DESTRAVAS + 1 });
  assert.equal(planoDeDestrava(iss(1, ['cortex-travado', 'contrato-falhou', 'so-humano']), null, agora), null, 'já está com uma pessoa');
  assert.equal(planoDeDestrava(iss(1, ['cortex-travado']), null, agora), null, 'sem contrato: outro caminho cuida');
});

test('T6. "Feito no PR #N" do dono + PR mesclado = entregue por outro caminho', () => {
  const mesclados = [{ number: 4216, merged_at: '2026-11-25T10:00:00Z' }, { number: 5, merged_at: null }];
  const dono = { author_association: 'OWNER', body: 'Feito no PR #4216 (pacote 1). Tirado da fila do Cortex.' };
  assert.equal(feitoPorComentario([dono], mesclados).number, 4216);
  assert.equal(feitoPorComentario([{ ...dono, author_association: 'NONE' }], mesclados), null, 'só dono/colaborador');
  assert.equal(feitoPorComentario([{ ...dono, body: 'Feito no PR #5' }], mesclados), null, 'PR não mesclado');
});

test('T7. travadasPeloCofre: fecha a já feita por outro caminho e destrava a que o contrato desistiu', async () => {
  const comentarios = { 4206: [{ author_association: 'OWNER', body: 'Feito no PR #4216. Tirado da fila.' }] };
  const gh = async (_t, _m, c) => {
    let m;
    if (c.startsWith('/pulls?state=closed')) return { status: 200, json: [{ number: 4216, merged_at: '2026-11-25T10:00:00Z', title: 'pacote', body: '' }] };
    if ((m = /^\/issues\/(\d+)\/comments/.exec(c))) return { status: 200, json: comentarios[m[1]] || [] };
    if ((m = /^\/issues\/(\d+)\/events/.exec(c))) return { status: 200, json: [{ event: 'labeled', label: { name: 'cortex-travado' }, created_at: '2026-11-20T00:00:00Z' }] };
    throw new Error('chamada inesperada: ' + c);
  };
  const r = await travadasPeloCofre('t', [iss(4206, ['cortex-travado', 'contrato-nao-testavel']), iss(4193, ['cortex-travado', 'contrato-nao-testavel', 'cortex-parte'])], { ghFn: gh, agora: Date.parse('2026-11-26T12:00:00Z') });
  assert.deepEqual(r.map(a => [a.numero, a.tipo]), [[4193, 'destravar'], [4206, 'fechar-por-pr']]);
  assert.equal(r[0].parte, true);
  assert.equal(r[1].pr, 4216);
});
