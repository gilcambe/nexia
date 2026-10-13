import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import * as robo from './robo.js';

const ESTADO_PATH = path.resolve('divulga/estado.json');
const ESTADO_ORIGINAL = fs.existsSync(ESTADO_PATH) ? fs.readFileSync(ESTADO_PATH, 'utf-8') : null;

function resetEstado() {
  if (ESTADO_ORIGINAL) fs.writeFileSync(ESTADO_PATH, ESTADO_ORIGINAL);
  else if (fs.existsSync(ESTADO_PATH)) fs.unlinkSync(ESTADO_PATH);
}

beforeEach(() => {
  resetEstado();
});

afterEach(() => {
  resetEstado();
});

describe('rodízio de clientes', () => {
  test('primeira execução retorna Cliente Alpha', async () => {
    const r = await robo.executar();
    assert.strictEqual(r.cliente.id, 'cli_1');
    assert.strictEqual(r.cliente.nome, 'Cliente Alpha');
  });

  test('segunda execução retorna Cliente Beta', async () => {
    await robo.executar();
    const r = await robo.executar();
    assert.strictEqual(r.cliente.id, 'cli_2');
    assert.strictEqual(r.cliente.nome, 'Cliente Beta');
  });

  test('terceira execução retorna Cliente Gamma', async () => {
    await robo.executar();
    await robo.executar();
    const r = await robo.executar();
    assert.strictEqual(r.cliente.id, 'cli_3');
    assert.strictEqual(r.cliente.nome, 'Cliente Gamma');
  });

  test('quarta execução volta para Cliente Alpha (ciclo)', async () => {
    await robo.executar();
    await robo.executar();
    await robo.executar();
    const r = await robo.executar();
    assert.strictEqual(r.cliente.id, 'cli_1');
  });
});

describe('link com UTM', () => {
  test('gera URL com utm_source, utm_medium, utm_campaign', async () => {
    const r = await robo.executar();
    assert.ok(r.texto.includes('utm_source=divulga'));
    assert.ok(r.texto.includes('utm_medium=social'));
    assert.ok(r.texto.includes('utm_campaign=cli_1'));
  });
});

describe('publicação em canais', () => {
  test('um canal com erro não derruba os outros', async () => {
    // mock temporário: substitui CANAIS no módulo
    const originalCanais = robo.CANAIS;
    robo.CANAIS = [
      { id: 'ok', ativo: true, publicar: async () => ({ ok: true }) },
      { id: 'falha', ativo: true, publicar: async () => { throw new Error('falha simulada'); } },
      { id: 'ok2', ativo: true, publicar: async () => ({ ok: true }) },
    ];
    try {
      const r = await robo.executar();
      const falhou = r.resultados.find(x => x.canal === 'falha');
      const ok1 = r.resultados.find(x => x.canal === 'ok');
      const ok2 = r.resultados.find(x => x.canal === 'ok2');
      assert.strictEqual(falhou.ok, false);
      assert.strictEqual(ok1.ok, true);
      assert.strictEqual(ok2.ok, true);
    } finally {
      robo.CANAIS = originalCanais;
    }
  });

  test('sem canais ativos entra em modo ensaio', async () => {
    const originalCanais = robo.CANAIS;
    robo.CANAIS = [
      { id: 'twitter', ativo: false, publicar: async () => ({ ok: true }) },
    ];
    try {
      const r = await robo.executar();
      assert.deepStrictEqual(r.resultados, [{ canal: 'ensaio', ok: true, texto: r.texto }]);
    } finally {
      robo.CANAIS = originalCanais;
    }
  });
});
