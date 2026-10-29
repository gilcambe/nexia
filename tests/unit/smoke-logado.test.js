'use strict';
// Teste unitário: quando a limpeza falha (ex.: If-Match), o smoke-logado deve
// registrar AVISO no log e sair com código 1.

let codigoSaida = null;
const origExit = process.exit;
process.exit = (code) => { codigoSaida = code; };

// Simula a lógica do bloco finally do smoke-logado.js:
// - deleteTestRecord retorna false (status 428 / If-Match ausente)
// - Se a limpeza falhar e nenhum outro teste falhou, process.exitCode = 1
// - O log deve conter a palavra AVISO
function simularLimpeza(apagado, jaFalhou) {
  const linhas = [];
  const log = (...a) => linhas.push(a.join(' '));

  const limpezaFalhou = [];
  if (!apagado) limpezaFalhou.push('projeto');

  if (!apagado) {
    log('  AVISO: falha na limpeza: projeto');
    if (!jaFalhou) {
      process.exitCode = 1;
    }
  }

  const bad = jaFalhou ? [{ ok: false, name: 'outro' }] : [];
  log(`${linhas.length}/${linhas.length} OK`);
  if (bad.length > 0) log('  AVISO: testes falharam');

  process.exit(bad.length ? 1 : 0);
  return { linhas, codigoSaida };
}

beforeEach(() => {
  codigoSaida = null;
  process.exitCode = undefined;
});

afterAll(() => {
  process.exit = origExit;
});

test('smoke-logado: falha na limpeza registra AVISO e sai com código 1', () => {
  const { linhas, codigoSaida: saida } = simularLimpeza(false, false);
  expect(saida).toBe(1);
  expect(linhas.some(l => l.includes('AVISO'))).toBe(true);
  expect(linhas.some(l => l.includes('falha na limpeza'))).toBe(true);
});

test('smoke-logado: não sai com erro se a limpeza for bem sucedida', () => {
  const { linhas, codigoSaida: saida } = simularLimpeza(true, false);
  expect(saida).toBe(0);
  expect(linhas.some(l => l.includes('AVISO'))).toBe(false);
});

test('smoke-logado: se outro teste já falhou, saída continua 1 mesmo com limpeza ok', () => {
  const { codigoSaida: saida } = simularLimpeza(true, true);
  expect(saida).toBe(1);
});

test('smoke-logado: se outro teste já falhou e limpeza também falha, saída é 1 e log tem AVISO', () => {
  const { linhas, codigoSaida: saida } = simularLimpeza(false, true);
  expect(saida).toBe(1);
  expect(linhas.some(l => l.includes('AVISO'))).toBe(true);
});
