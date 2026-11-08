'use strict';
// Kernex Finance, fase 15: aba Ajuda, LGPD (exportar/apagar só os MEUS dados) e limite de leituras por plano.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

function bancoFalso() {
  const dados = new Map();
  const doc = (c, id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) }; } });
  const col = (c) => ({ doc: (id) => doc(c, id), get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-08T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}

test('AJ1. mensagem de ajuda é guardada e listada; pessoa passa a existir para o admin', async () => {
  await comBanco(async (b) => {
    assert.equal((await p.agir('u1', { acao: 'ajuda_enviar', texto: 'Não leu minha fatura' }))[0], 200);
    const [, r] = await p.agir('u1', { acao: 'ajuda_listar' });
    assert.equal(r.mensagens.length, 1);
    assert.equal(r.mensagens[0].status, 'aberta');
    assert.ok(b.dados.has('prumo_users/u1'));
  });
});

test('AJ2. exportar traz só os dados da própria pessoa; apagar exige APAGAR e apaga tudo dela', async () => {
  await comBanco(async (b) => {
    await p.agir('u1', { acao: 'cartao_salvar', nome: 'Roxo', dia_fechamento: 1, dia_vencimento: 6 });
    await p.agir('u2', { acao: 'cartao_salvar', nome: 'Azul', dia_fechamento: 1, dia_vencimento: 6 });
    const [, ex] = await p.agir('u1', { acao: 'meus_dados_exportar' });
    assert.match(JSON.stringify(ex), /Roxo/);
    assert.doesNotMatch(JSON.stringify(ex), /Azul/);
    assert.equal((await p.agir('u1', { acao: 'meus_dados_apagar' }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'meus_dados_apagar', confirmacao: 'APAGAR' }))[0], 200);
    assert.ok(![...b.dados.keys()].some((k) => k.startsWith('prumo_users/u1/cartoes/')));
    assert.ok([...b.dados.keys()].some((k) => k.startsWith('prumo_users/u2/cartoes/')));
  });
});

test('AJ3. autorizar suporte tem prazo e fica na auditoria', async () => {
  await comBanco(async (b) => {
    const [st, r] = await p.agir('u1', { acao: 'suporte_autorizar', horas: 24 });
    assert.equal(st, 200);
    assert.equal(r.suporte_ate, '2026-11-09T12:00:00.000Z');
    assert.ok([...b.dados.keys()].some((k) => k.startsWith('prumo_users/u1/auditoria/')));
    assert.equal((await p.agir('u1', { acao: 'suporte_autorizar', horas: 999 }))[0], 400);
  });
});

test('AJ4. limite de leituras do plano: passou do limite, recusa com mensagem clara', async () => {
  const aj = require('../../netlify/functions/prumo-lib/ajuda');
  await comBanco(async (b) => {
    const base = b.collection('prumo_users').doc('u1');
    await base.set({ plano: 'gratis' });
    await base.collection('config').doc('uso').set({ mes: '2026-11', leituras: aj.PLANOS.gratis });
    const [st, r] = await p.agir('u1', { acao: 'doc_ler', imagens: ['data:image/jpeg;base64,AAAA'] });
    assert.equal(st, 429);
    assert.match(r.error, /leituras do plano gratis/);
    const [, pl] = await p.agir('u1', { acao: 'meu_plano' });
    assert.equal(pl.usadas, aj.PLANOS.gratis);
  });
});

test('AJ5. aba Ajuda aparece no app e fica guardada para uso sem internet', () => {
  const fs = require('fs'); const path = require('path');
  const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
  assert.match(ler('index.html'), /data-aba="ajuda"/);
  assert.match(ler('app.js'), /'ajuda'\]/);
  assert.match(ler('sw.js'), /\/prumo\/ajuda\.js/);
  assert.match(ler('ajuda.js'), /api\/prumo-admin/);
});
