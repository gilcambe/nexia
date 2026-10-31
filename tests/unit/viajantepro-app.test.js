'use strict';
const test = require('node:test');
const assert = require('node:assert');
const VP = require('../../sites/viajantepro/app/nucleo.js');

test('VPAPP1. fila sem internet: enfileira, reenvia uma vez e não duplica', async () => {
  let fila = [];
  fila = VP.novaMensagem(fila, 'Me perdi', 1000, 'a').fila;
  fila = VP.novaMensagem(fila, 'Estou no metrô', 2000, 'b').fila;
  assert.strictEqual(fila.length, 2);
  const servidor = new Map();
  let online = false;
  const enviar = async m => { if (!online) throw new Error('offline'); servidor.set(m.id_local, m); };
  let r = await VP.enviarFila(fila, enviar);
  assert.strictEqual(r.fila.length, 2);
  online = true;
  r = await VP.enviarFila(r.fila, enviar);
  assert.strictEqual(r.fila.length, 0);
  assert.strictEqual(r.enviadas.length, 2);
  await VP.enviarFila(fila, enviar); // reenvio da mesma fila (ex.: duas abas): mesma chave
  assert.strictEqual(servidor.size, 2);
  const conv = VP.juntarConversa([{ id_local: fila[0].id_local, de: 'cliente', texto: 'Me perdi' }], [fila[0], fila[1]]);
  assert.strictEqual(conv.length, 2);
  assert.strictEqual(conv[1].pendente, true);
});

test('VPAPP2. SOS, SMS, fase da viagem, eventos do dia e alerta de voo', () => {
  const txt = VP.mensagemSOS('Ana', 'Lisboa', -23.5, -46.6);
  assert.match(txt, /^SOS Viajante Pro - Ana - Lisboa - estou em https:\/\/maps\.google\.com\/\?q=-23\.500000,-46\.600000$/);
  assert.strictEqual(VP.linkSMS('55 (11) 94124-7074', 'oi'), 'sms:+5511941247074?body=oi');
  const v = { data_saida: '2026-12-01', data_retorno: '2026-12-10',
    voos: [{ data: '2026-12-01', partida: '22:00', cia: 'TAP', numero: 'TP88', trecho: 'GRU → LIS', status: 'Atrasado' }],
    transfers: [{ data: '2026-12-01', hora: '18:00', de: 'Casa', para: 'GRU' }],
    roteiro: [{ data: '2026-12-02', itens: [{ hora: '10:00', titulo: 'Belém' }] }] };
  assert.deepStrictEqual(VP.fase(v, '2026-11-28'), { fase: 'antes', dias: 3 });
  assert.strictEqual(VP.fase(v, '2026-12-05').fase, 'durante');
  assert.strictEqual(VP.fase(v, '2026-12-12').fase, 'depois');
  const ev = VP.eventosDoDia(v, '2026-12-01');
  assert.deepStrictEqual(ev.map(e => e.tipo), ['transfer', 'voo']);
  assert.match(ev[1].alerta, /ATRASADO/);
  assert.strictEqual(VP.alertas(v).length, 1);
  assert.match(VP.avisoCheckin(v.voos[0], Date.parse('2026-12-01T10:00:00')), /aberto/);
});
