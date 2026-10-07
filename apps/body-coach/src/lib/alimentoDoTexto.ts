export interface NutrientesTotais {
  calorias: number;
  proteinas: number;
  carboidratos: number;
  gorduras: number;
}

export function alimentoDoTexto(texto: string): NutrientesTotais {
  if (!texto || !texto.trim()) {
    return { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0 };
  }

  const lower = texto.toLowerCase();
  let calorias = 250;
  let proteinas = 15;
  let carboidratos = 30;
  let gorduras = 8;

  if (lower.includes('frango') || lower.includes('carne') || lower.includes('ovo')) {
    calorias += 150;
    proteinas += 25;
    gorduras += 5;
  }
  if (lower.includes('arroz') || lower.includes('batata') || lower.includes('massa') || lower.includes('pão')) {
    calorias += 200;
    carboidratos += 40;
  }
  if (lower.includes('salada') || lower.includes('alface') || lower.includes('tomate')) {
    calorias += 30;
    carboidratos += 5;
    proteinas += 1;
  }
  if (lower.includes('chocolate') || lower.includes('doce') || lower.includes('açúcar')) {
    calorias += 350;
    carboidratos += 50;
    gorduras += 15;
  }

  return {
    calorias,
    proteinas: Math.round(proteinas * 10) / 10,
    carboidratos: Math.round(carboidratos * 10) / 10,
    gorduras: Math.round(gorduras * 10) / 10,
  };
}
