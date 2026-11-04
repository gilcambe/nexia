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
    // Treino feito há 2 horas
    const dataRecente = new Date(agora.getTime() - 2 * 3600 * 1000).toISOString();

    const treino: TreinoParaRecuperacao = {
      done_at: dataRecente,
      series_por_grupo: {
        peito: 10, // 10 séries * 5 = 50 pontos de desgaste inicial
      },
    };

    const resultado = calcularRecuperacao([treino], agora);
    // Peito é grande: taxa 2% * 0.8 = 1.6% por hora. Em 2 horas recupera 3.2 pontos.
    // Desgaste restante = 50 - 3.2 = 46.8. Score = 100 - 46.8 = 53.2 (arredondado 53)
    expect(resultado['peito']).toBeLessThan(100);
    expect(resultado['peito']).toBeGreaterThan(0);
    // Outros grupos devem estar em 100%
    expect(resultado['biceps']).toBe(100);
  });

  it('deve lidar com múltiplas séries e diferentes grupos musculares', () => {
    const agora = new Date();
    const dataTreino = new Date(agora.getTime() - 10 * 3600 * 1000).toISOString(); // 10 horas atrás

    const treino: TreinoParaRecuperacao = {
      done_at: dataTreino,
      series_por_grupo: {
        costas: 12, // 12 * 5 = 60 pontos
        biceps: 6,  // 6 * 5 = 30 pontos
      },
    };

    const resultado = calcularRecuperacao([treino], agora);
    // Costas (grande): 60 - (10 * 2 * 0.8) = 60 - 16 = 44 desgaste -> 56%
    // Bíceps (pequeno): 30 - (10 * 2 * 1.0) = 30 - 20 = 10 desgaste -> 90%
    expect(resultado['costas']).toBeDefined();
    expect(resultado['biceps']).toBeDefined();
    expect(resultado['costas']).toBeLessThan(resultado['biceps']);
  });
});
