'use strict';
// Divulga só do Body Coach (temporário): clientes pausados com "ativo": false ficam fora da fila, do rodízio e da produção.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const robo = require('../../divulga/robo');
const { produzirDaVez } = require('../../divulga/produzir');
const { roteiroFixo, SERIES, LIMITES } = require('../../divulga/lib/roteiro');

const RAIZ = path.join(__dirname, '../../divulga');
const bc = JSON.parse(fs.readFileSync(path.join(RAIZ, 'clientes/body-coach.json'), 'utf8'));

test('só o Body Coach está ligado; os outros clientes estão pausados', () => {
  const { clientes } = robo.carregar(RAIZ);
  const ligados = Object.values(clientes).filter(c => c.ativo !== false).map(c => c.id);
  assert.deepStrictEqual(ligados, ['body-coach']);
  for (let n = 0; n < 6; n++) assert.strictEqual(robo.clienteDaVez({ clientes, fila: [] }, { rodizio: n }).c.id, 'body-coach');
});

test('fila: item de cliente pausado é pulado (sem apagar) e volta quando o cliente volta', async () => {
  const clientes = { a: { id: 'a', ativo: false, imagens: ['x.jpg'], assuntos: ['x'] }, b: { id: 'b', link: 'https://b.dev/', imagens: ['y.jpg'], assuntos: ['y'] } };
  const fila = [{ id: 'a-01', cliente: 'a', legenda: 'A', imagem: 'x.jpg' }, { id: 'b-01', cliente: 'b', legenda: 'B', imagem: 'y.jpg' }];
  assert.strictEqual((await robo.proximo({ clientes, fila }, {}, null)).id, 'b-01');
  // só sobrou item de pausado: segue o rodízio (cliente b), não fica preso
  assert.strictEqual(robo.clienteDaVez({ clientes, fila }, { feitos: ['b-01'] }).c.id, 'b');
  clientes.a.ativo = undefined;
  assert.strictEqual((await robo.proximo({ clientes, fila }, {}, null)).id, 'a-01');
});

test('produção do post do dia sai para o Body Coach', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-bc-'));
  const feito = [];
  // fila pronta já publicada: entra o rodízio, que só tem o Body Coach ligado
  fs.writeFileSync(path.join(dir, 'divulga-estado.json'), JSON.stringify({ feitos: robo.carregar(RAIZ).fila.map(i => i.id), rodizio: 3 }));
  const p = await produzirDaVez(dir, {
    dados: dir, raiz: RAIZ, env: {}, log: () => {}, forcarReel: false,
    renderizar: async (pecas, saida) => { for (const n of Object.keys(pecas)) fs.writeFileSync(path.join(saida, `${n}.jpg`), ''); feito.push(1); return true; },
  });
  assert.ok(feito.length);
  assert.strictEqual(p.cliente, 'body-coach');
  assert.match(p.legenda, /Teste grátis o app: nexiabodycoach\.pages\.dev/);
});

test('Body Coach: roteiro próprio em todas as séries, dentro dos limites e sem promessa', () => {
  assert.ok(bc.assuntos.length >= 10);
  assert.ok(bc.hashtagsInstagram.every(h => /^#[a-z0-9]+$/.test(h)));
  for (const f of bc.imagens) assert.ok(fs.existsSync(path.join(RAIZ, 'imagens', f)), f);
  for (const s of SERIES) {
    const r = roteiroFixo(bc, s);
    assert.strictEqual(r.gancho, bc.roteiros[s].gancho, s);
    assert.ok(r.telas.length >= LIMITES.telasMin && r.telas.every(t => !t.titulo.endsWith('…') && !t.texto.endsWith('…')), s);
    assert.match(r.legenda, /nexiabodycoach\.pages\.dev/);
    assert.doesNotMatch(r.legenda, /garantid|perca \d|\bcura\b/i);
    assert.ok(r.hashtags.length >= 5 && r.hashtags.length <= LIMITES.hashtags);
  }
  assert.ok(Object.values(bc.roteiros).filter(r => /salve|mande|marque/i.test(r.cta)).length >= 5);
});
