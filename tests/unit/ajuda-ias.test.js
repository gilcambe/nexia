import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- funcoes puras (definidas aqui, sem depender de arquivo externo) ---

function contarComentariosRevisor(comentarios, desde) {
  const limite = desde ? new Date(desde).getTime() : 0;
  let aprovados = 0;
  let recusados = 0;
  for (const c of comentarios || []) {
    if (c.autor !== 'revisor') continue;
    if (!c.estado) continue;
    const criadoEm = c.criadoEm ? new Date(c.criadoEm).getTime() : 0;
    if (criadoEm < limite) continue;
    const estado = String(c.estado).toLowerCase();
    if (estado === 'aprovado') aprovados += 1;
    else if (estado === 'recusado') recusados += 1;
  }
  return { aprovados, recusados };
}

function estadoInterruptor(issue) {
  if (!issue) return true;
  const estado = issue.estado;
  if (estado === null || estado === undefined) return true;
  const s = String(estado).toLowerCase().trim();
  if (s === 'closed' || s === 'fechada') return false;
  return true;
}

function filtrarIssuesPorLabel(issues, label) {
  const alvo = String(label).toLowerCase().trim();
  return (issues || []).filter((issue) => {
    const labels = issue.labels || [];
    return labels.some((l) => String(l.nome).toLowerCase() === alvo);
  });
}

async function transformarJSONFinal(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.mensagem || `Erro ${resposta.status}`);
  }
  const dados = await resposta.json();
  const revisao = contarComentariosRevisor(dados.comentarios, new Date('2026-01-01'));
  return {
    numero: dados.numero,
    estado: dados.estado,
    revisao,
    estadoInterruptor: estadoInterruptor(dados),
  };
}

// --- testes ---

test('contarComentariosRevisor retorna zeros quando nao ha comentarios', (t) => {
  const resultado = contarComentariosRevisor([], new Date('2026-01-01'));
  assert.deepStrictEqual(resultado, { aprovados: 0, recusados: 0 });
});

test('contarComentariosRevisor conta aprovados e recusados desde a data', (t) => {
  const comentarios = [
    { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-01T10:00:00Z' },
    { autor: 'revisor', estado: 'recusado', criadoEm: '2026-02-02T10:00:00Z' },
    { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-03T10:00:00Z' },
    { autor: 'outro', estado: 'aprovado', criadoEm: '2026-02-04T10:00:00Z' },
    { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-01-15T10:00:00Z' },
  ];
  const resultado = contarComentariosRevisor(comentarios, new Date('2026-02-01'));
  assert.deepStrictEqual(resultado, { aprovados: 2, recusados: 1 });
});

test('contarComentariosRevisor ignora comentarios sem estado', (t) => {
  const comentarios = [
    { autor: 'revisor', criadoEm: '2026-02-01T10:00:00Z' },
    { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-02T10:00:00Z' },
  ];
  const resultado = contarComentariosRevisor(comentarios, new Date('2026-02-01'));
  assert.deepStrictEqual(resultado, { aprovados: 1, recusados: 0 });
});

test('estadoInterruptor retorna true quando issue aberta', (t) => {
  assert.strictEqual(estadoInterruptor({ estado: 'open' }), true);
  assert.strictEqual(estadoInterruptor({ estado: 'aberto' }), true);
  assert.strictEqual(estadoInterruptor({ estado: 'OPEN' }), true);
});

test('estadoInterruptor retorna false quando issue fechada', (t) => {
  assert.strictEqual(estadoInterruptor({ estado: 'closed' }), false);
  assert.strictEqual(estadoInterruptor({ estado: 'fechada' }), false);
  assert.strictEqual(estadoInterruptor({ estado: 'CLOSED' }), false);
});

test('estadoInterruptor retorna true quando estado e null ou undefined', (t) => {
  assert.strictEqual(estadoInterruptor({ estado: null }), true);
  assert.strictEqual(estadoInterruptor({ estado: undefined }), true);
  assert.strictEqual(estadoInterruptor({}), true);
  assert.strictEqual(estadoInterruptor(null), true);
  assert.strictEqual(estadoInterruptor(undefined), true);
});

test('estadoInterruptor trata estados desconhecidos como abertos', (t) => {
  assert.strictEqual(estadoInterruptor({ estado: 'pendente' }), true);
  assert.strictEqual(estadoInterruptor({ estado: '' }), true);
});

test('filtrarIssuesPorLabel retorna count zero quando nao tem label', (t) => {
  const issues = [
    { numero: 1, labels: [] },
    { numero: 2, labels: [] },
  ];
  assert.strictEqual(filtrarIssuesPorLabel(issues, 'bug').length, 0);
});

test('filtrarIssuesPorLabel filtra issues por label existente', (t) => {
  const issues = [
    { numero: 1, labels: [{ nome: 'bug' }] },
    { numero: 2, labels: [{ nome: 'melhoria' }] },
    { numero: 3, labels: [{ nome: 'bug' }, { nome: 'urgente' }] },
  ];
  const resultado = filtrarIssuesPorLabel(issues, 'bug');
  assert.deepStrictEqual(resultado, [issues[0], issues[2]]);
});

test('filtrarIssuesPorLabel filtra labels case-insensitive', (t) => {
  const issues = [
    { numero: 1, labels: [{ nome: 'Bug' }] },
    { numero: 2, labels: [{ nome: 'BUG' }] },
  ];
  assert.strictEqual(filtrarIssuesPorLabel(issues, 'bug').length, 2);
});

test('filtrarIssuesPorLabel retorna array vazio quando nao ha correspondencia', (t) => {
  const issues = [{ numero: 1, labels: [{ nome: 'bug' }] }];
  assert.deepStrictEqual(filtrarIssuesPorLabel(issues, 'nao-existe'), []);
});

test('transformarJSONFinal transforma resposta da API GitHub em JSON final', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      numero: 42,
      estado: 'open',
      comentarios: [
        { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-01T10:00:00Z' },
        { autor: 'revisor', estado: 'recusado', criadoEm: '2026-02-02T10:00:00Z' },
      ],
    }),
  }));

  const resultado = await transformarJSONFinal('https://api.github.com/repos/org/repo/issues/42');

  assert.deepStrictEqual(resultado.revisao, { aprovados: 1, recusados: 1 });
  assert.strictEqual(resultado.estadoInterruptor, true);
  assert.strictEqual(resultado.numero, 42);
  assert.strictEqual(resultado.estado, 'open');
});

test('transformarJSONFinal trata erro da API GitHub', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 404,
    json: async () => ({ mensagem: 'Nao encontrado' }),
  }));

  await assert.rejects(
    () => transformarJSONFinal('https://api.github.com/repos/org/repo/issues/999'),
    /Nao encontrado/
  );
});
