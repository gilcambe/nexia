'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rodar, decidir } = require('../../cloudflare/jules-auto.js');

const AS_20 = Date.UTC(2026, 9, 24, 15, 31);
const env = { JULES_API_KEY: 'k', NEXIA_JOBS_TOKEN: 't' };

function falso(issues, prs = []) {
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    chamadas.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('jules.googleapis.com')) return ok({ id: 'S1' });
    if (/labels=cortex-travado/.test(url)) return ok(issues);
    if (/\/pulls\?/.test(url)) return ok(prs);
    const n = Number((/issues\/(\d+)$/.exec(url) || [])[1]);
    if (n) return ok(issues.find(i => i.number === n));
    return ok({});
  };
  return { fetchFn, chamadas };
}

test('JULES-AUTO1: manda as travadas ainda não enviadas (até 3 por batida, vigia 08/11)', async () => {
  const issues = [
    { number: 1, state: 'open', title: 'já foi', labels: [{ name: 'cortex-travado' }, { name: 'jules-enviado' }] },
    { number: 2, state: 'open', title: 'pai dividido', labels: [{ name: 'cortex-travado' }, { name: 'cortex-dividido' }] },
    { number: 3, state: 'open', title: 'travada', body: 'faça x', labels: [{ name: 'cortex-travado' }] },
    { number: 4, state: 'open', title: 'outra', labels: [{ name: 'cortex-travado' }] },
  ];
  const f = falso(issues);
  const r = await rodar(AS_20, { env, fetchFn: f.fetchFn });
  assert.deepStrictEqual(r.enviados.map(e => [e.issue, e.status]), [[3, 200], [4, 200]]);
  assert.strictEqual(f.chamadas.filter(c => c.url.includes('jules.googleapis.com')).length, 2);
  const rot = f.chamadas.find(c => c.url.endsWith('/issues/3/labels'));
  assert.match(rot.body, /jules-enviado/);
});

test('JULES-AUTO2: fora da batida, sem chave ou desligado não faz nada', async () => {
  const f = falso([{ number: 3, state: 'open', labels: [{ name: 'cortex-travado' }] }]);
  assert.ok((await rodar(Date.UTC(2026, 9, 24, 15, 7), { env, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { NEXIA_JOBS_TOKEN: 't' }, fetchFn: f.fetchFn })).skipped);
  assert.ok((await rodar(AS_20, { env: { ...env, JULES_AUTO: '0' }, fetchFn: f.fetchFn })).skipped);
  assert.strictEqual(f.chamadas.length, 0);
  const vazio = falso([]);
  assert.deepStrictEqual(await rodar(AS_20, { env, fetchFn: vazio.fetchFn }), { retomadas: [], reserva: [], humano: [], revolta: [], precisa: [], voltaPrecisa: [], ultimaChance: [], enviados: 0, semCotaJules: [] });
});

const L = (...n) => n.map(name => ({ name }));
const nomes = i => (i.labels || []).map(l => l.name);
const H = 36e5;

test('JULES-AUTO3: escada: Jules sem PR no tempo volta ao Cortex do zero; 2ª vez vai para humano; com PR espera', () => {
  const agora = Date.UTC(2026, 9, 25, 12, 0);
  const velho = new Date(agora - 3 * H).toISOString(), novo = new Date(agora - 0.5 * H).toISOString();
  const issues = [
    { number: 10, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 11, labels: L('cortex-travado', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 12, labels: L('cortex-travado', 'jules-enviado'), updated_at: novo },
    { number: 13, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 14, labels: L('cortex-travado', 'so-humano', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 15, labels: L('cortex-travado', 'jules-enviado'), updated_at: velho },
    { number: 16, labels: L('cortex-travado', 'vez-do-claude', 'jules-enviado', 'cortex-retomada'), updated_at: velho },
    { number: 17, labels: L('cortex-travado', 'jules-enviado', 'cortex-retomada', 'reserva-tentou'), updated_at: velho },
  ];
  // PR recusado pelo revisor grátis conta como "sem PR": a #15 sobe de degrau.
  const prs = [{ title: 'fix', body: 'Refs #13' }, { title: 'outro', body: 'Refs #130' }, { title: 'x', body: 'Fecha #15', labels: L('revisor-recusou') }];
  const d = decidir(issues, prs, agora, nomes);
  // #1958: 2ª volta sem PR → IAs conectadas (reserva); reserva também sem PR → Claude.
  assert.deepStrictEqual(d, { enviar: null, enviarLista: [], retomar: [10, 15], reserva: [11], humano: [17], revolta: [], precisa: [], ultimaChance: [], voltaPrecisa: [] });
});

test('JULES-AUTO4: retomada tira travado, jules-enviado e tentativas e põe cortex-retomada', async () => {
  const velho = new Date(AS_20 - 30 * H).toISOString();
  const f = falso([{ number: 20, state: 'open', updated_at: velho, labels: L('cortex-fila', 'cortex-travado', 'jules-enviado', 'tentativa-12', 'sem-entrega-1') }]);
  const r = await rodar(AS_20, { env, fetchFn: f.fetchFn });
  assert.deepStrictEqual(r.retomadas, [20]);
  const apagados = f.chamadas.filter(c => c.method === 'DELETE').map(c => decodeURIComponent(c.url.split('/labels/')[1])).sort();
  assert.deepStrictEqual(apagados, ['cortex-travado', 'jules-enviado', 'sem-entrega-1', 'tentativa-12']);
  assert.ok(f.chamadas.some(c => c.url.endsWith('/issues/20/labels') && /cortex-retomada/.test(c.body)));
  assert.strictEqual(f.chamadas.filter(c => c.url.includes('jules.googleapis.com')).length, 0);
});

test('JULES-AUTO-PLANO: travada vai antes da parte grande do plano (lição 08/11: planejadas deixavam travadas sem Jules)', () => {
  const nomes = i => i.labels.map(l => l.name);
  const issues = [
    { number: 5, labels: [{ name: 'cortex-travado' }] },
    { number: 9, labels: [{ name: 'cortex-fila' }, { name: 'cortex-parte' }, { name: 'cortex-jules' }] },
  ];
  const d = decidir(issues, [], Date.now(), nomes);
  assert.equal(d.enviar, 5);
  assert.deepStrictEqual(d.enviarLista, [5, 9]);
});

test('VIGIA1: no máximo 3 envios ao Jules por batida', () => {
  const nomes = i => i.labels.map(l => l.name);
  const issues = [1, 2, 3, 4, 5].map(number => ({ number, labels: [{ name: 'cortex-travado' }] }));
  assert.deepStrictEqual(decidir(issues, [], Date.now(), nomes).enviarLista, [1, 2, 3]);
});

test('VIGIA2: Claude desligado: vez-do-claude parada volta ao Cortex; workflow ou 2 voltas vai para "Precisa de você"', () => {
  const agora = Date.UTC(2026, 10, 8, 18, 0);
  const velho = new Date(agora - 30 * 6e4).toISOString(), novo = new Date(agora - 5 * 6e4).toISOString();
  const vez = [
    { number: 30, title: 'tela', labels: L('cortex-travado', 'vez-do-claude'), updated_at: velho },
    { number: 31, title: 'criar .github/workflows/x.yml', labels: L('cortex-travado', 'vez-do-claude'), updated_at: velho },
    { number: 32, title: 'outra', labels: L('cortex-travado', 'vez-do-claude', 'vigia-volta-1', 'vigia-volta-2'), updated_at: velho },
    { number: 33, title: 'recente', labels: L('cortex-travado', 'vez-do-claude'), updated_at: novo },
  ];
  const d = decidir([], [], agora, nomes, { claudeLigado: false, vezDoClaude: vez });
  assert.deepStrictEqual(d.revolta, [30]);
  assert.deepStrictEqual(d.precisa, [31, 32]);
  // Claude ligado: nada muda (degrau 3 continua com o Claude).
  const e = decidir([], [], agora, nomes, { claudeLigado: true, vezDoClaude: vez });
  assert.deepStrictEqual([e.revolta, e.precisa], [[], []]);
});

test('VIGIA3: humano da escada com Claude desligado volta ao Cortex em vez de vez-do-claude', () => {
  const agora = Date.UTC(2026, 10, 8, 18, 0);
  const velho = new Date(agora - 3 * H).toISOString();
  const issues = [{ number: 40, title: 't', labels: L('cortex-travado', 'jules-enviado', 'cortex-retomada', 'reserva-tentou'), updated_at: velho }];
  const d = decidir(issues, [], agora, nomes, { claudeLigado: false });
  assert.deepStrictEqual([d.humano, d.revolta], [[], [40]]);
});

test('VIGIA4: rodar com Claude desligado tira vez-do-claude e devolve à fila com vigia-volta-1', async () => {
  const velho = new Date(AS_20 - 2 * H).toISOString();
  const vez = [{ number: 50, state: 'open', title: 'x', updated_at: velho, labels: L('cortex-fila', 'cortex-travado', 'vez-do-claude', 'reserva-tentou', 'tentativa-12') }];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (/labels=vez-do-claude/.test(u)) return ok(vez);
    if (/issues\/2036$/.test(u)) return ok({ state: 'closed' });
    if (/issues\?|\/pulls\?/.test(u)) return ok([]);
    return ok({});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  assert.deepStrictEqual(r.revolta, [50]);
  const apagados = chamadas.filter(c => c.method === 'DELETE' && /issues\/50\//.test(c.url)).map(c => decodeURIComponent(c.url.split('/labels/')[1])).sort();
  assert.deepStrictEqual(apagados, ['cortex-travado', 'reserva-tentou', 'tentativa-12', 'vez-do-claude']);
  assert.ok(chamadas.some(c => c.url.endsWith('/issues/50/labels') && /vigia-volta-1/.test(c.body) && /cortex-retomada/.test(c.body)));
});

test('VIGIA5: Jules sem cota (429) → a tarefa vai na hora para o Cortex Reserva; workflow fica com o Jules', async () => {
  const issues = [
    { number: 60, state: 'open', title: 'tela', labels: L('cortex-travado') },
    { number: 61, state: 'open', title: 'outra', labels: L('cortex-travado') },
    { number: 62, state: 'open', title: 'mexe em .github/workflows/a.yml', labels: L('cortex-travado') },
  ];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const res = (status, d) => ({ ok: status < 400, status, json: async () => d });
    if (u.includes('jules.googleapis.com')) return res(429, { error: { message: 'quota' } });
    if (/labels=cortex-travado/.test(u)) return res(200, issues);
    if (/issues\?|\/pulls\?/.test(u)) return res(200, []);
    const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
    if (n) return res(200, issues.find(i => i.number === n) || { state: 'closed' });
    return res(200, {});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  assert.deepStrictEqual(r.semCotaJules, [60, 61]);
  assert.strictEqual(chamadas.filter(c => c.url.includes('jules.googleapis.com')).length, 1);
  const disparos = chamadas.filter(c => /cortex-reserva\.yml\/dispatches/.test(c.url)).map(c => JSON.parse(c.body).inputs.numero);
  assert.deepStrictEqual(disparos, ['60', '61']);
});

test('VIGIA-ULTIMA-CHANCE1: decidir escolhe mais antiga com precisa-de-voce e ignora workflow/so-humano/vez-do-dono/esperando-dono/cortex-alerta/jules-ultima-chance/com PR', () => {
  const agora = Date.UTC(2026, 10, 9, 12, 0);
  const issues = [
    { number: 101, created_at: '2026-11-01T10:00:00Z', labels: L('precisa-de-voce') },
    { number: 102, created_at: '2026-11-02T10:00:00Z', labels: L('precisa-de-voce') },
    { number: 103, created_at: '2026-10-30T10:00:00Z', title: 'mexe em .github/workflows/x.yml', labels: L('precisa-de-voce') },
    { number: 104, created_at: '2026-10-29T10:00:00Z', labels: L('precisa-de-voce', 'so-humano') },
    { number: 105, created_at: '2026-10-28T10:00:00Z', labels: L('precisa-de-voce', 'vez-do-dono') },
    { number: 106, created_at: '2026-10-27T10:00:00Z', labels: L('precisa-de-voce', 'esperando-dono') },
    { number: 107, created_at: '2026-10-26T10:00:00Z', labels: L('precisa-de-voce', 'cortex-alerta') },
    { number: 108, created_at: '2026-10-25T10:00:00Z', labels: L('precisa-de-voce', 'jules-ultima-chance') },
    { number: 109, created_at: '2026-10-24T10:00:00Z', labels: L('precisa-de-voce') },
  ];
  const prs = [{ title: 'PR para 109', body: 'Refs #109' }];
  const d = decidir(issues, prs, agora, nomes);
  assert.deepStrictEqual(d.ultimaChance, [101, 102]);
});

test('VIGIA-ULTIMA-CHANCE2: volta a precisa-de-voce depois de 1 h sem PR (sem tirar jules-ultima-chance)', () => {
  const agora = Date.UTC(2026, 10, 9, 12, 0);
  const velho = new Date(agora - 2 * H).toISOString(), novo = new Date(agora - 0.5 * H).toISOString();
  const issues = [
    { number: 201, updated_at: velho, labels: L('jules-ultima-chance') },
    { number: 202, updated_at: novo, labels: L('jules-ultima-chance') },
    { number: 203, updated_at: velho, labels: L('jules-ultima-chance') },
    { number: 204, updated_at: velho, labels: L('jules-ultima-chance', 'precisa-de-voce') },
  ];
  const prs = [{ title: 'pr', body: 'Fix #203' }];
  const d = decidir(issues, prs, agora, nomes);
  assert.deepStrictEqual(d.voltaPrecisa, [201]);
});

test('VIGIA-ULTIMA-CHANCE3: rodar manda tarefas em precisa-de-voce até completar MAX_ENVIOS e não ultrapassa limite', async () => {
  const travadas = [
    { number: 301, state: 'open', title: 'travada 1', labels: L('cortex-travado') },
  ];
  const precisa = [
    { number: 302, state: 'open', title: 'precisa 1', created_at: '2026-11-01T10:00:00Z', labels: L('precisa-de-voce') },
    { number: 303, state: 'open', title: 'precisa 2', created_at: '2026-11-02T10:00:00Z', labels: L('precisa-de-voce') },
    { number: 304, state: 'open', title: 'precisa 3', created_at: '2026-11-03T10:00:00Z', labels: L('precisa-de-voce') },
  ];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (u.includes('jules.googleapis.com')) return ok({ id: 'S' + (/(\d+)/.exec(u) || [''])[0] });
    if (/labels=cortex-travado/.test(u)) return ok(travadas);
    if (/labels=precisa-de-voce/.test(u)) return ok(precisa);
    if (/issues\?|\/pulls\?/.test(u)) return ok([]);
    const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
    if (n) {
      const achada = [...travadas, ...precisa].find(i => i.number === n);
      return ok(achada || {});
    }
    return ok({});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  // MAX_ENVIOS = 3. 1 travada (301) + 2 de última chance (302, 303). 304 não deve ir.
  assert.deepStrictEqual(r.enviados.map(e => e.issue), [301, 302, 303]);
  assert.deepStrictEqual(r.ultimaChance, [302, 303]);

  // Verifica que tirou precisa-de-voce e pós jules-ultima-chance em 302 e 303
  const tiradas = chamadas.filter(c => c.method === 'DELETE' && c.url.includes('/labels/precisa-de-voce')).map(c => Number((/issues\/(\d+)\//.exec(c.url) || [])[1]));
  assert.deepStrictEqual(tiradas, [302, 303]);
  const postLabels = chamadas.filter(c => c.method === 'POST' && c.url.endsWith('/labels') && /jules-ultima-chance/.test(c.body)).map(c => Number((/issues\/(\d+)\//.exec(c.url) || [])[1]));
  assert.deepStrictEqual(postLabels, [302, 303]);

  // Comentário padrão postado
  const comentarios = chamadas.filter(c => c.method === 'POST' && c.url.endsWith('/comments') && /Vigia: o Jules tem cota de novo/.test(c.body));
  assert.strictEqual(comentarios.length, 2);
});

test('VIGIA-ULTIMA-CHANCE4: se o Jules responder 429/limite durante as travadas ou última chance, para imediatamente', async () => {
  const travadas = [
    { number: 401, state: 'open', title: 'travada', labels: L('cortex-travado') },
  ];
  const precisa = [
    { number: 402, state: 'open', title: 'precisa 1', labels: L('precisa-de-voce') },
    { number: 403, state: 'open', title: 'precisa 2', labels: L('precisa-de-voce') },
  ];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const res = (status, d) => ({ ok: status < 400, status, json: async () => d });
    if (u.includes('jules.googleapis.com')) {
      // 401 dá 429
      return res(429, { error: { message: 'quota exceeded' } });
    }
    if (/labels=cortex-travado/.test(u)) return res(200, travadas);
    if (/labels=precisa-de-voce/.test(u)) return res(200, precisa);
    if (/issues\?|\/pulls\?/.test(u)) return res(200, []);
    const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
    if (n) {
      const achada = [...travadas, ...precisa].find(i => i.number === n);
      return res(200, achada || {});
    }
    return res(200, {});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  // Como travada deu 429, julesSemCota virou true e nenhuma de última chance deve ter sido chamada
  assert.strictEqual(r.ultimaChance.length, 0);
  assert.strictEqual(chamadas.filter(c => c.url.includes('/issues/402/')).length, 0);
  assert.strictEqual(chamadas.filter(c => c.url.includes('/issues/403/')).length, 0);
});

test('VIGIA-ULTIMA-CHANCE5: se última chance sofrer 429, para na hora sem tocar nas próximas', async () => {
  const precisa = [
    { number: 501, state: 'open', title: 'precisa 1', labels: L('precisa-de-voce') },
    { number: 502, state: 'open', title: 'precisa 2', labels: L('precisa-de-voce') },
  ];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const res = (status, d) => ({ ok: status < 400, status, json: async () => d });
    if (u.includes('jules.googleapis.com')) {
      return res(429, { error: { message: 'quota exceeded (429)' } });
    }
    if (/labels=cortex-travado/.test(u)) return res(200, []);
    if (/labels=precisa-de-voce/.test(u)) return res(200, precisa);
    if (/issues\?|\/pulls\?/.test(u)) return res(200, []);
    const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
    if (n) {
      const achada = precisa.find(i => i.number === n);
      return res(200, achada || {});
    }
    return res(200, {});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  assert.strictEqual(r.ultimaChance.length, 0);
  assert.strictEqual(chamadas.filter(c => c.url.includes('/issues/502/')).length, 0);
});

test('VIGIA-ULTIMA-CHANCE6: rodar busca jules-ultima-chance e devolve precisa-de-voce se passar 1 h sem PR', async () => {
  const velho = new Date(AS_20 - 2 * H).toISOString();
  const enviadas = [
    { number: 601, state: 'open', title: 'parada na ultima chance', updated_at: velho, labels: L('jules-ultima-chance') },
  ];
  const chamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url); chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (/labels=cortex-travado/.test(u)) return ok([]);
    if (/labels=precisa-de-voce/.test(u)) return ok([]);
    if (/labels=jules-ultima-chance/.test(u)) return ok(enviadas);
    if (/issues\?|\/pulls\?/.test(u)) return ok([]);
    const n = Number((/issues\/(\d+)$/.exec(u) || [])[1]);
    if (n) return ok(enviadas.find(i => i.number === n) || {});
    return ok({});
  };
  const r = await rodar(AS_20, { env, fetchFn });
  assert.deepStrictEqual(r.voltaPrecisa, [601]);
  assert.ok(chamadas.some(c => c.method === 'POST' && c.url.endsWith('/issues/601/labels') && /precisa-de-voce/.test(c.body)));
  assert.ok(chamadas.some(c => c.method === 'POST' && c.url.endsWith('/issues/601/comments') && /voltou para \\"Precisa de você\\"/.test(c.body)));
});
