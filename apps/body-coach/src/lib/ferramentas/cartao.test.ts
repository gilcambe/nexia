import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { codigoIndicacao, linkIndicacao, capturarIndicacao, APP_URL } from './cartao';

describe('codigoIndicacao', () => {
  it('deve retornar os primeiros 10 caracteres do uid', () => {
    expect(codigoIndicacao('abcdef1234567890')).toBe('abcdef1234');
  });
  it('deve retornar o uid inteiro quando menor que 10 caracteres', () => {
    expect(codigoIndicacao('abc123')).toBe('abc123');
  });
  it('deve lidar com uid vazio', () => {
    expect(codigoIndicacao('')).toBe('');
  });
});

describe('linkIndicacao', () => {
  it('deve montar o link com o código de indicação', () => {
    expect(linkIndicacao('abcdef1234567890')).toBe(`${APP_URL}/body-coach/auth?ref=abcdef1234`);
  });
  it('deve usar o APP_URL oficial', () => {
    expect(linkIndicacao('abc123')).toContain(APP_URL);
  });
});

describe('capturarIndicacao', () => {
  let originalLocation: Location;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocation = window.location;
    originalLocalStorage = localStorage;
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://app.test/') as Location,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('deve guardar ref válida no localStorage', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://app.test/?ref=abcdef1234') as Location,
    });
    capturarIndicacao();
    expect(localStorage.getItem('bc_indicado_por')).toBe('abcdef1234');
  });

  it('deve ignorar ref inválida', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://app.test/?ref=abc!') as Location,
    });
    capturarIndicacao();
    expect(localStorage.getItem('bc_indicado_por')).toBeNull();
  });

  it('deve guardar cupom normalizado (maiúsculas, alfanumérico)', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://app.test/?cupom=Amigo-10') as Location,
    });
    capturarIndicacao();
    expect(localStorage.getItem('bc_cupom')).toBe('AMIGO10');
  });

  it('não deve quebrar sem search params', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://app.test/') as Location,
    });
    expect(() => capturarIndicacao()).not.toThrow();
    expect(localStorage.getItem('bc_indicado_por')).toBeNull();
    expect(localStorage.getItem('bc_cupom')).toBeNull();
  });
});
