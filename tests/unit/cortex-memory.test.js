'use strict';

const {
  addLesson,
  getLessons,
  formatLessonsForPrompt
} = require('../../netlify/functions/cortex-memory');

describe('Módulo de Memória de Lições', () => {
  describe('addLesson', () => {
    test('deve adicionar uma nova lição corretamente', () => {
      const lessons = [];
      const lessonData = {
        data: '2023-01-01',
        tentativa: 'Tentativa de teste',
        erro: 'Erro de teste',
        regra: 'Regra de teste'
      };
      
      const updatedLessons = addLesson(lessons, lessonData);
      
      expect(updatedLessons).toHaveLength(1);
      expect(updatedLessons[0]).toEqual({
        ...lessonData,
        createdAt: expect.any(String)
      });
    });
    
    test('deve manter no máximo 30 lições', () => {
      // Cria 35 lições
      const lessons = Array.from({ length: 35 }, (_, i) => ({
        data: `2023-01-${i + 1}`,
        tentativa: `Tentativa ${i + 1}`,
        erro: `Erro ${i + 1}`,
        regra: `Regra ${i + 1}`,
        createdAt: `2023-01-${i + 1}T00:00:00.000Z`
      }));
      
      const newLesson = {
        data: '2023-02-01',
        tentativa: 'Tentativa nova',
        erro: 'Erro novo',
        regra: 'Regra nova'
      };
      
      const updatedLessons = addLesson(lessons, newLesson);
      
      expect(updatedLessons).toHaveLength(30);
      expect(updatedLessons[0]).toEqual({
        ...newLesson,
        createdAt: expect.any(String)
      });
    });
    
    test('deve lançar erro se lessonData não for objeto', () => {
      expect(() => {
        addLesson([], null);
      }).toThrow('lessonData deve ser um objeto com data, tentativa, erro e regra');
      
      expect(() => {
        addLesson [], 'string');
      }).toThrow('lessonData deve ser um objeto com data, tentativa, erro e regra');
    });
    
    test('deve lançar erro se campos obrigatórios estiverem faltando', () => {
      expect(() => {
        addLesson([], { data: '2023-01-01', tentativa: 'Teste' });
      }).toThrow("Campo obrigatório 'erro' está faltando na lição");
      
      expect(() => {
        addLesson([], { data: '2023-01-01', tentativa: 'Teste', erro: 'Erro' });
      }).toThrow("Campo obrigatório 'regra' está faltando na lição");
    });
  });
  
  describe('getLessons', () => {
    test('deve retornar array vazio se não passar lições', () => {
      const lessons = getLessons();
      expect(lessons).toEqual([]);
    });
    
    test('deve retornar array de lições se passado', () => {
      const testLessons = [
        { data: '2023-01-01', tentativa: 'Teste 1', erro: 'Erro 1', regra: 'Regra 1' },
        { data: '2023-01-02', tentativa: 'Teste 2', erro: 'Erro 2', regra: 'Regra 2' }
      ];
      
      const lessons = getLessons(testLessons);
      expect(lessons).toEqual(testLessons);
    });
    
    test('deve retornar array vazio se não for array', () => {
      const lessons = getLessons('not an array');
      expect(lessons).toEqual([]);
    });
  });
  
  describe('formatLessonsForPrompt', () => {
    test('deve formatar lições corretamente com parâmetros padrão', () => {
      const lessons = [
        {
          data: '2023-01-01',
          tentativa: 'Tentativa 1',
          erro: 'Erro 1',
          regra: 'Regra 1',
          createdAt: '2023-01-01T00:00:00.000Z'
        },
        {
          data: '2023-01-02',
          tentativa: 'Tentativa 2',
          erro: 'Erro 2',
          regra: 'Regra 2',
          createdAt: '2023-01-02T00:00:00.000Z'
        },
        {
          data: '2023-01-03',
          tentativa: 'Tentativa 3',
          erro: 'Erro 3',
          regra: 'Regra 3',
          createdAt: '2023-01-03T00:00:00.000Z'
        }
      ];
      
      const formatted = formatLessonsForPrompt(lessons);
      
      expect(formatted).toContain('Lição 1 (01/01/2023):');
      expect(formatted).toContain('Tentativa: Tentativa 1');
      expect(formatted).toContain('Erro: Erro 1');
      expect(formatted).toContain('Regra: Regra 1');
      expect(formatted).toContain('Lição 2 (02/01/2023):');
      expect(formatted).toContain('Lição 3 (03/01/2023):');
    });
    
    test('deve formatar apenas as últimas 5 lições por padrão', () => {
      const lessons = Array.from({ length: 10 }, (_, i) => ({
        data: `2023-01-${i + 1}`,
        tentativa: `Tentativa ${i + 1}`,
        erro: `Erro ${i + 1}`,
        regra: `Regra ${i + 1}`,
        createdAt: `2023-01-${i + 1}T00:00:00.000Z`
      }));
      
      const formatted = formatLessonsForPrompt(lessons);
      
      // Deve conter apenas as 5 primeiras (mais recentes)
      const lines = formatted.split('\n');
      const lessonLines = lines.filter(line => line.startsWith('Lição'));
      expect(lessonLines).toHaveLength(5);
    });
    
    test('deve formatar número especificado de lições', () => {
      const lessons = Array.from({ length: 10 }, (_, i) => ({
        data: `2023-01-${i + 1}`,
        tentativa: `Tentativa ${i + 1}`,
        erro: `Erro ${i + 1}`,
        regra: `Regra ${i + 1}`,
        createdAt: `2023-01-${i + 1}T00:00:00.000Z`
      }));
      
      const formatted = formatLessonsForPrompt(lessons, 3, 3);
      
      // Deve conter apenas as 3 primeiras (mais recentes)
      const lines = formatted.split('\n');
      const lessonLines = lines.filter(line => line.startsWith('Lição'));
      expect(lessonLines).toHaveLength(3);
    });
    
    test('deve ajustar maxCount se for menor que minCount', () => {
      const lessons = [
        {
          data: '2023-01-01',
          tentativa: 'Tentativa 1',
          erro: 'Erro 1',
          regra: 'Regra 1',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      const formatted = formatLessonsForPrompt(lessons, 5, 3);
      
      // Deve ajustar para usar minCount (5) mas como só tem 1 lição, deve usar 1
      const lines = formatted.split('\n');
      const lessonLines = lines.filter(line => line.startsWith('Lição'));
      expect(lessonLines).toHaveLength(1);
    });
    
    test('deve lidar com array vazio', () => {
      const formatted = formatLessonsForPrompt([]);
      expect(formatted).toBe('');
    });
    
    test('deve lidar com parâmetros inválidos', () => {
      const lessons = [
        {
          data: '2023-01-01',
          tentativa: 'Tentativa 1',
          erro: 'Erro 1',
          regra: 'Regra 1',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      // minCount < 1 deve ser ajustado para 1
      const formatted1 = formatLessonsForPrompt(lessons, 0, 5);
      expect(formatted1).toContain('Lição 1');
      
      // maxCount < minCount deve usar minCount
      const formatted2 = formatLessonsForPrompt(lessons, 5, 3);
      expect(formatted2).toContain('Lição 1');
    });
  });
});
