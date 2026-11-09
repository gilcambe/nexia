'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { processarPassagens } = require('../../cloudflare/gestor-ia.js');
const { obterQuemTrabalha } = require('../../netlify/functions/central/quem-trabalha.js');
const { createPlacar } = require('../../nexia-ai/model-router/cota.js');
const { escreverRegistro } = require('../../nexia-ai/passagem/registro.js');

function criarGhFalso({ issuesNexia = [], issuesDestino = {} } = {}) {
  const dados = {
    nexiaIssues: [...issuesNexia],
    destinos: { ...issuesDestino },
    postadas: [],
    comentarios: [],
    atualizadas: [],
  };

  const gh = async (path, opts = {}) => {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;

    if (method === 'GET') {
      // Registros (trabalho-ativo) vêm do nexia; a busca anti-duplicação (state=all) vai ao repo de destino, que pode ser o próprio nexia.
      if (path.includes('labels=trabalho-ativo')) {
        return dados.nexiaIssues;
      }
      for (const repo of Object.keys(dados.destinos)) {
        if (path.includes(`/repos/${repo}/issues`)) {
          return dados.destinos[repo] || [];
        }
      }
      return [];
    }

    if (method === 'POST') {
      if (path.endsWith('/comments')) {
        dados.comentarios.push({ path, body });
        return { id: 100 + dados.comentarios.length };
      }
      // Criar issue
      const m = path.match(/\/repos\/([\w.-]+\/[\w.-]+)\/issues$/);
      if (m) {
        const repo = m[1];
        const novoNumero = 900 + dados.postadas.length;
        const nova = { number: novoNumero, title: body.title, body: body.body, labels: body.labels || [] };
        dados.postadas.push({ repo, issue: nova });
        if (!dados.destinos[repo]) dados.destinos[repo] = [];
        dados.destinos[repo].push(nova);
        return nova;
      }
    }

    if (method === 'PATCH') {
      const m = path.match(/\/repos\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)$/);
      if (m) {
        dados.atualizadas.push({ path, body });
        return { ok: true };
      }
    }

    return null;
  };

  return { gh, dados };
}

test('passagem homologação: registro com sinal há 20 min e 2 itens pendentes cria 2 issues no repo destino e marca passado', async () => {
  const agora = Date.now();
  const sinalVinteMinAtras = new Date(agora - 20 * 60 * 1000).toISOString();
  const regCorpo = escreverRegistro('Thread teste', {
    quem: 'claude',
    onde: 'thread voz',
    repo: 'gilcambe/nexia',
    ramo: 'claude/branch',
    sinal: sinalVinteMinAtras,
    itens: [
      { t: 'Item 1', feito: false, arquivos: ['a.js'] },
      { t: 'Item 2', feito: false, arquivos: ['b.js'] },
      { t: 'Item 0 já feito', feito: true }
    ],
    estado: 'trabalhando'
  });

  const issueAtiva = {
    number: 10,
    title: 'Trabalho Claude',
    body: regCorpo,
    labels: [{ name: 'trabalho-ativo' }]
  };

  const f = criarGhFalso({ issuesNexia: [issueAtiva] });
  const res = await processarPassagens({ gh: f.gh, agora });

  assert.equal(res.paradas.length, 1);
  assert.equal(res.criadas.length, 2);
  assert.equal(f.dados.postadas.length, 2);
  assert.equal(f.dados.comentarios.length, 1);
  assert.match(f.dados.comentarios[0].body.body, /Passei 2 itens para a fila/);
  assert.equal(f.dados.atualizadas.length, 1);
  assert.match(f.dados.atualizadas[0].body.body, /"estado":"passado"/);
});

test('passagem homologação: rodar de novo não duplica issues já passadas', async () => {
  const agora = Date.now();
  const sinalVinteMinAtras = new Date(agora - 20 * 60 * 1000).toISOString();
  const regCorpo = escreverRegistro('Thread teste', {
    quem: 'claude',
    onde: 'thread voz',
    repo: 'gilcambe/nexia',
    ramo: 'claude/branch',
    sinal: sinalVinteMinAtras,
    itens: [
      { t: 'Item 1', feito: false },
    ],
    estado: 'trabalhando'
  });

  const issueAtiva = {
    number: 20,
    title: 'Trabalho Claude',
    body: regCorpo,
    labels: [{ name: 'trabalho-ativo' }]
  };

  const f = criarGhFalso({
    issuesNexia: [issueAtiva],
    issuesDestino: {
      'gilcambe/nexia': [
        {
          number: 888,
          title: 'Item 1',
          body: '<!-- passagem:gilcambe/nexia#20#0 -->'
        }
      ]
    }
  });

  const res = await processarPassagens({ gh: f.gh, agora });
  assert.equal(res.criadas.length, 0); // Já continha o marcador, não duplica
});

test('passagem homologação: registro com sinal há 5 min não passa nada', async () => {
  const agora = Date.now();
  const sinalCincoMinAtras = new Date(agora - 5 * 60 * 1000).toISOString();
  const regCorpo = escreverRegistro('Thread ativa', {
    quem: 'claude',
    sinal: sinalCincoMinAtras,
    itens: [{ t: 'Item pendente', feito: false }],
    estado: 'trabalhando'
  });

  const issueAtiva = { number: 30, body: regCorpo, labels: [{ name: 'trabalho-ativo' }] };
  const f = criarGhFalso({ issuesNexia: [issueAtiva] });
  const res = await processarPassagens({ gh: f.gh, agora });

  assert.equal(res.paradas.length, 0);
  assert.equal(res.criadas.length, 0);
  assert.equal(f.dados.postadas.length, 0);
});

test('passagem homologação: registro do repo privado avaya-gsd cria issue no avaya-gsd sem vazar texto no nexia', async () => {
  const agora = Date.now();
  const sinalVinteMinAtras = new Date(agora - 20 * 60 * 1000).toISOString();
  const regCorpo = escreverRegistro('Thread confidencial', {
    quem: 'claude',
    onde: 'thread avaya privada',
    repo: 'gilcambe/avaya-gsd',
    ramo: 'claude/speech-fix',
    sinal: sinalVinteMinAtras,
    itens: [{ t: 'Correção secreta no avaya', feito: false, arquivos: ['app/secret.py'] }],
    estado: 'trabalhando'
  });

  const issueAtiva = { number: 40, body: regCorpo, labels: [{ name: 'trabalho-ativo' }] };
  const f = criarGhFalso({ issuesNexia: [issueAtiva], issuesDestino: { 'gilcambe/avaya-gsd': [] } });
  const res = await processarPassagens({ gh: f.gh, agora });

  assert.equal(res.criadas.length, 1);
  assert.equal(res.criadas[0].repo, 'gilcambe/avaya-gsd');
  assert.equal(f.dados.postadas[0].repo, 'gilcambe/avaya-gsd');
  // Garante que o nexia não recebeu POST de issue com esse conteúdo
  assert.ok(!f.dados.postadas.some(p => p.repo === 'gilcambe/nexia'));
});

test('passagem homologação: rotação de cota com provedor bloqueado no placar aciona parada e quem-trabalha reflete status', async () => {
  const placar = createPlacar();
  placar.marcar('anthropic', 'rate', 60000); // 429 simulado
  assert.equal(placar.bloqueado('anthropic'), true);

  const agora = Date.now();
  const regCorpo = escreverRegistro('Thread', {
    quem: 'anthropic',
    sinal: new Date(agora - 2000).toISOString(), // sinal recente, mas cota estourada
    itens: [{ t: 'Tarefa cota esgotada', feito: false }],
    estado: 'trabalhando'
  });

  const issueAtiva = { number: 50, title: 'Thread cota', body: regCorpo, labels: [{ name: 'trabalho-ativo' }] };
  const f = criarGhFalso({ issuesNexia: [issueAtiva] });

  // quem-trabalha detecta parou por cota
  const rel = await obterQuemTrabalha({ gh: f.gh, agora, placar });
  assert.equal(rel.itens.length, 1);
  assert.equal(rel.itens[0].status, 'parou');
  assert.equal(rel.itens[0].motivo, 'provedor sem cota');

  // Gestor executa e passa a tarefa para a fila
  const res = await processarPassagens({ gh: f.gh, agora, placar });
  assert.equal(res.paradas.length, 1);
  assert.equal(res.criadas.length, 1);
});
