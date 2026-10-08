export interface AlimentoItem {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

export function alimentoDoTexto(texto: string): AlimentoItem[] {
  if (!texto || !texto.trim()) {
    return [];
  }

  const lower = texto.toLowerCase();
  const itens: AlimentoItem[] = [];

  const add = (nome: string, g: number, kcal: number, p: number, c: number, f: number) => {
    itens.push({ nome, gramas: g, kcal, proteina: p, carbo: c, gordura: f });
  };

  if (/\barroz\b/.test(lower)) {
    add('Arroz branco', 100, 130, 2.7, 28, 0.3);
  }
  if (/\bfeijão\b|\bfeijao\b/.test(lower)) {
    add('Feijão preto', 100, 341, 21, 60, 1.5);
  }
  if (/\bfrango\b/.test(lower) && !/\bcarne\b/.test(lower)) {
    add('Frango grelhado', 100, 165, 31, 0, 3.6);
  }
  if (/\bovo\b|\bovos\b/.test(lower)) {
    add('Ovo', 50, 78, 6.3, 0.6, 5.3);
  }
  if (/\bpão\b|\bpao\b/.test(lower)) {
    add('Pão francês', 40, 90, 3, 15, 1);
  }
  if (/\bbanana\b/.test(lower)) {
    add('Banana', 100, 89, 1.1, 23, 0.3);
  }
  if (/\baveia\b/.test(lower)) {
    add('Aveia', 100, 389, 16.9, 66.3, 6.9);
  }
  if (/\bbatata\s+doce\b/.test(lower)) {
    add('Batata doce', 100, 86, 1.6, 20, 0.1);
  }
  if (/\balface\b/.test(lower)) {
    add('Alface', 100, 12, 1.1, 2.5, 0.2);
  }
  if (/\btomate\b/.test(lower)) {
    add('Tomate', 100, 18, 0.9, 3.9, 0.2);
  }
  if (/\bcarne\b/.test(lower) && !/\bfrango\b/.test(lower)) {
    add('Carne bovina', 100, 250, 26, 0, 15);
  }
  if (/\blentilha\b/.test(lower)) {
    add('Lentilha', 100, 116, 9, 20, 0.4);
  }
  if (/\bleite\b/.test(lower)) {
    add('Leite', 200, 120, 6.4, 10, 6);
  }
  if (/\biogurte\b/.test(lower)) {
    add('Iogurte natural', 150, 80, 4.5, 6, 2);
  }
  if (/\bamendoim\b/.test(lower)) {
    add('Manteiga de amendoim', 20, 113, 4, 3, 10);
  }
  if (/\bqueijo\b/.test(lower)) {
    add('Queijo mussarela', 30, 85, 6, 0.6, 6.5);
  }
  if (/\blaranja\b/.test(lower)) {
    add('Laranja', 130, 47, 0.9, 11.8, 0.1);
  }
  if (/\bmaçã\b|\bmaca\b/.test(lower)) {
    add('Maçã', 150, 78, 0.4, 20, 0.3);
  }
  if (/\buva\b/.test(lower)) {
    add('Uva', 100, 69, 0.6, 18, 0.4);
  }
  if (/\babacate\b/.test(lower)) {
    add('Abacate', 100, 160, 2, 9, 15);
  }
  if (/\bmanga\b/.test(lower)) {
    add('Manga', 100, 60, 0.8, 15, 0.4);
  }
  if (/\bberinjela\b/.test(lower)) {
    add('Berinjela', 100, 24, 1, 6, 0.3);
  }
  if (/\bpepino\b/.test(lower)) {
    add('Pepino', 100, 16, 0.8, 3.6, 0.1);
  }
  if (/\bcenoura\b/.test(lower)) {
    add('Cenoura', 100, 41, 0.9, 9.6, 0.2);
  }
  if (/\bbrócolis\b|\bbrocolis\b|\bbroccoli\b/.test(lower)) {
    add('Brócolis', 100, 34, 2.8, 6.6, 0.4);
  }
  if (/\bespinafre\b/.test(lower)) {
    add('Espinafre', 100, 23, 2.9, 3.6, 0.4);
  }
  if (/\bervilha\b/.test(lower)) {
    add('Ervilha', 100, 81, 5.4, 14, 0.4);
  }
  if (/\bmilho\b/.test(lower)) {
    add('Milho', 100, 86, 3.2, 18, 1.2);
  }
  if (/\bbatata\b/.test(lower) && !/\bbatata\s+doce\b/.test(lower) && !/\bfrita\b/.test(lower)) {
    add('Batata branca', 100, 77, 2, 18, 0.1);
  }
  if (/\bsoja\b/.test(lower)) {
    add('Soja', 100, 446, 36.5, 30, 20);
  }
  if (/\bquinoa\b/.test(lower)) {
    add('Quinoa', 100, 222, 4.4, 39, 3.9);
  }
  if (/\bfarofa\b/.test(lower)) {
    add('Farofa', 100, 450, 5, 50, 20);
  }
  if (/\bpizza\b/.test(lower)) {
    add('Pizza', 100, 280, 12, 30, 10);
  }
  if (/\bhambúrguer\b|\bhamburguer\b/.test(lower)) {
    add('Hambúrguer', 100, 250, 15, 25, 12);
  }
  if (/\bsushi\b/.test(lower)) {
    add('Sushi', 100, 200, 6, 28, 8);
  }
  if (/\bfeijoada\b/.test(lower)) {
    add('Feijoada', 150, 280, 14, 15, 20);
  }
  if (/\bcostela\b|\blinguiça\b|\bchurrasco\b/.test(lower)) {
    add('Churrasco', 100, 280, 20, 2, 20);
  }
  if (/\bbatata\s+frita\b/.test(lower)) {
    add('Batata frita', 100, 312, 3.5, 41, 15);
  }
  if (/\brefrigerante\b|\bcoca\b|\bpepsi\b/.test(lower)) {
    add('Refrigerante', 350, 140, 0, 35, 0);
  }
  if (/\bcerveja\b/.test(lower)) {
    add('Cerveja', 350, 150, 1.5, 13, 0);
  }
  if (/\bchocolate\b/.test(lower)) {
    add('Chocolate ao leite', 20, 110, 1.5, 13, 7);
  }
  if (/\b(açúcar|acucar)\b/.test(lower)) {
    add('Açúcar', 10, 40, 0, 10, 0);
  }
  if (/\bsal\b/.test(lower)) {
    add('Sal', 1, 0, 0, 0, 0);
  }

  return itens;
}
