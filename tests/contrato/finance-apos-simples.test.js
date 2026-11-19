'use strict';
// Contrato (dono 19/11: "aposentadoria com informações confusas, média errada, não deixa apagar nem editar"):
// 1) média do CNIS corrige cada contribuição pela inflação (INPC aproximado) e avisa quando leu poucos meses;
// 2) ação 'apos_apagar' { parte: 'perfil'|'fgts' } apaga; 3) a tela abre com UMA frase (quando e quanto) e botões Editar/Apagar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../../netlify/functions/prumo.js');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [] }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }
const IMG = 'data:image/jpeg;base64,' + Buffer.alloc(400, 7).toString('base64');

test('média corrigida pela inflação e aviso de poucos meses', async () => {
  P.deps.db = () => banco(); P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  P.deps.perguntarVisao = async () => JSON.stringify({ vinculos: [{ empresa: 'A', inicio: '2004-06-01', fim: '2004-07-20', tipo: 'Empregado' }], contribuicoes: [{ competencia: '2004-06', valor: 1000 }] });
  const r = (await P.agir('u', { acao: 'apos_cnis_ler', imagens: [IMG] }))[1].resumo;
  delete P.deps.perguntarVisao;
  assert.ok(r.media_salarial > 2500 && r.media_salarial < 3500, 'R$ 1.000 de 2004 vale cerca de R$ 2.900 hoje: ' + r.media_salarial);
  assert.ok(r.alertas.some((a) => /Li só 1 mês/.test(a)), 'avisa que leu pouco');
});

test('apos_apagar apaga perfil e FGTS', async () => {
  P.deps.db = () => banco(); P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  await P.agir('u', { acao: 'apos_perfil_salvar', nascimento: '1985-12-17', sexo: 'M', tc_2019_meses: 165, tc_total_meses: 250 });
  assert.equal((await P.agir('u', { acao: 'apos_apagar', parte: 'perfil' }))[0], 200);
  const v = (await P.agir('u', { acao: 'apos_visao' }))[1];
  assert.ok(!v.inss, 'sem perfil depois de apagar');
  assert.equal((await P.agir('u', { acao: 'apos_apagar', parte: 'x' }))[0], 400);
});

test('tela: uma frase no topo, Editar e Apagar', () => {
  const t = ler('prumo/aposentadoria.js');
  assert.match(t, /id="apo-frase"/); assert.match(t, /id="apo-apagar"/); assert.match(t, /Editar meus dados/);
  assert.match(ler('prumo/apos.js'), /Você pode se aposentar em/);
});
