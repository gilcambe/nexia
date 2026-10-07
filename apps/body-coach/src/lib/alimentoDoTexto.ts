export interface Nutriente {
  gramas: number;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

export interface AlimentoInfo {
  nome: string;
  nutrientes: Nutriente;
}

export function alimentoDoTexto(texto: string): AlimentoInfo[] {
  if (!texto || !texto.trim()) {
    return [];
  }

  const lower = texto.toLowerCase();
  const alimentos: AlimentoInfo[] = [];

  // Arroz branco (100g)
  if (lower.includes('arroz')) {
    alimentos.push({
      nome: 'Arroz branco',
      nutrientes: { gramas: 100, kcal: 130, proteina: 2.7, carbo: 28, gordura: 0.3 }
    });
  }

  // Feijão preto (100g)
  if (lower.includes('feijão')) {
    alimentos.push({
      nome: 'Feijão preto',
      nutrientes: { gramas: 100, kcal: 341, proteina: 21, carbo: 60, gordura: 1.5 }
    });
  }

  // Frango grelhado (100g)
  if (lower.includes('frango') && !lower.includes('carne') || lower.includes('peito de frango')) {
    alimentos.push({
      nome: 'Frango grelhado',
      nutrientes: { gramas: 100, kcal: 165, proteina: 31, carbo: 0, gordura: 3.6 }
    });
  }

  // Ovo (1 unid média)
  if (lower.includes('ovo')) {
    alimentos.push({
      nome: 'Ovo',
      nutrientes: { gramas: 50, kcal: 78, proteina: 6.3, carbo: 0.6, gordura: 5.3 }
    });
  }

  // Pão francês (1 uni média)
  if (lower.includes('pão francês') || lower.includes('pão')) {
    alimentos.push({
      nome: 'Pão francês',
      nutrientes: { gramas: 40, kcal: 90, proteina: 3, carbo: 15, gordura: 1 }
    });
  }

  // Banana (1 unidade média)
  if (lower.includes('banana')) {
    alimentos.push({
      nome: 'Banana',
      nutrientes: { gramas: 100, kcal: 89, proteina: 1.1, carbo: 23, gordura: 0.3 }
    });
  }

  // Aveia (100g)
  if (lower.includes('aveia')) {
    alimentos.push({
      nome: 'Aveia',
      nutrientes: { gramas: 100, kcal: 389, proteina: 16.9, carbo: 66.3, gordura: 6.9 }
    });
  }

  // Batata doce (100g)
  if (lower.includes('batata doce')) {
    alimentos.push({
      nome: 'Batata doce',
      nutrientes: { gramas: 100, kcal: 86, proteina: 1.6, carbo: 20, gordura: 0.1 }
    });
  }

  // Alface (100g)
  if (lower.includes('alface')) {
    alimentos.push({
      nome: 'Alface',
      nutrientes: { gramas: 100, kcal: 12, proteina: 1.1, carbo: 2.5, gordura: 0.2 }
    });
  }

  // Tomate (100g)
  if (lower.includes('tomate')) {
    alimentos.push({
      nome: 'Tomate',
      nutrientes: { gramas: 100, kcal: 18, proteina: 0.9, carbo: 3.9, gordura: 0.2 }
    });
  }

  // Carne bovina (100g)
  if (lower.includes('carne') && !lower.includes('frango')) {
    alimentos.push({
      nome: 'Carne bovina',
      nutrientes: { gramas: 100, kcal: 250, proteina: 26, carbo: 0, gordura: 15 }
    });
  }

  // Lentilha (100g)
  if (lower.includes('lentilha')) {
    alimentos.push({
      nome: 'Lentilha',
      nutrientes: { gramas: 100, kcal: 116, proteina: 9, carbo: 20, gordura: 0.4 }
    });
  }

  // Leite (200ml)
  if (lower.includes('leite')) {
    alimentos.push({
      nome: 'Leite',
      nutrientes: { gramas: 200, kcal: 120, proteina: 6.4, carbo: 10, gordura: 6 }
    });
  }

  // Iogurte natural (150g)
  if (lower.includes('iogurte')) {
    alimentos.push({
      nome: 'Iogurte natural',
      nutrientes: { gramas: 150, kcal: 80, proteina: 4.5, carbo: 6, gordura: 2 }
    });
  }

  // Manteiga de amendoim (20g)
  if (lower.includes('amendoim') || lower.includes('manteiga de amendoim')) {
    alimentos.push({
      nome: 'Manteiga de amendoim',
      nutrientes: { gramas: 20, kcal: 113, proteina: 4, carbo: 3, gordura: 10 }
    });
  }

  // Queijo mussarela (30g)
  if (lower.includes('queijo')) {
    alimentos.push({
      nome: 'Queijo mussarela',
      nutrientes: { gramas: 30, kcal: 85, proteina: 6, carbo: 0.6, gordura: 6.5 }
    });
  }

  // Laranja (1 unidade média)
  if (lower.includes('laranja')) {
    alimentos.push({
      nome: 'Laranja',
      nutrientes: { gramas: 130, kcal: 47, proteina: 0.9, carbo: 11.8, gordura: 0.1 }
    });
  }

  // Maçã (1 unidade média)
  if (lower.includes('maçã')) {
    alimentos.push({
      nome: 'Maçã',
      nutrientes: { gramas: 150, kcal: 78, proteina: 0.4, carbo: 20, gordura: 0.3 }
    });
  }

  // Uva (100g)
  if (lower.includes('uva')) {
    alimentos.push({
      nome: 'Uva',
      nutrientes: { gramas: 100, kcal: 69, proteina: 0.6, carbo: 18, gordura: 0.4 }
    });
  }

  // Abacate (100g)
  if (lower.includes('abacate')) {
    alimentos.push({
      nome: 'Abacate',
      nutrientes: { gramas: 100, kcal: 160, proteina: 2, carbo: 9, gordura: 15 }
    });
  }

  // Manga (100g)
  if (lower.includes('manga')) {
    alimentos.push({
      nome: 'Manga',
      nutrientes: { gramas: 100, kcal: 60, proteina: 0.8, carbo: 15, gordura: 0.4 }
    });
  }

  // Berinjela (100g)
  if (lower.includes('berinjela')) {
    alimentos.push({
      nome: 'Berinjela',
      nutrientes: { gramas: 100, kcal: 24, proteina: 1, carbo: 6, gordura: 0.3 }
    });
  }

  // Pepino (100g)
  if (lower.includes('pepino')) {
    alimentos.push({
      nome: 'Pepino',
      nutrientes: { gramas: 100, kcal: 16, proteina: 0.8, carbo: 3.6, gordura: 0.1 }
    });
  }

  // Cenoura (100g)
  if (lower.includes('cenoura')) {
    alimentos.push({
      nome: 'Cenoura',
      nutrientes: { gramas: 100, kcal: 41, proteina: 0.9, carbo: 9.6, gordura: 0.2 }
    });
  }

  // Brócolis (100g)
  if (lower.includes('brócolis') || lower.includes('broccoli')) {
    alimentos.push({
      nome: 'Brócolis',
      nutrientes: { gramas: 100, kcal: 34, proteina: 2.8, carbo: 6.6, gordura: 0.4 }
    });
  }

  // Espinafre (100g)
  if (lower.includes('espinafre')) {
    alimentos.push({
      nome: 'Espinafre',
      nutrientes: { gramas: 100, kcal: 23, proteina: 2.9, carbo: 3.6, gordura: 0.4 }
    });
  }

  // Ervilha (100g)
  if (lower.includes('ervilha')) {
    alimentos.push({
      nome: 'Ervilha',
      nutrientes: { gramas: 100, kcal: 81, proteina: 5.4, carbo: 14, gordura: 0.4 }
    });
  }

  // Milho (100g)
  if (lower.includes('milho')) {
    alimentos.push({
      nome: 'Milho',
      nutrientes: { gramas: 100, kcal: 86, proteina: 3.2, carbo: 18, gordura: 1.2 }
    });
  }

  // Batata branca (100g)
  if (lower.includes('batata') && !lower.includes('doce')) {
    alimentos.push({
      nome: 'Batata branca',
      nutrientes: { gramas: 100, kcal: 77, proteina: 2, carbo: 18, gordura: 0.1 }
    });
  }

  // Soja (100g)
  if (lower.includes('soja')) {
    alimentos.push({
      nome: 'Soja',
      nutrientes: { gramas: 100, kcal: 446, proteina: 36.5, carbo: 30, gordura: 20 }
    });
  }

  // Quinoa (100g)
  if (lower.includes('quinoa')) {
    alimentos.push({
      nome: 'Quinoa',
      nutrientes: { gramas: 100, kcal: 222, proteina: 4.4, carbo: 39, gordura: 3.9 }
    });
  }

  // Aveia em flocos (100g) - already covered
  // Farofa (100g)
  if (lower.includes('farofa')) {
    alimentos.push({
      nome: 'Farofa',
      nutrientes: { gramas: 100, kcal: 450, proteina: 5, carbo: 50, gordura: 20 }
    });
  }

  // Pizza (1 fatia)
  if (lower.includes('pizza')) {
    alimentos.push({
      nome: 'Pizza',
      nutrientes: { gramas: 100, kcal: 280, proteina: 12, carbo: 30, gordura: 10 }
    });
  }

  // Hambúrguer (1 unidade)
  if (lower.includes('hambúrguer') || lower.includes('hamburger')) {
    alimentos.push({
      nome: 'Hambúrguer',
      nutrientes: { gramas: 100, kcal: 250, proteina: 15, carbo: 25, gordura: 12 }
    });
  }

  // Sushi (6 unidades)
  if (lower.includes('sushi')) {
    alimentos.push({
      nome: 'Sushi',
      nutrientes: { gramas: 100, kcal: 200, proteina: 6, carbo: 28, gordura: 8 }
    });
  }

  // Feijoada (porção)
  if (lower.includes('feijoada')) {
    alimentos.push({
      nome: 'Feijoada',
      nutrientes: { gramas: 150, kcal: 280, proteina: 14, carbo: 15, gordura: 20 }
    });
  }

  // Churrasco (100g)
  if (lower.includes('pork') || lower.includes('costela') || lower.includes('linguiça')) {
    alimentos.push({
      nome: 'Churrasco',
      nutrientes: { gramas: 100, kcal: 280, proteina: 20, carbo: 2, gordura: 20 }
    });
  }

  // Batata frita (100g)
  if (lower.includes('batata frita')) {
    alimentos.push({
      nome: 'Batata frita',
      nutrientes: { gramas: 100, kcal: 312, proteina: 3.5, carbo: 41, gordura: 15 }
    });
  }

  // refrigerante (350ml)
  if (lower.includes('refrigerante') || lower.includes('coca') || lower.includes('pepsi')) {
    alimentos.push({
      nome: 'Refrigerante',
      nutrientes: { gramas: 350, kcal: 140, proteina: 0, carbo: 35, gordura: 0 }
    });
  }

  // Cerveja (350ml)
  if (lower.includes('cerveja')) {
    alimentos.push({
      nome: 'Cerveja',
      nutrientes: { gramas: 350, kcal: 150, proteina: 1.5, carbo: 13, gordura: 0 }
    });
  }

  // Chocolate ao leite (20g)
  if (lower.includes('chocolate') && !lower.includes('cacau')) {
    alimentos.push({
      nome: 'Chocolate ao leite',
      nutrientes: { gramas: 20, kcal: 110, proteina: 1.5, carbo: 13, gordura: 7 }
    });
  }

  // Açúcar (10g)
  if (lower.includes('açúcar')) {
    alimentos.push({
      nome: 'Açúcar',
      nutrientes: { gramas: 10, kcal: 40, proteina: 0, carbo: 10, gordura: 0 }
    });
  }

  // Sal (1g)
  if (lower.includes('sal')) {
    alimentos.push({
      nome: 'Sal',
      nutrientes: { gramas: 1, kcal: 0, proteina: 0, carbo: 0, gordura: 0 }
    });
  }

  return alimentos;
}
