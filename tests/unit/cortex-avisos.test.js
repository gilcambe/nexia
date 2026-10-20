'use strict';
// #833 (Melhoria C15): aviso de conclusão e resumo diário (push no app e e-mail grátis).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const av = require('../../netlify/functions/central/cortex-avisos');

function bancoFalso(inicial = {}) {
  const docs = { 'cortex_push/dono': inicial };
  return { docs, collection: (c) => ({ doc: (d) => ({
    get: async () => ({ data: () => docs[`${c}/${d}`] }),
    set: async (v, o) => { docs[`${c}/${d}`] = o && o.merge ? { ...(docs[`${c}/${d}`] || {}), ...v } : v; },
  }) }) };
}

test('C15a. uma linha por evento: feito e travado', () => {
  assert.deepEqual(av.linhaEvento('feito', 9, '[Parte 1/2 de #8] Tela X').corpo, '#9 Tela X');
  const t = av.linhaEvento('travado', 9, 'Tela X');
  assert.match(t.titulo, /travou/);
  assert.equal(t.urgente, true);
});

test('C15b. push vai para os aparelhos assinados e tira os descartados (404/410)', async () => {
  const db = bancoFalso({ subs: [{ endpoint: 'https://a' }, { endpoint: 'https://b' }] });
  const enviados = [];
  const n = await av.avisarPush(db, { titulo: 'x', corpo: 'y' }, async (_db, s, msg) => { enviados.push([s.endpoint, msg.url]); return s.endpoint === 'https://a' ? 201 : 410; });
  assert.equal(n, 1);
  assert.deepEqual(enviados[0], ['https://a', '/cortex']);
  assert.deepEqual(db.docs['cortex_push/dono'].subs, [{ endpoint: 'https://a' }]);
  assert.equal(await av.avisarPush(bancoFalso({}), { titulo: 'x' }, async () => 201), 0, 'sem aparelho, nada');
});

test('C15c. e-mail só com BREVO_API_KEY e destinatário; resumo às 8h de Brasília, uma vez por dia', async () => {
  assert.equal(await av.avisarEmail('a', 'b', {}, async () => ({ ok: true })), false);
  let corpo = null;
  assert.equal(await av.avisarEmail('a', 'b', { BREVO_API_KEY: 'k', LEADS_NOTIFY_EMAIL: 'x@y.z' }, async (_u, o) => { corpo = JSON.parse(o.body); return { ok: true }; }), true);
  assert.equal(corpo.to[0].email, 'x@y.z');
  const oito = Date.parse('2026-10-20T11:05:00Z');   // 8h05 em Brasília
  assert.deepEqual(av.horaDoResumo(oito, '2026-10-19'), { mandar: true, dia: '2026-10-20' });
  assert.equal(av.horaDoResumo(oito, '2026-10-20').mandar, false);
  assert.equal(av.horaDoResumo(Date.parse('2026-10-20T13:00:00Z'), '').mandar, false);
  assert.match(av.textoResumo({ feitas: [{ number: 1 }], travadas: [], naFila: 3 }), /1 feita\(s\) \(#1\)\. Travadas: 0\. Na fila: 3\./);
});

test('C15d. assinatura só com endpoint https e chaves válidas', async () => {
  const db = bancoFalso({});
  assert.equal((await av.acoesAvisos({ acao: 'avisos_assinar', sub: { endpoint: 'http://x', keys: {} } }, db))[0], 400);
  assert.equal(await av.acoesAvisos({ acao: 'outra' }, db), null);
});

test('C15e. fila avisa em feito/travado e manda o resumo; o app tem o botão e o service worker mostra o aviso', () => {
  const R = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
  const fila = R('scripts/cortex-fila.js');
  assert.match(fila, /avisarDono\('feito'/);
  assert.match(fila, /avisarDono\('travado'/);
  assert.match(fila, /await resumoDiario\(token, issues\)/);
  assert.match(R('netlify/functions/pedidos.js'), /acoesAvisos/);
  assert.match(R('public/cortex-sw.js'), /addEventListener\("push"/);
  assert.match(R('src/pages/cortex/Paineis.tsx'), /<AvisosCelular \/>/);
});
