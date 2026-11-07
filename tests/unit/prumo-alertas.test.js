'use strict';
// Kernex Finance, fase 14: alertas com liga/desliga por tipo.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const a = require('../../netlify/functions/prumo-lib/alertas');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora, enviarEmail: p.deps.enviarEmail };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); if (!antes.enviarEmail) delete p.deps.enviarEmail; }
}
async function preparar() {
  await p.agir('u1', { acao: 'cartao_salvar', nome: 'Roxo', dia_fechamento: 1, dia_vencimento: 6 });
  await p.agir('u1', { acao: 'pontos_salvar', programa: 'Smiles', saldo: 5000, validade: '2026-11-20' });
}

test('KA1. alerta ligado aparece; alerta desligado NÃO dispara', async () => {
  await comBanco(async () => {
    await preparar();
    let r = (await p.agir('u1', { acao: 'alertas_listar' }))[1];
    assert.ok(r.alertas.some((x) => x.tipo === 'conta_vencer' && /Roxo.*amanhã/.test(x.texto)));
    assert.ok(r.alertas.some((x) => x.tipo === 'milhas_vencer'));
    await p.agir('u1', { acao: 'alertas_salvar', tipos: { conta_vencer: false } });
    r = (await p.agir('u1', { acao: 'alertas_listar' }))[1];
    assert.ok(!r.alertas.some((x) => x.tipo === 'conta_vencer')); // desligado não dispara
    assert.ok(r.alertas.some((x) => x.tipo === 'milhas_vencer')); // os outros continuam
    await p.agir('u1', { acao: 'alertas_salvar', tipos: { milhas_vencer: false } });
    assert.equal((await p.agir('u1', { acao: 'alertas_listar' }))[1].alertas.length, 0);
  });
});

test('KA2. orçamento a 80% e cobrança repetida geram alerta', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'limite_salvar', categoria: 'alimentacao', limite: 1000 });
    await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-02', descricao: 'Mercado', valor: 850, tipo: 'despesa', categoria: 'alimentacao' }, { data: '2026-11-03', descricao: 'Loja X', valor: 80, tipo: 'despesa', categoria: 'compras' }, { data: '2026-11-03', descricao: 'Loja X', valor: 80, tipo: 'despesa', categoria: 'compras', forcar: true }] });
    const r = (await p.agir('u1', { acao: 'alertas_listar' }))[1];
    assert.ok(r.alertas.some((x) => x.tipo === 'orcamento_80' && /85%/.test(x.texto)));
    assert.ok(r.alertas.some((x) => x.tipo === 'cobranca_suspeita'));
  });
});

test('KA3. WhatsApp: precisa de consentimento e número; o número proibido é recusado', async () => {
  await comBanco(async () => {
    assert.equal((await p.agir('u1', { acao: 'alertas_salvar', whatsapp: { consentimento: true, numero: '+55 (11) 99999-4185' } }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'alertas_salvar', whatsapp: { consentimento: true, numero: '' } }))[0], 400);
    const ok = await p.agir('u1', { acao: 'alertas_salvar', whatsapp: { consentimento: true, numero: '5521988887777' } });
    assert.equal(ok[0], 200);
    const sem = (await p.agir('u1', { acao: 'alertas_salvar', whatsapp: { consentimento: false } }))[1];
    assert.equal(sem.config.whatsapp.numero, null);
  });
});

test('KA4. e-mail: só liga com endereço; só envia alertas ligados e só para o endereço da pessoa; sem alerta não envia', async () => {
  await comBanco(async () => {
    const enviados = []; p.deps.enviarEmail = async (m) => { enviados.push(m); return { ok: true }; };
    assert.equal((await p.agir('u1', { acao: 'alertas_salvar', canais: { email: true } }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'alertas_enviar_email' }))[0], 400); // desligado
    assert.equal((await p.agir('u1', { acao: 'alertas_salvar', canais: { email: true }, email_para: 'Pessoa@Exemplo.com' }))[0], 200);
    assert.equal((await p.agir('u1', { acao: 'alertas_enviar_email' }))[1].enviados, 0);
    assert.equal(enviados.length, 0);
    await preparar();
    await p.agir('u1', { acao: 'alertas_salvar', tipos: { milhas_vencer: false } });
    const r = (await p.agir('u1', { acao: 'alertas_enviar_email' }))[1];
    assert.equal(r.enviados, 1);
    assert.equal(enviados[0].to, 'pessoa@exemplo.com');
    assert.ok(!/Smiles/.test(enviados[0].texto)); // milhas desligado não sai no e-mail
  });
});

test('KA5. tipos padrão: todos ligados, e-mail e WhatsApp desligados', () => {
  const c = a.mesclar(null);
  assert.ok(Object.values(c.tipos).every(Boolean));
  assert.equal(c.canais.email, false);
  assert.equal(c.whatsapp.consentimento, false);
});
