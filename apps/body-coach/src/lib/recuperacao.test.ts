import { calcularRecuperacao, GRUPOS_RECUPE, TreinoParaRecuperacao } from './recuperacao';
import { describe, it, expect } from 'vitest';

describe('calcularRecuperacao', () => {
  it('deve retornar 100% de recuperação quando não há treinos', () => {
    const resultado = calcularRecuperacao([]);
    for (const g of GRUPOS_RECUPE) {
      expect(resultado[g.id]).toBe(100);
    }
  });

  it('deve calcular corretamente a recuperação após treino recente', () => {
    const agora = new Date();
    const dataRecente = new Date(agora.getTime() - 2 * 3600 * 1000).toISOString();

    const treino: TreinoParaRecuperacao = {
      done_at: dataRecente,
      series_por_grupo: {
        peito: 10,
      },
    };

    const resultado = calcularRecuperacao([treino], agora);
    expect(resultado['peito']).toBeLessThan(100);
    expect(resultado['peito']).toBeGreaterThan(0);
    expect(resultado['biceps']).toBe(100);
  });

  it('deve lidar com múltiplas séries e diferentes grupos musculares', () => {
    const agora = new Date();
    const dataTreino = new Date(agora.getTime() - 10 * 3600 * 1000).toISOString();

    const treino: TreinoParaRecuperacao = {
      done_at: dataTreino,
      series_por_grupo: {
        costas: 12,
        biceps: 6,
      },
    };

    const resultado = calcularRecuperacao([treino], agora);
    expect(resultado['costas']).toBeDefined();
    expect(resultado['biceps']).toBeDefined();
    expect(resultado['costas']).toBeLessThan(resultado['biceps']);
  });
});
