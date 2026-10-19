'use strict';
// Divulga: todos os clientes têm dados completos (#987) e o roteirista de carrossel nunca para (#988).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { roteiro, SERIES, LIMITES, serieDoDia } = require('../../divulga/lib/roteiro');

const PASTA = path.join(__dirname, '../../divulga/clientes');
const clientes = fs.readdirSync(PASTA).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(PASTA, f), 'utf8')));
const bodyCoach = clientes.find(c => c.id === 'body-coach');
const resposta = body => ({ ok: true, status: 200, json: async () => body });
const groqDiz = conteudo => async () => resposta({ choices: [{ message: { content: conteudo } }] });

test('DR1. todo cliente do Divulga tem id, nome, 3+ assuntos e 5+ hashtags', () => {
  for (const id of ['body-coach', 'bezsan', 'studio-lima', 'splash', 'viajante-pro', 'cortex']) assert.ok(clientes.some(c => c.id === id), `falta ${id}`);
  for (const c of clientes) {
    assert.ok(c.id && c.nome, `${c.id}: id/nome`);
    assert.ok(c.assuntos.length >= 3, `${c.id}: assuntos`);
    assert.ok(c.hashtags.length >= 5, `${c.id}: hashtags`);
    if (!c.link) assert.equal(c.ativo, false, `${c.id}: sem link público precisa de ativo:false`);
    if (c.cores) for (const k of ['fundo', 'destaque']) assert.match(c.cores[k], /^#[0-9a-f]{6}$/i, `${c.id}: cores.${k}`);
  }
});

test('DR2. resposta válida da IA vira o roteiro', async () => {
  const ia = {
    gancho: '3 erros que travam seu treino',
    telas: [1, 2, 3, 4, 5, 6].map(n => ({ titulo: `Erro ${n}`, texto: `Explicação curta do erro ${n}.` })),
    cta: 'Salve e mande para quem treina com você',
    legenda: 'Muita gente treina e não evolui por detalhes simples. Veja os erros mais comuns e como corrigir cada um com calma.',
    hashtags: ['#treinoemcasa', '#foco'],
    pergunta: 'Qual desses você comete?',
  };
  const chamadas = [];
  const fetchImpl = async (u, o) => { chamadas.push(String(u)); return groqDiz('```json\n' + JSON.stringify(ia) + '\n```')(u, o); };
  const r = await roteiro(bodyCoach, { serie: '3-erros', env: { GROQ_API_KEY: 'x' }, fetchImpl });
  assert.equal(chamadas.length, 1);
  assert.match(chamadas[0], /groq/);
  assert.equal(r.fonte, 'ia');
  assert.equal(r.serie, '3-erros');
  assert.equal(r.gancho, ia.gancho);
  assert.equal(r.telas.length, 6);
  assert.equal(r.pergunta, ia.pergunta);
  assert.ok(r.legenda.startsWith(ia.gancho) && r.legenda.endsWith(ia.pergunta));
  assert.equal(r.hashtags.length, 8);
  assert.equal(r.hashtags[0], '#treino', 'hashtags do cliente vêm primeiro');
  assert.ok(r.hashtags.includes('#nexiabodycoach'), 'hashtag da marca');
});

test('DR3. IA falha ou manda JSON inválido -> modelo fixo da série com 5+ telas', async () => {
  const quebrada = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const lixo = groqDiz('não sei responder em JSON');
  for (const fetchImpl of [quebrada, lixo]) {
    const r = await roteiro(clientes.find(c => c.id === 'bezsan'), { serie: 'checklist', env: { GROQ_API_KEY: 'x', GEMINI_API_KEY: 'y' }, fetchImpl });
    assert.equal(r.fonte, 'modelo');
    assert.ok(r.telas.length >= 5);
  }
  // Sem chave nenhuma: nem chama a rede.
  const r = await roteiro(bodyCoach, { serie: 'mito-verdade', fetchImpl: async () => { throw new Error('não devia chamar'); } });
  assert.equal(r.fonte, 'modelo');
});

test('DR4. limites de tamanho valem para todas as séries, clientes e para IA exagerada', async () => {
  const enorme = 'palavra '.repeat(200);
  const exagero = groqDiz(JSON.stringify({ gancho: enorme, telas: Array.from({ length: 12 }, () => ({ titulo: enorme, texto: enorme })), cta: `${enorme} link na bio`, legenda: `${enorme} link na bio link na bio resultado garantido`, hashtags: [], pergunta: enorme }));
  const casos = [await roteiro(bodyCoach, { serie: 'passo-a-passo', env: { GROQ_API_KEY: 'x' }, fetchImpl: exagero })];
  for (const c of clientes) for (const s of SERIES) casos.push(await roteiro(c, { serie: s }));
  for (const r of casos) {
    assert.ok(r.telas.length >= LIMITES.telasMin && r.telas.length <= LIMITES.telasMax, `${r.serie}: telas`);
    for (const t of r.telas) { assert.ok(t.titulo.length <= 40); assert.ok(t.texto.length <= 120); }
    assert.ok(r.legenda.length <= 900);
    assert.ok((r.legenda.match(/link na bio/gi) || []).length <= 1);
    assert.doesNotMatch(r.legenda, /garantid|undefined/i);
    assert.equal(r.hashtags.length, 8);
    assert.equal(new Set(r.hashtags.map(h => h.toLowerCase())).size, 8);
  }
});

test('DR5. sem série, escolhe pela data do calendário', () => {
  assert.equal(serieDoDia(new Date('2026-10-19T15:00:00Z')), '3-erros'); // segunda: dica
  assert.ok(SERIES.includes(serieDoDia(new Date('2026-10-24T15:00:00Z'))));
});
