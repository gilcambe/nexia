'use strict';
// Contrato: Kernex Finance — robôs de investimento, parte 3 de 3: conferir SOZINHO no pregão e avisar por e-mail.
// Pedido, em netlify/functions/prumo-lib/robos.js:
//  - exporte checarTodos(db, agoraIso, deps = {}):
//      * fora do pregão (use emPregao(new Date(agoraIso)) de ./cotacoes: seg-sex, 10h-18h de Brasília) devolve
//        { pulou: 'fora do pregão' } sem ler nada;
//      * senão, para cada pessoa em db.collection('prumo_users') que tenha ao menos 1 robô em 'robos': faz a MESMA
//        conferência de robos_checar (separe numa função checarPessoa(base, deps, agoraIso) usada pelos dois: carteira ->
//        require('./cotacoes').carteiraAoVivo(itens, { fetch, agora, env }) -> meta de config/alocacao -> avaliarRegras ->
//        grava ultimo_disparo e robos_disparos);
//      * se houve disparo e a pessoa ligou o e-mail na aba Alertas (config/alertas: canais.email === true e email_para),
//        manda UM e-mail com todos os disparos dela usando require('./alertas').enviarEmail(deps, { to, assunto, texto })
//        (exporte enviarEmail em alertas.js); assunto "Kernex Finance: N robô(s) dispararam"; texto com uma linha
//        "• <texto do disparo>" por disparo e, no fim, "Quem compra ou vende é você. Você controla os robôs no app, aba Robôs.";
//      * devolve { pessoas, disparos, enviados, falhas } (pessoas = quantas tinham robô; disparos = total).
//  - quem não tem robô não é lido além da lista de robôs; um erro numa pessoa não para as outras (conta em falhas).
// E crie scripts/kf-robos-pregao.js (igual a scripts/kf-alertas-email-diario.js): pega o db de firebase-init, chama
// checarTodos(db, new Date().toISOString()) e imprime o resultado em JSON; sai com código 1 se db não existir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cot = require('../../netlify/functions/prumo-lib/cotacoes');

function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => {
      const ids = new Set();
      for (const k of dados.keys()) if (k.startsWith(caminho + '/')) ids.add(k.slice(caminho.length + 1).split('/')[0]);
      return { docs: [...ids].map((id) => ({ id, data: () => dados.get(`${caminho}/${id}`) || {} })) };
    },
  });
  return { collection: col, dados };
}
const PREGAO = '2026-11-17T15:00:00.000Z'; // terça 12h Brasília
const NOITE = '2026-11-17T23:30:00.000Z'; // 20h30 Brasília

function cenario() {
  const db = bancoFalso(); const d = db.dados;
  d.set('prumo_users/ana/carteira/c1', { nome: 'Petrobras', tipo: 'acoes', ticker: 'PETR4', valor: 300 });
  d.set('prumo_users/ana/robos/r1', { tipo: 'preco_abaixo', ticker: 'PETR4', valor: 35 });
  d.set('prumo_users/ana/robos/r2', { tipo: 'queda_dia', ticker: 'PETR4', pct: 3 });
  d.set('prumo_users/ana/config/alertas', { canais: { app: true, email: true }, email_para: 'ana@exemplo.com', tipos: {} });
  d.set('prumo_users/bia/carteira/c1', { nome: 'Petrobras', tipo: 'acoes', ticker: 'PETR4', valor: 300 });
  d.set('prumo_users/bia/robos/r1', { tipo: 'preco_abaixo', ticker: 'PETR4', valor: 35 });
  d.set('prumo_users/caio/carteira/c1', { nome: 'CDB', tipo: 'renda_fixa', valor: 1000 });
  return db;
}
function stub() {
  const chamadas = [];
  cot.carteiraAoVivo = async (itens, op) => { chamadas.push(itens.length); if (!op || typeof op.fetch !== 'function') throw new Error('sem deps.fetch, passe o fetch global ((...a) => fetch(...a))');
    // 2ª entrega (#3895): "const fetch = (deps && deps.fetch) || ((...a) => fetch(...a))" chama a SI MESMA (o fetch de
    // dentro é a constante nova), e no servidor trava. Aqui o fetch passado é CHAMADO e tem que chegar ao fetch global.
    const antes = globalThis.fetch; let chegou = false;
    globalThis.fetch = async () => { chegou = true; return { ok: true, json: async () => ({}) }; };
    try { await Promise.race([op.fetch('https://exemplo.invalid/'), new Promise((_, n) => setTimeout(() => n(new Error('fetch não respondeu')), 500))]); } catch (e) { throw new Error('o fetch passado falhou: ' + e.message + ' (não dê o nome "fetch" à constante; use globalThis.fetch)'); } finally { globalThis.fetch = antes; }
    if (!chegou) throw new Error('o fetch passado não chamou o fetch global'); return { itens: [{ id: 'c1', ticker: 'PETR4', vivo: { preco: 30, variacao_dia_pct: -5, valor: 300 }, proventos: null }], total: 300, por_tipo: { acoes: 300 }, assessor: {} }; };
  return chamadas;
}

test('fora do pregão não faz nada', async () => {
  const { checarTodos } = require('../../netlify/functions/prumo-lib/robos');
  const chamadas = stub();
  const r = await checarTodos(cenario(), NOITE, { enviarEmail: async () => ({ ok: true }) });
  assert.deepEqual(r, { pulou: 'fora do pregão' });
  assert.equal(chamadas.length, 0);
  const sabado = await checarTodos(cenario(), '2026-11-21T15:00:00.000Z', {});
  assert.deepEqual(sabado, { pulou: 'fora do pregão' });
});

test('no pregão: confere quem tem robô, grava o dia e manda UM e-mail para quem ligou o e-mail', async () => {
  const { checarTodos } = require('../../netlify/functions/prumo-lib/robos');
  const chamadas = stub(); const db = cenario(); const emails = [];
  const r = await checarTodos(db, PREGAO, { enviarEmail: async (m) => { emails.push(m); return { ok: true }; } });
  assert.equal(r.pessoas, 2, 'ana e bia têm robô; caio não');
  assert.equal(chamadas.length, 2, 'cotação só para quem tem robô');
  assert.equal(r.disparos, 3, 'ana: preço e queda; bia: preço');
  assert.equal(r.enviados, 1, 'só a ana ligou o e-mail');
  assert.equal(r.falhas, 0);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'ana@exemplo.com');
  assert.equal(emails[0].assunto, 'Kernex Finance: 2 robô(s) dispararam');
  assert.equal((emails[0].texto.match(/^• /gm) || []).length, 2);
  assert.match(emails[0].texto, /Quem compra ou vende é você/);
  assert.equal(db.dados.get('prumo_users/ana/robos/r1').ultimo_disparo, '2026-11-17');
  assert.equal(db.dados.get('prumo_users/bia/robos/r1').ultimo_disparo, '2026-11-17');
  const de2 = await checarTodos(db, '2026-11-17T16:00:00.000Z', { enviarEmail: async (m) => { emails.push(m); return { ok: true }; } });
  assert.equal(de2.disparos, 0, 'na hora seguinte do mesmo dia não repete');
  assert.equal(emails.length, 1, 'nem manda e-mail de novo');
});

test('erro numa pessoa não para as outras; falha de e-mail conta em falhas', async () => {
  const { checarTodos } = require('../../netlify/functions/prumo-lib/robos');
  stub(); const db = cenario();
  const orig = cot.carteiraAoVivo; let n = 0;
  cot.carteiraAoVivo = async (...a) => { n++; if (n === 1) throw new Error('rede'); return orig(...a); };
  const r = await checarTodos(db, PREGAO, { enviarEmail: async () => ({ ok: false, motivo: 'x' }) });
  assert.equal(r.pessoas, 2);
  assert.ok(r.falhas >= 1);
  assert.ok(r.disparos >= 1, 'a outra pessoa foi conferida');
});

test('alertas.js exporta enviarEmail; script do pregão existe', () => {
  assert.equal(typeof require('../../netlify/functions/prumo-lib/alertas').enviarEmail, 'function');
  const s = fs.readFileSync(path.join(__dirname, '../../scripts/kf-robos-pregao.js'), 'utf8');
  assert.match(s, /checarTodos/);
  assert.match(s, /firebase-init/);
  assert.match(s, /process\.exit\(1\)|process\.exitCode\s*=\s*1/);
});
