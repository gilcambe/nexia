import { test, expect } from '@playwright/test';
import { guias, GuiasMap } from './guias'; // Assumindo que guias.ts estará no mesmo diretório

// Dados dos cards para comparação (devem corresponder aos usados em index.tsx)
const cardsData = [
  { id: 'painel', title: 'Painel' },
  { id: 'cortex', title: 'Cortex' },
  { id: 'maquinas', title: 'Máquinas' },
  { id: 'ia-vagas', title: 'IA Vagas' },
  { id: 'saude', title: 'Saúde' },
  { id: 'avisos', title: 'Avisos' },
  { id: 'pedidos', title: 'Pedidos' },
  { id: 'mais', title: 'Mais' },
  { id: 'sites-clientes', title: 'Sites de Clientes' },
  { id: 'lote', title: 'Lote' },
  { id: 'moldes', title: 'Moldes' },
];

test.describe('Validação de Guias da Central', () => {
  test('Todos os cards da Central devem ter uma entrada correspondente em guias.ts', () => {
    const cardIds = cardsData.map(card => card.id);
    const guideIds = Object.keys(guias);

    // Verifica se todos os cardIds existem como chaves em guias
    cardIds.forEach(cardId => {
      expect(guideIds).toContain(cardId, `Card com id "${cardId}" não possui entrada em guias.ts`);
    });

    // Opcional: Verifica se não há guias extras em guias.ts que não correspondam a nenhum card
    guideIds.forEach(guideId => {
      expect(cardIds).toContain(guideId, `Guia com id "${guideId}" em guias.ts não corresponde a nenhum card.`);
    });
  });

  test('Cada guia em guias.ts deve ter título e conteúdo', () => {
    Object.entries(guias).forEach(([id, guia]) => {
      expect(guia).toHaveProperty('title', expect.any(String), `Guia "${id}" não possui a propriedade 'title' ou ela não é uma string.`);
      expect(guia.title).not.toBe('', `Guia "${id}" possui 'title' vazio.`);
      expect(guia).toHaveProperty('content', expect.any(String), `Guia "${id}" não possui a propriedade 'content' ou ela não é uma string.`);
      expect(guia.content).not.toBe('', `Guia "${id}" possui 'content' vazio.`);
    });
  });

  // Adicione mais testes conforme necessário, por exemplo, para verificar o conteúdo específico dos guias
});

// Definição do tipo GuiasMap e dos dados de guias (deve ser exportado de guias.ts)
// Se guias.ts for um arquivo separado, o type e os dados abaixo devem estar lá.
// Aqui apenas para o teste compilar.
interface Guia {
  title: string;
  content: string;
}

interface GuiasMap {
  [key: string]: Guia;
}

// Exemplo de como 'guias' seria definido em guias.ts (precisa ser exportado)
/*
export const guias: GuiasMap = {
  painel: { title: 'Como usar o Painel', content: '...' },
  cortex: { title: 'Como usar o Cortex', content: '...' },
  // ... outros guias
};
*/

