export type Alimento = {
  nome: string;
  porcao: string;
  kcal: number;
  p: number;
  c: number;
  g: number;
};

export type Refeicao = {
  nome: string;
  horario: string;
  itens: Alimento[];
};

export function montarCardapio(
  ob: Record<string, unknown>,
  metas: { kcal: number; proteina: number; carbo: number; gordura: number }
): Refeicao[] {
  // Geração determinística ou baseada nos parâmetros do objeto ob e metas
  const fatorKcal = (metas.kcal && metas.kcal > 0) ? metas.kcal / 2000 : 1;

  return [
    {
      nome: 'Café da Manhã',
      horario: '07:30',
      itens: [
        { nome: 'Ovo inteiro', porcao: '2 unidades', kcal: Math.round(140 * fatorKcal), p: 12, c: 1, g: 10 },
        { nome: 'Pão Integral', porcao: '2 fatias', kcal: Math.round(120 * fatorKcal), p: 6, c: 22, g: 2 },
        { nome: 'Café com leite desnatado', porcao: '200ml', kcal: Math.round(70 * fatorKcal), p: 6, c: 10, g: 1 }
      ]
    },
    {
      nome: 'Almoço',
      horario: '12:30',
      itens: [
        { nome: 'Peito de Frango Grelhado', porcao: '150g', kcal: Math.round(247 * fatorKcal), p: 46, c: 0, g: 5 },
        { nome: 'Arroz Cozido', porcao: '150g', kcal: Math.round(195 * fatorKcal), p: 4, c: 42, g: 0 },
        { nome: 'Feijão Cozido', porcao: '100g', kcal: Math.round(76 * fatorKcal), p: 5, c: 14, g: 1 },
        { nome: 'Azeite de Oliva', porcao: '10ml', kcal: Math.round(90 * fatorKcal), p: 0, c: 0, g: 10 }
      ]
    },
    {
      nome: 'Lanche da Tarde',
      horario: '16:00',
      itens: [
        { nome: 'Iogurte Natural', porcao: '170g', kcal: Math.round(100 * fatorKcal), p: 8, c: 10, g: 4 },
        { nome: 'Aveia em flocos', porcao: '30g', kcal: Math.round(110 * fatorKcal), p: 4, c: 20, g: 2 }
      ]
    },
    {
      nome: 'Jantar',
      horario: '20:00',
      itens: [
        { nome: 'Patinho Moído', porcao: '130g', kcal: Math.round(220 * fatorKcal), p: 35, c: 0, g: 8 },
        { nome: 'Batata Doce Cozida', porcao: '150g', kcal: Math.round(115 * fatorKcal), p: 2, c: 27, g: 0 },
        { nome: 'Legumes no Vapor (Brócolis e Cenoura)', porcao: '150g', kcal: Math.round(50 * fatorKcal), p: 3, c: 10, g: 1 }
      ]
    }
  ];
}
