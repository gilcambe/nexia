// Ferramentas do Body Coach, lote 3: Pix sem gateway, modo viagem, mapa (OpenStreetMap) e coach por voz.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ferr3-'));
  const arqs = {};
  for (const n of ['pix', 'modoViagem', 'mapa', 'gps', 'treinosProntos', 'vozCoach']) arqs[n] = `../../apps/body-coach/src/lib/ferramentas/${n}.ts`;
  for (const [nome, rel] of Object.entries(arqs)) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    let out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    out = out.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out);
  }
  const m = {};
  for (const nome of Object.keys(arqs)) m[nome] = await import(pathToFileURL(path.join(dir, `${nome}.mjs`)).href);
  return m;
}

test('Pix: CRC16 confere com o exemplo do Banco Central e o código sai válido', async () => {
  const { pix } = await carregar();
  assert.equal(pix.crc16('123456789'), '29B1');
  const bcb = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(pix.crc16(bcb), '1D3D');
  const c = pix.codigoPix({ tipo: 'telefone', chave: '(81) 99999-8888', nome: 'José Ação', cidade: 'São Paulo', valor: 99.9, descricao: 'Mensalidade 2026-10' });
  assert.match(c, /^000201/);
  assert.ok(c.includes('0114+5581999998888'));
  assert.ok(c.includes('540599.90'));
  assert.ok(c.includes('5909JOSE ACAO'));
  assert.ok(c.includes('6009SAO PAULO'));
  assert.equal(c.slice(-4), pix.crc16(c.slice(0, -4)));
  // sem valor: o campo 54 não entra
  assert.ok(!pix.codigoPix({ tipo: 'email', chave: 'A@B.com', nome: 'Gil', cidade: 'Recife' }).includes('5405'));
  assert.equal(pix.chaveValida('cpf', '123.456.789-09'), true);
  assert.equal(pix.chaveValida('cpf', '123'), false);
  assert.equal(pix.chaveValida('email', 'gil@pix.com'), true);
  assert.equal(pix.chaveValida('aleatoria', '123e4567-e12b-12d1-a456-426655440000'), true);
  assert.equal(pix.nomeMes('2026-10'), 'Outubro de 2026');
});

test('modo viagem: cabe no tempo, silencioso não tem salto e usa o equipamento', async () => {
  const { modoViagem: v, treinosProntos: tp } = await carregar();
  for (const minutos of [10, 20, 30, 45]) {
    const t = v.montarTreinoViagem({ minutos, equipamento: 'nada', silencioso: true, foco: 'corpo', nivel: 'Intermediário' });
    const dur = tp.duracaoMin(t);
    assert.ok(dur <= minutos + 3, `${minutos} min virou ${dur}`);
    assert.ok(dur >= Math.min(minutos, 10) - 4, `${minutos} min ficou curto: ${dur}`);
    assert.ok(!t.blocos.some((b) => /salto|Polichinelo|Burpee$|Corrida estacion/.test(b.nome)), 'silencioso sem saltos');
  }
  const el = v.montarTreinoViagem({ minutos: 20, equipamento: 'elastico', silencioso: false, foco: 'superior', nivel: 'Avançado' });
  assert.ok(el.blocos.some((b) => /elástico/.test(b.nome)));
  const ac = v.montarTreinoViagem({ minutos: 30, equipamento: 'academia', silencioso: false, foco: 'cardio', nivel: 'Iniciante' });
  assert.ok(ac.blocos.some((b) => /Esteira|Bike/.test(b.nome)));
});

test('mapa: lê o OpenStreetMap, classifica, tira repetidos e ordena por distância', async () => {
  const { mapa } = await carregar();
  const json = { elements: [
    { type: 'node', id: 1, lat: -8.06, lon: -34.88, tags: { leisure: 'fitness_centre', name: 'Academia Longe' } },
    { type: 'way', id: 2, center: { lat: -8.0501, lon: -34.9001 }, tags: { leisure: 'park', name: 'Parque Perto', opening_hours: '05:00-22:00' } },
    { type: 'node', id: 3, lat: -8.0502, lon: -34.9002, tags: { leisure: 'fitness_station' } },
    { type: 'node', id: 4, lat: -8.0502, lon: -34.9002, tags: { leisure: 'fitness_station' } },
    { type: 'node', id: 5, lat: -8.05, lon: -34.9, tags: { shop: 'bakery', name: 'Padaria' } },
  ] };
  const l = mapa.lerLugares(json, -8.05, -34.9);
  assert.deepEqual(l.map((x) => x.tipo), ['parque', 'aparelhos', 'academia']);
  assert.equal(l[0].horario, '05:00-22:00');
  assert.equal(l[1].nome, 'Academia ao ar livre');
  assert.ok(l[2].km > 2);
  assert.match(mapa.consultaOverpass(-8.05, -34.9, 3000), /around:3000,-8\.05000,-34\.90000/);
  assert.match(mapa.linkRota(l[0]), /destination=-8\.0501,-34\.9001/);
});

test('coach por voz: frases de exercício, série e descanso', async () => {
  const { vozCoach: v } = await carregar();
  assert.equal(v.fraseExercicio('Supino reto', 4, '8-12', { weight: 42.5, reps: 10 }), 'Agora: Supino reto. 4 séries de 8 a 12 repetições. Sugestão de carga: 42,5 quilos.');
  assert.match(v.fraseSerie(2, 4, 40, 10, false, 90), /40 quilos vezes 10\. Faltam 2 séries\. Descanso de 90 segundos/);
  assert.match(v.fraseSerie(4, 4, 50, 8, true, 60), /^Recorde pessoal!.*Última série/);
  assert.equal(v.fraseDescanso(10), 'Dez segundos. Prepare-se.');
  assert.equal(v.fraseDescanso(9), null);
});
