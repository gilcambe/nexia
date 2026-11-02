'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandler } = require('../../netlify/functions/central.js');

const master = { verifyBearerToken: async () => ({ ok: true, role: 'master', email: 'dono@nexia' }) };
const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
const ghFalso = (log = []) => ({
  cortex: async () => ({ naFila: 2, fazendo: [], travadas: [], feitas7: 3, ultimas: [], proximas: [] }),
  robos: async (l) => l.map((r) => ({ arquivo: r.arquivo, situacao: 'ok' })),
  divulga: async () => ({ naFila: 1, proximos: [], historico: [] }),
  rodar: async (a, i) => { log.push([a, i]); },
  pedirAoCortex: async (t) => { log.push(['pedir', t]); return { numero: 9, link: 'x' }; },
});
const ev = (o = {}) => ({ httpMethod: 'GET', headers: { authorization: 'Bearer x' }, queryStringParameters: {}, ...o });

test('CENT1. só o master abre a Central', async () => {
  const r = await createHandler({ getMw: () => outro })(ev());
  assert.strictEqual(r.statusCode, 403);
});

test('CENT2. lista de produtos e links sem nenhum segredo', async () => {
  const r = await createHandler({ getMw: () => master })(ev());
  const b = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.ok(b.produtos.length >= 6 && b.links.length >= 5);
  assert.ok(!/token|secret|senha/i.test(r.body));
});

test('CENT3. saúde mede cada site (fora do ar = ok false)', async () => {
  const fetch = async (u) => { if (u.includes('bezsan')) throw new Error('fora'); return { status: 200 }; };
  const b = JSON.parse((await createHandler({ esperaMs: 0, getMw: () => master, fetch })(ev({ queryStringParameters: { parte: 'saude' } }))).body);
  assert.strictEqual(b.produtos.find((p) => p.id === 'bezsan').ok, false);
  assert.strictEqual(b.produtos.find((p) => p.id === 'body-coach').ok, true);
});

test('CENT4. rodar só robôs da lista; ensaio do Divulga', async () => {
  const log = [];
  const h = createHandler({ getMw: () => master, getGithub: () => ghFalso(log) });
  const post = (b) => h(ev({ httpMethod: 'POST', body: JSON.stringify(b) }));
  assert.strictEqual((await post({ acao: 'rodar', arquivo: 'publicar-regras.yml' })).statusCode, 400);
  assert.strictEqual((await post({ acao: 'rodar', arquivo: 'divulga.yml', ensaio: true })).statusCode, 200);
  assert.deepStrictEqual(log[0], ['divulga.yml', { acao: 'ensaio' }]);
  assert.strictEqual((await post({ acao: 'pedir', texto: 'curto' })).statusCode, 400);
  assert.strictEqual((await post({ acao: 'pedir', texto: 'Criar botão de modo escuro na Central' })).statusCode, 200);
});

test('CENT5. dinheiro usa o resumo do Body Coach', async () => {
  const db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ em: Date.now() }) }] }) }) }) }) };
  const h = createHandler({ getMw: () => master, getDb: () => db, getResumo: () => async () => ({ receitaMes: 50, pagantes: 2 }) });
  const b = JSON.parse((await h(ev({ queryStringParameters: { parte: 'dinheiro' } }))).body);
  assert.deepStrictEqual([b.receitaMes, b.pagantes, b.avisos7], [50, 2, 1]);
});

test('CENT6. uso do Cloudflare: sem token avisa, com token soma os pedidos do dia', async () => {
  const ev6 = ev({ queryStringParameters: { parte: 'cloudflare' } });
  const sem = JSON.parse((await createHandler({ getMw: () => master, env: {} })(ev6)).body);
  assert.strictEqual(sem.configurado, false);
  const fetch = async () => ({ ok: true, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 1200 } }, { sum: { requests: 34 } }] }] } } }) });
  const com = JSON.parse((await createHandler({ getMw: () => master, env: { CLOUDFLARE_ANALYTICS_TOKEN: 't', NEXIA_D1_ACCOUNT_ID: 'c' }, fetch })(ev6)).body);
  assert.deepStrictEqual([com.configurado, com.pedidos, com.limite], [true, 1234, 100000]);
});

// Banco falso mínimo: collection().where().orderBy().limit().get() devolve as linhas dadas.
const dbFalso = (linhas) => {
  const q = (nome) => ({ where: () => q(nome), orderBy: () => q(nome), limit: () => q(nome),
    get: async () => ({ docs: (linhas[nome] || []).map((x, i) => ({ id: 'd' + i, data: () => x })) }) });
  return { collection: q };
};

test('CENT7. empresa: fornecedor sem chave fica "falta ligar", robô com erro aparece com erro', async () => {
  const gh = { ...ghFalso(), robos: async (l) => l.map((r) => ({ arquivo: r.arquivo, situacao: r.arquivo === 'divulga.yml' ? 'erro' : 'ok', quando: 'x' })) };
  const r = JSON.parse((await createHandler({ getMw: () => master, getGithub: () => gh, env: { GROQ_API_KEY: 'k' } })(ev({ queryStringParameters: { parte: 'empresa' } }))).body);
  const s = Object.fromEntries(r.fornecedores.map((f) => [f.id, f.situacao]));
  assert.deepStrictEqual([s.groq, s.gemini, s.meta, s.shopee, s.cloudflare], ['ok', 'desligado', 'erro', 'ok', 'ok']);
  assert.ok(!JSON.stringify(r).includes('"k"'), 'nunca mostra o valor da chave');
});

test('CENT8. clientes e contatos interessados vêm do banco, em frases simples', async () => {
  const agora = Date.now();
  const db = dbFalso({
    bc_acesso: [{ tipo: 'coach', email: 'a@x', pagoAte: agora + 1e8 }, { tipo: 'coach', email: 'b@x', gratisAte: agora + 1e8 }, { tipo: 'coach', email: 'c@x', pagoAte: 1 }],
    nexia_leads: [{ nome: 'Ana', status: 'novo', produto: 'body-coach', whatsapp: '11999990000', criado_em: new Date().toISOString(), utm: { source: 'instagram' } },
      { nome: 'Bia', status: 'cliente', produto: 'nexia', site: 'nexia.pages.dev', criado_em: '2020-01-01T00:00:00Z' }],
  });
  const h = createHandler({ getMw: () => master, getDb: () => db, getAgendas: () => ({ studiolima: { nome: 'Studio Lima' }, teste: { codigo_sempre: true } }) });
  const c = JSON.parse((await h(ev({ queryStringParameters: { parte: 'clientes' } }))).body);
  assert.deepStrictEqual(c.empresas.map((e) => e.nome), ['Studio Lima']);
  assert.deepStrictEqual(c.personais.map((p) => p.situacao).sort(), ['pagando', 'teste', 'vencido']);
  const l = JSON.parse((await h(ev({ queryStringParameters: { parte: 'leads' } }))).body);
  assert.deepStrictEqual([l.total, l.semana, l.novos, l.porStatus.cliente, l.porOrigem.instagram], [2, 1, 1, 1, 1]);
});

test('CENT9. testar IAs: 1 teste por provedor, sem chave = desligado, erro esconde a chave', async () => {
  const router = {
    capabilities: (d) => ({ available: d.provider !== 'mistral' }),
    chat: async (d) => { if (d.provider === 'google') throw new Error('falhou key=SEGREDO'); return { ok: 1 }; },
  };
  const ias = [{ provider: 'groq', model: 'a' }, { provider: 'groq', model: 'b' }, { provider: 'google', model: 'g' }, { provider: 'mistral', model: 'm' }];
  const r = JSON.parse((await createHandler({ getMw: () => master, getRouter: () => router, getIAs: () => ias })(ev({ httpMethod: 'POST', body: JSON.stringify({ acao: 'testar-ias' }) }))).body);
  assert.deepStrictEqual(r.ias.map((i) => [i.provedor, i.situacao]), [['groq', 'ok'], ['google', 'erro'], ['mistral', 'desligado']]);
  assert.ok(!JSON.stringify(r).includes('SEGREDO'));
});

test('CENT10. clientes traz pixAguardando e usoIa; acao confirmar_pix e recusar_pix no POST', async () => {
  const agora = Date.now();
  let liberado = null;
  const db = {
    collection: (col) => {
      if (col === 'bc_acesso_pedidos') {
        return {
          orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [{ id: 'p1', data: () => ({ uid: 'u1', email: 'p@x', plano: 'mensal', valor: 49, em: agora, status: 'pendente', dias: 30 }) }] }) }) }),
          doc: (id) => ({
            get: async () => ({ exists: true, data: () => ({ uid: 'u1', email: 'p@x', plano: 'mensal', valor: 49, em: agora, status: 'pendente', dias: 30 }) }),
            set: async (dados) => { liberado = { id, ...dados }; },
          }),
        };
      }
      if (col === 'bc_acesso') {
        return {
          where: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ email: 'c@x', tipo: 'coach', gratisAte: agora + 864e5 }) }] }) }) }),
          doc: () => ({ set: async () => {}, get: async () => ({ data: () => ({ email: 'c@x' }) }) }),
        };
      }
      if (col === 'bc_acesso_pagamentos') {
        return { add: async () => {} };
      }
      return { where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
    },
  };

  const h = createHandler({ getMw: () => master, getDb: () => db, getAgendas: () => ({}) });
  const c = JSON.parse((await h(ev({ queryStringParameters: { parte: 'clientes' } }))).body);
  assert.ok(Array.isArray(c.pixAguardando));
  assert.strictEqual(c.pixAguardando.length, 1);
  assert.strictEqual(c.pixAguardando[0].id, 'p1');

  // Teste confirmação de Pix
  const resConf = await h(ev({ httpMethod: 'POST', body: JSON.stringify({ acao: 'confirmar_pix', id: 'p1' }) }));
  assert.strictEqual(resConf.statusCode, 200);
  assert.strictEqual(liberado.status, 'confirmado');

  // Teste permissão 403 para usuário comum
  const resUser = await createHandler({ getMw: () => outro, getDb: () => db })(ev({ httpMethod: 'POST', body: JSON.stringify({ acao: 'confirmar_pix', id: 'p1' }) }));
  assert.strictEqual(resUser.statusCode, 403);
});

test('CENT-PROPRIO. sites no próprio Worker usam a medição de hora em hora (o Worker não abre o próprio endereço)', async () => {
  const pedidos = [];
  const fetch = async (u) => { pedidos.push(u); return { status: 200 }; };
  const hora = new Date().toISOString().slice(0, 13);
  const antes = new Date(Date.now() - 3600e3).toISOString().slice(0, 13);
  const db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [{ data: () => ({ hora, em: 'agora', rotas: { cortex: { ok: true, codigo: 200, tempo: 40 }, ces: { ok: false, codigo: 503, tempo: 10 } } }) }, { data: () => ({ hora: antes, em: 'antes', rotas: { ces: { ok: false, codigo: 503, tempo: 10 } } }) }] }) }) }) };
  const b = JSON.parse((await createHandler({ esperaMs: 0, getMw: () => master, fetch, getHistoricoDb: () => db })(ev({ queryStringParameters: { parte: 'saude' } }))).body);
  assert.strictEqual(b.produtos.find((p) => p.id === 'cortex').ok, true);
  assert.strictEqual(b.produtos.find((p) => p.id === 'ces').ok, false);
  assert.strictEqual(b.produtos.find((p) => p.id === 'ces').quando, 'agora');
  assert.ok(!pedidos.some((u) => u.includes('nexia.gcbezerra.workers.dev/health') || u.endsWith('/ces')), 'não abre o próprio Worker');
  assert.ok(pedidos.some((u) => u.includes('pages.dev')), 'sites de fora continuam medidos ao vivo');
});

test('CENT-SEM-AMOSTRA. ausência de amostra resulta em status "sem medição" (cinza) e nunca ok:false', async () => {
  const fetch = async (u) => { if (u.includes('bezsan')) throw new Error('fora'); return { status: 200 }; };
  const db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }) }; // banco vazio, sem amostras
  const b = JSON.parse((await createHandler({ esperaMs: 0, getMw: () => master, fetch, getHistoricoDb: () => db })(ev({ queryStringParameters: { parte: 'saude' } }))).body);
  
  // Sem amostra no histórico: sites próprios não têm medição (sem quando) e nunca ficam ok:false só por falta de amostra
  const cortex = b.produtos.find((p) => p.id === 'cortex');
  const ces = b.produtos.find((p) => p.id === 'ces');
  
  assert.ok(!cortex.quando, 'cortex sem amostra não tem quando (status sem medição/cinza)');
  assert.ok(!ces.quando, 'ces sem amostra não tem quando (status sem medição/cinza)');
  assert.ok(cortex.ok !== false, 'cortex sem amostra nunca fica ok:false apenas por falta de amostra');
  assert.ok(ces.ok !== false, 'ces sem amostra nunca fica ok:false apenas por falta de amostra');
  
  // Sites externos continuam medidos ao vivo mesmo sem amostra histórica
  const bezsan = b.produtos.find((p) => p.id === 'bezsan');
  assert.strictEqual(bezsan.ok, false, 'bezsan (externo) fica ok:false quando está fora do ar');
  assert.strictEqual(bezsan.codigo, 0, 'bezsan fica com codigo 0 quando dá erro');
});

test('CENT-SELF. rotas do próprio host utilizam o binding/mecanismo SELF (medição do histórico)', async () => {
  const fetch = async (u) => { 
    // Se tentar medir o próprio Worker, isso falharia (binding/mecanismo SELF evita isso)
    if (u.includes('nexia.gcbezerra.workers.dev')) throw new Error('Worker não pode medir a si mesmo');
    return { status: 200 }; 
  };
  const hora = new Date().toISOString().slice(0, 13);
  const db = { 
    collection: () => ({ 
      where: () => ({ 
        get: async () => ({ 
          docs: [{ 
            data: () => ({ 
              hora, 
              em: 'agora', 
              rotas: { 
                cortex: { ok: true, codigo: 200, tempo: 40 }, 
                ces: { ok: false, codigo: 503, tempo: 10 } 
              } 
            }) 
          }, { data: () => ({ hora: new Date(Date.now() - 3600e3).toISOString().slice(0, 13), em: 'antes', rotas: { ces: { ok: false, codigo: 503, tempo: 10 } } }) }] 
        }) 
      }) 
    }) 
  };
  const b = JSON.parse((await createHandler({ esperaMs: 0, getMw: () => master, fetch, getHistoricoDb: () => db })(ev({ queryStringParameters: { parte: 'saude' } }))).body);
  
  // Verifica que sites próprios usam a medição do histórico (binding/mecanismo SELF)
  const cortex = b.produtos.find((p) => p.id === 'cortex');
  const ces = b.produtos.find((p) => p.id === 'ces');
  
  assert.strictEqual(cortex.ok, true, 'cortex deve ter ok:true do histórico (binding/mecanismo SELF)');
  assert.strictEqual(ces.ok, false, 'ces deve ter ok:false do histórico (binding/mecanismo SELF)');
  assert.strictEqual(cortex.codigo, 200, 'cortex deve ter codigo 200 do histórico');
  assert.strictEqual(ces.codigo, 503, 'ces deve ter codigo 503 do histórico');
  assert.strictEqual(cortex.tempo, 40, 'cortex deve ter tempo 40 do histórico');
  assert.strictEqual(ces.tempo, 10, 'ces deve ter tempo 10 do histórico');
  assert.strictEqual(cortex.quando, 'agora', 'cortex deve ter quando do histórico');
  assert.strictEqual(ces.quando, 'agora', 'ces deve ter quando do histórico');
  
  // Verifica que sites externos continuam medidos normalmente
  const bezsan = b.produtos.find((p) => p.id === 'bezsan');
  assert.strictEqual(bezsan.ok, true, 'bezsan (externo) deve ter ok:true');
});

test('CENT-MAQ. máquinas do dono vêm do agente (só leitura)', async () => {
  const h = createHandler({ getMw: () => master, getMaquinas: () => ({ ligado: () => true, listar: async () => [{ nome: 'PC1', online: true, ramTotal: 16 }] }) });
  const b = JSON.parse((await h(ev({ queryStringParameters: { parte: 'maquinas' } }))).body);
  assert.deepStrictEqual([b.ligado, b.maquinas[0].nome, b.maquinas[0].online], [true, 'PC1', true]);
});

// #2882: alerta "fora do ar" só com prova (2 checagens seguidas falhando).
const amostra = (horasAtras, rotas) => ({ data: () => ({ hora: new Date(Date.now() - horasAtras * 3600e3).toISOString().slice(0, 13), em: 'h-' + horasAtras, rotas }) });
const dbCom = (docs) => ({ collection: () => ({ where: () => ({ get: async () => ({ docs }) }) }) });
const saude = async (fetch, db) => JSON.parse((await createHandler({ esperaMs: 0, getMw: () => master, fetch, getHistoricoDb: () => db })(ev({ queryStringParameters: { parte: 'saude' } }))).body).produtos;

test('CENT-2882a. uma falha só do próprio Worker não vira "fora do ar" (ok:null)', async () => {
  const p = await saude(async () => ({ status: 200 }), dbCom([amostra(0, { vp: { ok: false, codigo: 0, tempo: 0 } }), amostra(1, { vp: { ok: true, codigo: 200, tempo: 50 } })]));
  assert.strictEqual(p.find((x) => x.id === 'vp').ok, null);
});

test('CENT-2882b. duas falhas seguidas do próprio Worker = ok:false', async () => {
  const p = await saude(async () => ({ status: 200 }), dbCom([amostra(0, { vp: { ok: false, codigo: 0, tempo: 0 } }), amostra(1, { vp: { ok: false, codigo: 0, tempo: 0 } })]));
  assert.strictEqual(p.find((x) => x.id === 'vp').ok, false);
});

test('CENT-2882c. site de fora que falha 1 vez e volta na 2ª checagem fica no ar', async () => {
  let n = 0;
  const p = await saude(async (u) => { if (u.includes('bezsan') && n++ === 0) throw new Error('piscou'); return { status: 200 }; }, dbCom([]));
  assert.strictEqual(p.find((x) => x.id === 'bezsan').ok, true);
  assert.strictEqual(n, 2, 'mediu de novo antes de dar alerta');
});

test('CENT-2882d. medir10 do cron nunca lança erro e usa o binding SELF para o próprio Worker', async () => {
  const { criarMedir10 } = require('../../cloudflare/saude.js');
  const { medir } = require('../../netlify/functions/central.js');
  const usados = [];
  const self = { fetch: async (u) => { usados.push('self ' + u); return { status: 200 }; } };
  const fetchFn = async (u) => { usados.push('fetch ' + u); return { status: 200 }; };
  const m = criarMedir10(medir, { base: 'https://nexia.gcbezerra.workers.dev', self, fetchFn });
  assert.strictEqual((await m('https://nexia.gcbezerra.workers.dev/vp')).ok, true);
  assert.strictEqual((await m('https://bezsan.pages.dev/')).ok, true);
  assert.deepStrictEqual(usados, ['self https://nexia.gcbezerra.workers.dev/vp', 'fetch https://bezsan.pages.dev/']);
  const semSelf = criarMedir10(medir, { base: 'https://nexia.gcbezerra.workers.dev', self: undefined, fetchFn });
  assert.strictEqual((await semSelf('https://nexia.gcbezerra.workers.dev/vp')).ok, true, 'sem SELF não quebra (antes: new URL(undefined))');
  const quebra = criarMedir10(async () => { throw new Error('x'); }, { base: 'https://a.b', fetchFn });
  assert.strictEqual((await quebra('lixo')).ok, false);
});
