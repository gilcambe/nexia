import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  contarComentariosRevisor,
  estadoInterruptor,
  filtrarIssuesPorLabel,
  transformarJSONFinal,
} from '../ajuda-ias.js';

describe('contarComentariosRevisor', () => {
  it('deve retornar zeros quando nao ha comentarios', () => {
    const resultado = contarComentariosRevisor([], new Date('2026-01-01'));
    expect(resultado).toEqual({ aprovados: 0, recusados: 0 });
  });

  it('deve contar comentados aprovados e recusados desde a data', () => {
    const comentarios = [
      { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-01T10:00:00Z' },
      { autor: 'revisor', estado: 'recusado', criadoEm: '2026-02-02T10:00:00Z' },
      { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-03T10:00:00Z' },
      { autor: 'outro', estado: 'aprovado', criadoEm: '2026-02-04T10:00:00Z' },
      { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-01-15T10:00:00Z' }, // antes de desde
    ];
    const resultado = contarComentariosRevisor(comentarios, new Date('2026-02-01'));
    expect(resultado).toEqual({ aprovados: 2, recusados: 1 });
  });

  it('deve ignorar comentarios sem estado', () => {
    const comentarios = [
      { autor: 'revisor', criadoEm: '2026-02-01T10:00:00Z' },
      { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-02T10:00:00Z' },
    ];
    const resultado = contarComentariosRevisor(comentarios, new Date('2026-02-01'));
    expect(resultado).toEqual({ aprovados: 1, recusados: 0 });
  });
});

describe('estadoInterruptor', () => {
  it('deve retornar true quando issue aberta', () => {
    expect(estadoInterruptor({ estado: 'open' })).toBe(true);
    expect(estadoInterruptor({ estado: 'aberto' })).toBe(true);
    expect(estadoInterruptor({ estado: 'OPEN' })).toBe(true);
  });

  it('deve retornar false quando issue fechada', () => {
    expect(estadoInterruptor({ estado: 'closed' })).toBe(false);
    expect(estadoInterruptor({ estado: 'fechada' })).toBe(false);
    expect(estadoInterruptor({ estado: 'CLOSED' })).toBe(false);
  });

  it('deve retornar true quando estado e null ou undefined', () => {
    expect(estadoInterruptor({ estado: null })).toBe(true);
    expect(estadoInterruptor({ estado: undefined })).toBe(true);
    expect(estadoInterruptor({})).toBe(true);
    expect(estadoInterruptor(null)).toBe(true);
    expect(estadoInterruptor(undefined)).toBe(true);
  });

  it('deve tratar estados desconhecidos como abertos', () => {
    expect(estadoInterruptor({ estado: 'pendente' })).toBe(true);
    expect(estadoInterruptor({ estado: '' })).toBe(true);
  });
});

describe('filtrarIssuesPorLabel', () => {
  it('deve retornar count quando issues nao tem label', () => {
    const issues = [
      { numero: 1, labels: [] },
      { numero: 2, labels: [] },
    ];
    expect(filtrarIssuesPorLabel(issues, 'bug')).toBe(0);
  });

  it('deve filtrar issues por label existente', () => {
    const issues = [
      { numero: 1, labels: [{ nome: 'bug' }] },
      { numero: 2, labels: [{ nome: 'melhoria' }] },
      { numero: 3, labels: [{ nome: 'bug' }, { nome: 'urgente' }] },
    ];
    const resultado = filtrarIssuesPorLabel(issues, 'bug');
    expect(resultado).toEqual([issues[0], issues[2]]);
  });

  it('deve filtrar labels com case-insensitive', () => {
    const issues = [
      { numero: 1, labels: [{ nome: 'Bug' }] },
      { numero: 2, labels: [{ nome: 'BUG' }] },
    ];
    const resultado = filtrarIssuesPorLabel(issues, 'bug');
    expect(resultado).toHaveLength(2);
  });

  it('deve retornar array vazio quando nao houver correspondencia', () => {
    const issues = [{ numero: 1, labels: [{ nome: 'bug' }] }];
    expect(filtrarIssuesPorLabel(issues, 'nao-existe')).toEqual([]);
  });
});

describe('transformarJSONFinal (mock da API GitHub)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve transformar resposta da API GitHub em JSON final', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numero: 42,
        estado: 'open',
        comentarios: [
          { autor: 'revisor', estado: 'aprovado', criadoEm: '2026-02-01T10:00:00Z' },
          { autor: 'revisor', estado: 'recusado', criadoEm: '2026-02-02T10:00:00Z' },
        ],
      }),
    });

    global.fetch = fetchMock;

    const resultado = await transformarJSONFinal('https://api.github.com/repos/org/repo/issues/42');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      numero: 42,
      estado: 'open',
      revisao: { aprovados: 1, recusados: 1 },
      estadoInterruptor: true,
    });
  });

  it('deve tratar erro da API GitHub', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ mensagem: 'Nao encontrado' }),
    });

    global.fetch = fetchMock;

    await expect(transformarJSONFinal('https://api.github.com/repos/org/repo/issues/999')).rejects.toThrow('Nao encontrado');
  });
});
