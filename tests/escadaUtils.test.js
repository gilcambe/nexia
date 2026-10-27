/**
 * Teste unitário de escadaUtils - lógica pura que conta issues por degrau.
 * Roda com `npm test` (node --test).
 */
import { describe, it, expect } from 'node:test';
import { semana, percentCortex, fila, faseB, contarPorDegrau } from '../src/lib/escadaUtils.js';

function issue(sobrescrito = {}) {
  return {
    data: '2026-10-09T10:00:00Z', // sexta-feira
    status: 'open',
    labels: [],
    ...sobrescrito,
  };
}

describe('escadaUtils.semana', () => {
  it('retorna zeros para array vazio', () => {
    expect(semana([])).toEqual({
      seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0,
    });
  });

  it('conta issues pelo dia da semana', () => {
    const issues = [
      issue({ data: '2026-10-05T08:00:00Z' }), // segunda-feira
      issue({ data: '2026-10-05T09:00:00Z' }), // segunda-feira
      issue({ data: '2026-10-06T08:00:00Z' }), // terça-feira
      issue({ data: '2026-10-11T08:00:00Z' }), // domingo
    ];
    expect(semana(issues)).toEqual({
      seg: 2, ter: 1, qua: 0, qui: 0, sex: 0, sab: 0, dom: 1,
    });
  });

  it('ignora issues sem data ou com data inválida', () => {
    const issues = [
      issue({ data: 'invalida' }),
      issue({ data: '' }),
      issue({ data: null }),
      issue({ data: '2026-10-05T08:00:00Z' }), // segunda-feira
    ];
    expect(semana(issues)).toEqual({
      seg: 1, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0,
    });
  });

  it('não muta o array de entrada', () => {
    const issues = [issue({ data: '2026-10-05T08:00:00Z' })];
    const antes = JSON.stringify(issues);
    semana(issues);
    expect(JSON.stringify(issues)).toBe(antes);
  });
});

describe('escadaUtils.percentCortex', () => {
  it('retorna 0 para array vazio', () => {
    expect(percentCortex([])).toBe(0);
  });

  it('calcula percentual de issues do Cortex', () => {
    const issues = [
      issue({ labels: ['cortex'] }),
      issue({ labels: ['cortex'] }),
      issue({ labels: ['outro'] }),
      issue({ labels: [] }),
    ];
    expect(percentCortex(issues)).toBe(50);
  });

  it('retorna 100 quando todas são do Cortex', () => {
    const issues = [issue({ labels: ['cortex'] }), issue({ labels: ['cortex'] })];
    expect(percentCortex(issues)).toBe(100);
  });
});

describe('escadaUtils.fila', () => {
  it('retorna 0 para array vazio', () => {
    expect(fila([])).toBe(0);
  });

  it('conta issues na fila (open ou fila)', () => {
    const issues = [
      issue({ status: 'open' }),
      issue({ status: 'fila' }),
      issue({ status: 'closed' }),
      issue({ status: 'concluida' }),
    ];
    expect(fila(issues)).toBe(2);
  });
});

describe('escadaUtils.faseB', () => {
  it('retorna 0 para array vazio', () => {
    expect(faseB([])).toBe(0);
  });

  it('conta issues na fase B (fase-b, faseB, fase b)', () => {
    const issues = [
      issue({ labels: ['fase-b'] }),
      issue({ labels: ['faseB'] }),
      issue({ labels: ['fase b'] }),
      issue({ labels: ['outro'] }),
    ];
    expect(faseB(issues)).toBe(3);
  });
});

describe('escadaUtils.contarPorDegrau', () => {
  it('gera o JSON esperado com semana, percentCortex, fila e faseB', () => {
    const issues = [
      issue({ data: '2026-10-05T08:00:00Z', status: 'open', labels: ['cortex', 'fase-b'] }), // segunda
      issue({ data: '2026-10-06T08:00:00Z', status: 'closed', labels: ['outro'] }), // terça
      issue({ data: '2026-10-09T10:00:00Z', status: 'fila', labels: ['cortex'] }), // sexta
    ];
    const resultado = contarPorDegrau(issues);

    expect(resultado).toHaveProperty('semana');
    expect(resultado).toHaveProperty('percentCortex');
    expect(resultado).toHaveProperty('fila');
    expect(resultado).toHaveProperty('faseB');
    expect(resultado.semana.seg).toBe(1);
    expect(resultado.semana.ter).toBe(1);
    expect(resultado.semana.sex).toBe(1);
    expect(resultado.percentCortex).toBe(67); // 2 de 3
    expect(resultado.fila).toBe(2); // open + fila
    expect(resultado.faseB).toBe(1); // apenas o primeiro
  });
});
