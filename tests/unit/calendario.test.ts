import { SEMANA, temaDoDia } from '../../src/lib/calendario';

describe('calendario', () => {
  describe('SEMANA', () => {
    it('deve conter os 7 dias da semana', () => {
      expect(SEMANA).toHaveLength(7);
      expect(SEMANA).toEqual(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
    });
  });

  describe('temaDoDia', () => {
    it('deve retornar o tema correto para cada dia', () => {
      expect(temaDoDia('Domingo')).toBe('Descanso e inspiração');
      expect(temaDoDia('Segunda')).toBe('Planejamento da semana');
      expect(temaDoDia('Terça')).toBe('Dicas de produtividade');
      expect(temaDoDia('Quarta')).toBe('Meio da semana – foco');
      expect(temaDoDia('Quinta')).toBe('Feedback e ajustes');
      expect(temaDoDia('Sexta')).toBe('Celebrar conquistas');
      expect(temaDoDia('Sábado')).toBe('Relaxar e refletir');
    });

    it('deve lidar com diferentes formatos de entrada', () => {
      expect(temaDoDia('terça')).toBe('Dicas de produtividade');
      expect(temaDoDia(' TERÇA ')).toBe('Dicas de produtividade');
      expect(temaDoDia('terca')).toBe('Dicas de produtividade');
      expect(temaDoDia('  segunda  ')).toBe('Planejamento da semana');
    });

    it('deve retornar string vazia para dia inválido', () => {
      expect(temaDoDia('Dia inválido')).toBe('');
      expect(temaDoDia('')).toBe('');
      expect(temaDoDia('NaoExiste')).toBe('');
    });
  });
});