'use strict';
// ADR-CORTEX-01: o Cortex grava edições em arquivos existentes com modelos grátis (histórico com o
// arquivo inteiro, lembretes, blocos de edição em texto, JSON inválido devolvido ao modelo, arquivos
// pré-carregados). Router e gateway falsos: nenhum modelo nem GitHub de verdade.
const test = require('node:test');
const assert = require('node:assert');
const { runAgent, compact, createMeter } = require('../../nexia-ai/orchestrator/runtime');
const { parseEditBlocks } = require('../../nexia-ai/orchestrator/edit-blocks');
const { filesIn } = require('../../nexia-ai/orchestrator');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');
const { createGithubAdapter, looseFind } = require('../../nexia-ai/github-adapter');
const { createFakeGithub } = require('../fake-github');

const BRANCH = 'nexia/login-real-abc123';
const PAGE = 'apps/body-coach/src/pages/auth/page.tsx';
const CTX = 'apps/body-coach/src/components/feature/AuthContext.tsx';
const pageText = `${'// linha de código do login\n'.repeat(300)}<p>Use admin / admin01 para a demo</p>\n<button>Entrar como demo</button>\n`;
const ctxText = `export function login(u, p) {\n  if (u === 'admin' && p === 'admin01') return demo();\n  return signIn(u, p);\n}\n`;
const goal = `Pedido do usuário: "Remova o modo demo"\nBranch de trabalho: ${BRANCH} (já existe).`;
const call = (name, input) => ({ id: `c_${Math.random().toString(36).slice(2, 8)}`, name: name.replace(/\./g, '__'), input });

/** Router com respostas em fila; guarda cada pedido para conferir o que o modelo recebeu. */
function fakeRouter(script) {
  const queue = [...script];
  const seen = [];
  return {
    seen,
    capabilities: d => ({ available: d.provider === 'groq', tool_call: true }),
    async toolCall(desc, req) {
      seen.push(req);
      const next = queue.shift();
      const r = typeof next === 'function' ? next(req) : next;
      if (!r) return { text: 'nada a fazer', tool_calls: [], usage: {} };
      return { tool_calls: [], usage: { input_tokens: 10, output_tokens: 5 }, ...r };
    },
  };
}

/** Gateway em memória com get_file / edit_files / commit_files (edit_files com a mesma regra do adapter). */
function fakeGateway(files = { [PAGE]: pageText, [CTX]: ctxText }) {
  const calls = [];
  const state = { ...files };
  const tools = ['github.get_file', 'github.edit_files', 'github.commit_files', 'github.compare'].map(name => ({ name, risk: 'LOW', description: name, input_schema: { type: 'object' } }));
  let n = 0;
  return {
    calls, state,
    describe: () => tools,
    async invoke(ctx, req) {
      calls.push(req);
      const tool_call = { id: `tc_${++n}` };
      const i = req.input;
      if (req.tool === 'github.get_file') {
        if (!(i.path in state)) return { tool_call, status: 'failed', error: { code: 'NOT_FOUND', message: 'não existe' } };
        return { tool_call, status: 'succeeded', result: { path: i.path, sha: 'x', size: state[i.path].length, content: state[i.path], redactions: 0 } };
      }
      if (req.tool === 'github.edit_files') {
        if (!Array.isArray(i.edits)) { const e = new Error('Entrada inválida para github.edit_files.'); e.code = 'INVALID_INPUT'; e.details = { problems: ['$.edits: obrigatório'] }; throw e; }
        if (!/^nexia\//.test(i.branch)) return { tool_call, status: 'denied', reason: 'só nexia/' };
        for (const e of i.edits) {
          const text = state[e.path] || '';
          const loose = text.split(e.find).length - 1 === 1 ? { start: text.indexOf(e.find), end: text.indexOf(e.find) + e.find.length } : looseFind(text, e.find);
          if (!loose) return { tool_call, status: 'failed', error: { code: 'INVALID_INPUT', message: `${e.path}: o trecho aparece 0 vez(es)` } };
          state[e.path] = text.slice(0, loose.start) + e.replace + text.slice(loose.end);
        }
        return { tool_call, status: 'succeeded', result: { branch: i.branch, commit: 'abc', files: [] } };
      }
      if (req.tool === 'github.commit_files') {
        for (const f of i.files) state[f.path] = f.content;
        return { tool_call, status: 'succeeded', result: { branch: i.branch, commit: 'def', files: [] } };
      }
      return { tool_call, status: 'succeeded', result: {} };
    },
  };
}

const meter = () => createMeter({ max_steps: 100, max_tool_calls: 200, max_tokens: 1e9, max_ms: 60000 });
const run = (router, gateway, extra = {}) => runAgent({ agentId: 'frontend', goal, router, gateway, ctx: {}, projectId: 'p1', meter: meter(), ...extra });
const userTexts = req => req.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');

test('CE1. compact: a leitura mais recente de cada arquivo fica inteira; releitura e leitura antes de gravar viram nota', () => {
  const res = (results) => ({ role: 'user', content: `RESULTADO DAS FERRAMENTAS (JSON):\n${JSON.stringify(results)}`, _results: results });
  const file = (path, content) => ({ tool: 'github.get_file', ok: true, result: { path, content, size: content.length } });
  const A = 'A'.repeat(9000), B = 'B'.repeat(9000), C = 'C'.repeat(9000);
  const msgs = [{ role: 'user', content: 'pedido' },
    { role: 'assistant', content: 'x' }, res([file('a.tsx', A)]),
    { role: 'assistant', content: 'x' }, res([file('b.ts', B)]),
    { role: 'assistant', content: 'x' }, res([file('c.ts', C)]),
    { role: 'assistant', content: 'x' }, res([{ tool: 'github.compare', ok: true, result: { files: 'z'.repeat(5000) } }])];
  const out = compact(msgs);
  for (const [i, ch] of [[2, 'A'], [4, 'B'], [6, 'C']]) assert.ok(out[i].content.includes(ch.repeat(9000)), `arquivo ${ch} inteiro mesmo depois de 3 resultados (antes: cortado em 1500)`);
  assert.ok(out[8].content.includes('z'.repeat(5000)), 'último resultado inteiro');
  assert.strictEqual(msgs[2].content.length > 9000, true, 'não altera o original');

  // releitura do mesmo arquivo: só a mais recente vai inteira
  const reread = [...msgs, { role: 'assistant', content: 'x' }, res([file('a.tsx', A)]), { role: 'assistant', content: 'x' }, res([{ tool: 'github.list_commits', ok: true, result: { commits: [] } }])];
  const o2 = compact(reread);
  assert.ok(!o2[2].content.includes('A'.repeat(100)) && /lido de novo mais abaixo/.test(o2[2].content));
  assert.ok(o2[10].content.includes(A));
  // depois de gravar o arquivo, a leitura anterior fica marcada como desatualizada
  const after = [...msgs, { role: 'assistant', content: 'x' }, res([{ tool: 'github.edit_files', ok: true, result: { commit: 'c' }, paths: ['b.ts'] }])];
  assert.match(compact(after)[4].content, /desatualizado/);
  // orçamento: com 413 (nível 2) arquivos antigos que não cabem são cortados, o último continua inteiro
  const big = [{ role: 'user', content: 'p' }, { role: 'assistant', content: 'x' }, res([file('a.tsx', 'A'.repeat(20000))]), { role: 'assistant', content: 'x' }, res([file('b.ts', 'B'.repeat(20000))])];
  const o3 = compact(big, 2);
  assert.ok(o3[2].content.length < 2000 && /cortado para caber/.test(o3[2].content));
  assert.ok(o3[4].content.includes('B'.repeat(20000)));
});

test('CE2. o modelo continua vendo o arquivo depois de várias leituras e grava sem reler em loop', async () => {
  const router = fakeRouter([
    { tool_calls: [call('github.get_file', { path: PAGE, ref: BRANCH })] },
    { tool_calls: [call('github.get_file', { path: 'apps/body-coach/src/lib/firebaseClient.ts', ref: BRANCH })] },
    { tool_calls: [call('github.get_file', { path: CTX, ref: BRANCH })] },
    req => {
      assert.ok(userTexts(req).includes('Entrar como demo'), 'o fim do page.tsx (9 KB) segue no histórico na 4ª chamada');
      return { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'Remove demo', edits: [{ path: PAGE, find: '<button>Entrar como demo</button>\n', replace: '' }, { path: CTX, find: "  if (u === 'admin' && p === 'admin01') return demo();\n", replace: '' }] })] };
    },
    { text: 'Pronto: removi o modo demo (commit abc).' },
  ]);
  const gw = fakeGateway();
  const r = await run(router, gw);
  assert.strictEqual(r.status, 'done');
  assert.ok(!gw.state[PAGE].includes('Entrar como demo') && !gw.state[CTX].includes('admin01'));
  const antes = gw.calls.slice(0, gw.calls.findIndex(c => c.tool === 'github.edit_files'));
  assert.strictEqual(antes.filter(c => c.tool === 'github.get_file' && c.input.path === PAGE).length, 1, 'leu uma vez só');
});

test('CE11. depois de editar, o modelo recebe o arquivo atual; acertos zeram as falhas da ferramenta', async () => {
  const miss = { branch: BRANCH, message: 'm', edits: [{ path: PAGE, find: 'TEXTO QUE NAO EXISTE', replace: 'x' }] };
  const router = fakeRouter([
    { tool_calls: [call('github.edit_files', miss)] },
    { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'm', edits: [{ path: PAGE, find: '<button>Entrar como demo</button>\n', replace: '' }] })] },
    req => {
      const t = userTexts(req);
      assert.ok(t.includes('Copie os próximos'), 'arquivo atual veio junto do resultado da edição');
      return { tool_calls: [call('github.edit_files', miss)] };
    },
    { tool_calls: [call('github.edit_files', miss)] },
    { text: 'Pronto.' },
  ]);
  const gw = fakeGateway();
  const r = await run(router, gw);
  assert.strictEqual(r.status, 'done', 'falha, acerto, falha, falha não encerra o agente');
  assert.ok(!gw.state[PAGE].includes('Entrar como demo'));
  assert.ok(gw.calls.some(c => c.tool === 'github.get_file' && c.input.ref === BRANCH && c.input.path === PAGE));
});

test('CE3. lembretes: até 2, com exemplo concreto de edit_files e a branch; depois disso termina', async () => {
  const router = fakeRouter([{ text: 'Vou fazer.' }, { text: 'Ok.' },
    { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'm', edits: [{ path: CTX, find: 'return signIn(u, p);', replace: 'return signIn(u.trim(), p);' }] })] },
    { text: 'feito' }]);
  const gw = fakeGateway();
  const r = await run(router, gw);
  assert.strictEqual(r.status, 'done');
  assert.match(gw.state[CTX], /u\.trim\(\)/, 'gravou depois do 2º lembrete (antes: desistia no 1º)');
  const nudge = router.seen[1].messages.at(-1).content;
  assert.ok(nudge.includes(`"branch":"${BRANCH}"`) && nudge.includes('"edits"') && nudge.includes('<<<<<<< SEARCH'));
  assert.match(router.seen[2].messages.at(-1).content, /Última chance/);

  const lazy = fakeRouter([{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'nunca chamado' }]);
  const r2 = await run(lazy, fakeGateway());
  assert.deepStrictEqual([r2.status, lazy.seen.length], ['done', 3], '3 respostas em texto: 2 lembretes e fim (o orquestrador acusa NO_CHANGES)');
  const cut = fakeRouter([{ text: '', stop_reason: 'length' }]);
  await run(cut, fakeGateway());
  assert.match(cut.seen[1].messages.at(-1).content, /cortada pelo limite de tokens/);
});

test('CE4. plano B: blocos SEARCH/REPLACE no texto viram github.edit_files na branch nexia/, pelo gateway', async () => {
  const text = `Segue a mudança.\n\nARQUIVO: ${PAGE}\n\`\`\`tsx\n<<<<<<< SEARCH\n<p>Use admin / admin01 para a demo</p>\n<button>Entrar como demo</button>\n=======\n<button type="button" onClick={forgot}>Esqueci minha senha</button>\n>>>>>>> REPLACE\n\`\`\`\n\nARQUIVO: ${CTX}\n<<<<<<< SEARCH\n  if (u === 'admin' && p === 'admin01') return demo();\n=======\n>>>>>>> REPLACE\n`;
  const router = fakeRouter([{ text }, { text: `Pronto.\n${text}` }]);
  const gw = fakeGateway();
  const r = await run(router, gw);
  assert.strictEqual(r.status, 'done');
  const edits = gw.calls.filter(c => c.tool === 'github.edit_files');
  assert.strictEqual(edits.length, 1, 'o resumo que repete os blocos não reaplica');
  assert.strictEqual(edits[0].input.branch, BRANCH);
  assert.strictEqual(edits[0].input.edits.length, 2);
  assert.match(gw.state[PAGE], /Esqueci minha senha/);
  assert.ok(!gw.state[PAGE].includes('admin01') && !gw.state[CTX].includes('admin01'));
  assert.match(router.seen[1].messages.at(-1).content, /RESULTADO DAS FERRAMENTAS/, 'o resultado volta ao modelo');

  // sem branch nexia/ não há plano B (nunca grava na padrão); quem não grava (Reviewer) também não
  const gw2 = fakeGateway();
  await runAgent({ agentId: 'frontend', goal: 'Pedido: x\nBranch de trabalho: develop', router: fakeRouter([{ text }, { text }, { text }]), gateway: gw2, ctx: {}, projectId: 'p', meter: meter() });
  assert.strictEqual(gw2.calls.length, 0);
  const gw3 = fakeGateway();
  await runAgent({ agentId: 'reviewer', goal, router: fakeRouter([{ text }]), gateway: gw3, ctx: {}, projectId: 'p', meter: meter() });
  assert.strictEqual(gw3.calls.length, 0);
});

test('CE5. JSON inválido e entrada recusada pelo schema voltam ao modelo com o motivo (antes: sumiam sem registro)', async () => {
  const router = fakeRouter([
    { tool_calls: [{ id: 'x', name: 'github__edit_files', input: { _raw: '{"branch":"nexia/x","edits":[{"path":"a","find":"b' } }], stop_reason: 'length' },
    { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'm', changes: [] })] },
    { tool_calls: [{ id: 'y', name: 'github__edit_files', input: { _raw: `\`\`\`json\n{"branch":"${BRANCH}","message":"m","edits":[{"path":"${CTX}","find":"return signIn(u, p);","replace":"return signIn(u, p); // ok"},]}\n\`\`\`` } }] },
    { text: 'feito' }]);
  const gw = fakeGateway();
  const r = await run(router, gw);
  assert.strictEqual(r.status, 'done');
  const first = router.seen[1].messages.at(-1).content;
  assert.match(first, /INVALID_JSON/);
  assert.match(first, /cortada pelo limite de tokens/);
  assert.match(first, /<<<<<<< SEARCH/, 'ensina o formato de texto');
  assert.strictEqual(gw.calls.filter(c => c.tool === 'github.edit_files').length, 2, 'o JSON cortado nem chega ao gateway; o reparável chega');
  assert.match(router.seen[2].messages.at(-1).content, /\$\.edits: obrigatório/, 'detalhe do schema volta ao modelo');
  assert.match(gw.state[CTX], /\/\/ ok/, 'JSON com cerca e vírgula sobrando é reparado');

  const fail = fakeRouter([{ text: 'a' }, { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'm', edits: [{ path: CTX, find: 'não existe', replace: 'x' }] })] }, { text: 'b' }, { text: 'Desisto.' }]);
  const r2 = await run(fail, fakeGateway());
  assert.match(r2.text, /nada gravado; recusas: github\.edit_files: INVALID_INPUT/, 'o resumo do passo diz por que nada foi gravado');
});

test('CE6. arquivos citados são pré-carregados pelo gateway antes do 1º turno', async () => {
  const router = fakeRouter([req => {
    assert.ok(userTexts(req).includes('Entrar como demo') && userTexts(req).includes('admin01'), 'os dois arquivos já estão no histórico');
    return { tool_calls: [call('github.edit_files', { branch: BRANCH, message: 'm', edits: [{ path: CTX, find: "  if (u === 'admin' && p === 'admin01') return demo();", replace: '' }] })] };
  }, { text: 'ok' }]);
  const gw = fakeGateway();
  await run(router, gw, { preload: [PAGE, CTX, 'nao/existe.ts'], ref: BRANCH, branch: BRANCH });
  assert.deepStrictEqual(gw.calls.slice(0, 3).map(c => [c.tool, c.input.path, c.input.ref]), [['github.get_file', PAGE, BRANCH], ['github.get_file', CTX, BRANCH], ['github.get_file', 'nao/existe.ts', BRANCH]]);
  assert.ok(!gw.state[CTX].includes('admin01'));
});

test('CE7. parseEditBlocks: SEARCH/REPLACE com e sem cerca, arquivo novo inteiro, sem caminho e "..." recusados', () => {
  const t = [
    `**ARQUIVO:** \`${PAGE}\``, '```tsx', '<<<<<<< SEARCH', 'a', '=======', 'b', '>>>>>>> REPLACE', '<<<<<<< SEARCH', 'c', '=======', '>>>>>>> REPLACE', '```',
    '', `ARQUIVO: ${CTX}`, '<<<<<<< SEARCH', 'x', '=======', 'y', '>>>>>>> REPLACE',
    '', 'ARQUIVO: apps/body-coach/src/lib/novo.ts', '```ts', 'export const a = 1;', '```',
    '', 'Exemplo solto:', '```js', 'console.log(1)', '```',
    '', 'ARQUIVO: apps/x/resto.ts', '```ts', 'import a;', '// ... resto igual', '```',
    '', 'ARQUIVO: ../fora.ts', '<<<<<<< SEARCH', 'q', '=======', 'w', '>>>>>>> REPLACE',
  ].join('\n');
  const r = parseEditBlocks(t);
  assert.deepStrictEqual(r.edits.map(e => [e.path, e.find, e.replace]), [[PAGE, 'a', 'b'], [PAGE, 'c', ''], [CTX, 'x', 'y']], 'bloco depois de caminho com ".." não vira edição (nem herda o arquivo anterior)');
  assert.ok(r.problems.some(p => /caminho recusado: \.\.\/fora\.ts/.test(p)));
  assert.deepStrictEqual(r.files, [{ path: 'apps/body-coach/src/lib/novo.ts', content: 'export const a = 1;\n' }]);
  assert.ok(r.problems.some(p => /apps\/x\/resto\.ts.*"\.\.\."/.test(p)));
  assert.deepStrictEqual(parseEditBlocks('Só texto, sem blocos.\n```js\nx()\n```'), { edits: [], files: [], problems: [] });
});

test('CE8. filesIn: caminhos do pedido primeiro, depois a linha ARQUIVOS do Architect', () => {
  const msg = `Em ${PAGE} remova o demo e em ${CTX} remova o atalho admin.`;
  const analysis = 'Mudança mínima no login.\nARQUIVOS: `apps/body-coach/src/lib/firebaseClient.ts`, ' + PAGE;
  assert.deepStrictEqual(filesIn(msg, analysis), [PAGE, CTX, 'apps/body-coach/src/lib/firebaseClient.ts']);
  assert.deepStrictEqual(filesIn('Mude a cor do botão', 'Mudar src/app.html.'), ['src/app.html']);
  assert.deepStrictEqual(filesIn('/etc/passwd e ../x/y.js'), []);
});

test('CE9. edit_files no adapter: trecho que só difere em espaços é aceito se for único; ambíguo continua recusado', async () => {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' }, env: gh.env, fetchImpl: gh.fetchImpl });
  await a.createBranch({ branch: 'nexia/ce9' });
  await a.commitFiles({ branch: 'nexia/ce9', message: 'base', files: [{ path: 'src/login.tsx', content: 'function A() {\n    return  <p>demo</p>;\n}\nconst x = 1;\nconst x = 1;\n' }] });
  await a.editFiles({ branch: 'nexia/ce9', message: 'tira demo', edits: [{ path: 'src/login.tsx', find: 'return <p>demo</p>;', replace: 'return null;' }] });
  assert.strictEqual(gh.fileAt('nexia/ce9', 'src/login.tsx'), 'function A() {\n    return null;\n}\nconst x = 1;\nconst x = 1;\n');
  await assert.rejects(a.editFiles({ branch: 'nexia/ce9', message: 'm', edits: [{ path: 'src/login.tsx', find: 'const  x = 1;', replace: '' }] }), e => e.code === 'INVALID_INPUT');
  await assert.rejects(a.editFiles({ branch: 'nexia/ce9', message: 'm', edits: [{ path: 'src/login.tsx', find: 'nada disso', replace: '' }] }), /0 vez/);
  assert.deepStrictEqual(looseFind('a\r\n  b', 'a b'), { start: 0, end: 6 });
});

test('CE10. prompts: quem grava aprende o formato de texto; o Architect termina com ARQUIVOS', () => {
  for (const a of ['coder', 'frontend', 'backend', 'database']) assert.ok(AGENTS[a].prompt.includes('<<<<<<< SEARCH') && AGENTS[a].max_steps >= 16, a);
  for (const a of ['reviewer', 'security', 'architect']) assert.ok(!AGENTS[a].prompt.includes('<<<<<<< SEARCH'), a);
  assert.match(AGENTS.architect.prompt, /ARQUIVOS:/);
});
