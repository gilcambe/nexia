'use strict';
// Recuperação das tarefas travadas por erro de ambiente (30/10/2026).
// Defeito real: a fila lia só a página 1 (100 eventos) do histórico de cada issue. Tarefa com 12 tentativas tem mais
// de 100 eventos (#2141: evento de travar nº 116 de 116), a data do travamento não aparecia e ela nunca era recuperada.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ultimoRotuloEm, travadasPeloCofre, reservasQueVoltam, entregaComprovada,
  MAX_RECUPERAR_POR_CICLO, FORA_DA_RECUPERACAO,
} = require('../../scripts/cortex-fila');

const issue = (n, labels = []) => ({ number: n, body: 'x', author_association: 'OWNER', labels: ['cortex-fila', ...labels].map(name => ({ name })) });
const ev = (event, nome, em) => ({ event, label: { name: nome }, created_at: em });
// Histórico de uma tarefa que gastou 11 tentativas: muitos rótulos postos e tirados, e só no FIM o "cortex-travado".
function historico({ rotulo, em, total = 116 }) {
  const ruido = Array.from({ length: total - 1 }, (_, k) => ev(k % 2 ? 'unlabeled' : 'labeled', k % 2 ? 'pista-2' : 'cortex-rodando', '2026-10-27T19:00:00Z'));
  return [...ruido, ev('labeled', rotulo, em)];
}
// GitHub falso: paginação por ?page=, 100 por página, na ordem do mais antigo ao mais novo.
function githubFalso({ eventos = {}, prs = [] } = {}) {
  const chamadas = [];
  const fn = async (_t, _m, caminho) => {
    chamadas.push(caminho);
    let m = /^\/issues\/(\d+)\/events\?per_page=100&page=(\d+)$/.exec(caminho);
    if (m) { const todos = eventos[m[1]] || []; const p = Number(m[2]); return { status: 200, json: todos.slice((p - 1) * 100, p * 100) }; }
    if (caminho.startsWith('/pulls?state=closed')) return { status: 200, json: prs };
    throw new Error('chamada inesperada: ' + caminho);
  };
  fn.chamadas = chamadas;
  return fn;
}
const ANTES = '2026-10-27T20:30:29Z';   // travou antes do conserto (29/10 23:59:59 UTC)
const DEPOIS = '2026-10-30T01:10:00Z';  // travou depois: a causa é da tarefa

test('RF1. ultimoRotuloEm lê todas as páginas: o evento nº 116 de 116 é encontrado', async () => {
  const gh = githubFalso({ eventos: { 2141: historico({ rotulo: 'cortex-travado', em: ANTES }) } });
  assert.equal(await ultimoRotuloEm('t', 2141, 'cortex-travado', gh), ANTES);
  assert.ok(gh.chamadas.some(c => c.endsWith('page=2')), 'precisa ter pedido a página 2');
});

test('RF2. ultimoRotuloEm devolve o rótulo mais recente quando ele foi posto mais de uma vez', async () => {
  const lista = [ev('labeled', 'cortex-travado', '2026-10-20T10:00:00Z'), ev('unlabeled', 'cortex-travado', '2026-10-21T10:00:00Z'), ev('labeled', 'cortex-travado', ANTES)];
  assert.equal(await ultimoRotuloEm('t', 7, 'cortex-travado', githubFalso({ eventos: { 7: lista } })), ANTES);
});

test('RF3. resposta de erro da API lança erro (nunca vira "sem data" e decide errado)', async () => {
  const gh = async () => ({ status: 403, json: { message: 'rate limit' } });
  await assert.rejects(ultimoRotuloEm('t', 7, 'cortex-travado', gh), /inesperada/);
});

test('RF4. REGRESSÃO #2141/#2145/#2159: tarefa com mais de 100 eventos, travada antes do conserto, volta para a fila do zero', async () => {
  const gh = githubFalso({ eventos: { 2141: historico({ rotulo: 'cortex-travado', em: ANTES, total: 116 }), 2159: historico({ rotulo: 'cortex-travado', em: '2026-10-28T11:17:51Z', total: 309 }) } });
  const v = await travadasPeloCofre('t', [issue(2141, ['cortex-travado', 'tentativa-11', 'cortex-parte']), issue(2159, ['cortex-travado', 'tentativa-11', 'reserva-tentou'])], { ghFn: gh });
  assert.deepEqual(v.map(x => [x.tipo, x.numero, x.motivo]), [['reserva-volta', 2141, 'cofre'], ['reserva-volta', 2159, 'cofre']]);
});

test('RF5. travou DEPOIS do conserto: não volta (a causa é da tarefa; evita laço de tentativas)', async () => {
  const gh = githubFalso({ eventos: { 2383: historico({ rotulo: 'cortex-travado', em: DEPOIS }) } });
  assert.deepEqual(await travadasPeloCofre('t', [issue(2383, ['cortex-travado'])], { ghFn: gh }), []);
});

test('RF6. REGRESSÃO da janela de 15: travadas antigas elegíveis são alcançadas mesmo com 15 mais novas na frente', async () => {
  // GitHub lista da mais nova para a mais antiga: as 15 mais novas travaram depois do conserto, as 5 mais antigas antes.
  const eventos = {}; const issues = [];
  for (let n = 119; n >= 100; n--) { issues.push(issue(n, ['cortex-travado'])); eventos[n] = historico({ rotulo: 'cortex-travado', em: n >= 105 ? DEPOIS : ANTES, total: 30 }); }
  const v = await travadasPeloCofre('t', issues, { ghFn: githubFalso({ eventos }) });
  assert.deepEqual(v.map(x => x.numero).sort(), [100, 101, 102, 103, 104]);
});

test('RF7. no máximo MAX_RECUPERAR_POR_CICLO por ciclo, das mais antigas para as mais novas (não despeja tudo de uma vez)', async () => {
  const eventos = {}; const issues = [];
  for (let n = 200; n < 220; n++) { issues.push(issue(n, ['cortex-travado'])); eventos[n] = historico({ rotulo: 'cortex-travado', em: ANTES, total: 12 }); }
  const v = await travadasPeloCofre('t', issues.reverse(), { ghFn: githubFalso({ eventos }) });
  assert.equal(v.length, MAX_RECUPERAR_POR_CICLO);
  assert.deepEqual(v.map(x => x.numero), [200, 201, 202, 203, 204, 205].slice(0, MAX_RECUPERAR_POR_CICLO));
});

test('RF8. tarefa em outro degrau da escada (Jules, Claude, humano) não volta para o Cortex: evita 2ª frente na mesma tarefa', async () => {
  const eventos = {}; const issues = [];
  FORA_DA_RECUPERACAO.forEach((rotulo, k) => { const n = 300 + k; issues.push(issue(n, ['cortex-travado', rotulo])); eventos[n] = historico({ rotulo: 'cortex-travado', em: ANTES, total: 10 }); });
  const gh = githubFalso({ eventos });
  assert.deepEqual(await travadasPeloCofre('t', issues, { ghFn: gh }), []);
  assert.equal(gh.chamadas.length, 0, 'nem consulta a API para elas');
});

test('RF9. PR já integrado que cita a tarefa: não repete o trabalho e não fecha sozinha', async () => {
  const gh = githubFalso({
    eventos: { 2145: historico({ rotulo: 'cortex-travado', em: ANTES, total: 114 }), 2144: historico({ rotulo: 'cortex-travado', em: ANTES, total: 114 }) },
    prs: [{ number: 2506, merged_at: '2026-10-29T16:00:00Z', title: 'Cortex: para-spec.js', body: 'Parte 2/3 de #2133. Refs #2145' }, { number: 9, merged_at: null, title: 'rascunho', body: 'Refs #2144' }],
  });
  const v = await travadasPeloCofre('t', [issue(2144, ['cortex-travado']), issue(2145, ['cortex-travado'])], { ghFn: gh });
  assert.deepEqual(v.map(x => x.numero), [2144], 'a 2145 tem PR integrado; a 2144 só tem rascunho não mesclado');
  assert.equal(entregaComprovada(2145, [{ number: 1, merged_at: 'x', title: '#21450', body: '' }]), null, '#21450 não é #2145');
});

test('RF10. falha da API em uma tarefa não derruba as outras', async () => {
  const bom = githubFalso({ eventos: { 2142: historico({ rotulo: 'cortex-travado', em: ANTES, total: 112 }) } });
  const gh = async (t, m, c) => { if (c.includes('/issues/2141/')) throw new Error('503'); return bom(t, m, c); };
  const v = await travadasPeloCofre('t', [issue(2141, ['cortex-travado']), issue(2142, ['cortex-travado'])], { ghFn: gh });
  assert.deepEqual(v.map(x => x.numero), [2142]);
});

test('RF11. REGRESSÃO reservasQueVoltam: com mais de 100 eventos, a tarefa sem cota de HOJE não volta a cada ciclo', async () => {
  const hoje = Date.parse('2026-10-30T15:00:00Z');
  const gh = githubFalso({ eventos: { 7: historico({ rotulo: 'cortex-reserva-sem-cota', em: '2026-10-30T12:00:00Z', total: 150 }), 8: historico({ rotulo: 'cortex-reserva-sem-cota', em: '2026-10-28T12:00:00Z', total: 150 }) } });
  const v = await reservasQueVoltam('t', [issue(7, ['cortex-reserva-sem-cota']), issue(8, ['cortex-reserva-sem-cota'])], hoje, gh);
  assert.deepEqual(v.map(x => x.numero), [8], 'a 7 foi rotulada hoje: espera o dia virar; a 8 é de anteontem: volta');
});
