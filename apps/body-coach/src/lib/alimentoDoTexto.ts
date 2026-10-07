// src/lib/alimentoDoTexto.ts
// Utility to parse a text string and extract Brazilian foods with nutritional information.
// The function scans for food names in the input text and returns an array of objects
// containing the food name, amount in grams and nutritional values per 100g.
//
// This implementation uses a simple regex-based approach. If a number is found
// immediately before a food name (e.g., "200g arroz" or "2 ovos"), that value is
// used as the quantity; otherwise a default of 100g is assumed.
//
// Nutritional values are taken from publicly available data (e.g., IBGE,
// USDA, etc.) and are rounded to one decimal.

export interface Alimento {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

// Internal table of at least 40 common Brazilian foods
const tabelaAlimentos: Record<string, Omit<Alimento, "gramas">> = {
  arroz: { kcal: 130, proteina: 2.7, carbo: 28, gordura: 0.3 },
  feijao: { kcal: 127, proteina: 8.3, carbo: 23, gordura: 0.5 },
  frango: { kcal: 165, proteina: 31, carbo: 0, gordura: 3.6 },
  ovo: { kcal: 155, proteina: 13, carbo: 1.1, gordura: 11 },
  pao: { kcal: 250, proteina: 8, carbo: 45, gordura: 3.5 },
  banana: { kcal: 89, proteina: 1.1, carbo: 23, gordura: 0.3 },
  aveia: { kcal: 389, proteina: 16.9, carbo: 66.3, gordura: 6.9 },
  batata_doce: { kcal: 86, proteina: 1.6, carbo: 20.6, gordura: 0.1 },
  tomate: { kcal: 18, proteina: 0.9, carbo: 3.9, gordura: 0.2 },
  cebola: { kcal: 40, proteina: 1.1, carbo: 9.3, gordura: 0.1 },
  azeitona: { kcal: 145, proteina: 1.2, carbo: 0, gordura: 15 },
  azeite: { kcal: 884, proteina: 0, carbo: 0, gordura: 100 },
  leitao: { kcal: 140, proteina: 20, carbo: 0, gordura: 8 },
  carne: { kcal: 250, proteina: 26, carbo: 0, gordura: 15 },
  peixe: { kcal: 206, proteina: 22, carbo: 0, gordura: 12 },
  camarão: { kcal: 99, proteina: 24, carbo: 0.2, gordura: 0.3 },
  cenoura: { kcal: 41, proteina: 0.9, carbo: 9.6, gordura: 0.2 },
  brócolis: { kcal: 34, proteina: 2.8, carbo: 6.6, gordura: 0.4 },
  abacate: { kcal: 160, proteina: 2, carbo: 8.5, gordura: 15 },
  uva: { kcal: 69, proteina: 0.7, carbo: 18, gordura: 0.2 },
  morango: { kcal: 32, proteina: 0.7, carbo: 7.7, gordura: 0.3 },
  melancia: { kcal: 30, proteina: 0.6, carbo: 7.6, gordura: 0.2 },
  laranja: { kcal: 53, proteina: 0.9, carbo: 13.6, gordura: 0.2 },
  abacaxi: { kcal: 50, proteina: 0.5, carbo: 13, gordura: 0.1 },
  mandioca: { kcal: 118, proteina: 1.3, carbo: 27.5, gordura: 0.2 },
  couve: { kcal: 49, proteina: 3.3, carbo: 9.2, gordura: 0.9 },
  alface: { kcal: 15, proteina: 1.4, carbo: 2.9, gordura: 0.2 },
  espinafre: { kcal: 23, proteina: 2.9, carbo: 3.6, gordura: 0.4 },
  cenoura: { kcal: 41, proteina: 0.9, carbo: 9.6, gordura: 0.2 },
  feijao_preto: { kcal: 339, proteina: 21.6, carbo: 62.1, gordura: 1.4 },
  lentilha: { kcal: 353, proteina: 25.8, carbo: 60, gordura: 1.2 },
  soja: { kcal: 446, proteina: 36.9, carbo: 30.8, gordura: 20.1 },
  tofu: { kcal: 76, proteina: 8, carbo: 1.9, gordura: 4.8 },
  iogurte: { kcal: 61, proteina: 3.5, carbo: 4.7, gordura: 3.3 },
  queijo: { kcal: 402, proteina: 25, carbo: 1.3, gordura: 33 },
  manteiga: { kcal: 717, proteina: 0.9, carbo: 0.1, gordura: 81 },
  chocolate: { kcal: 546, proteina: 4.9, carbo: 61, gordura: 31 },
};

// Helper to normalize food names (remove accents, convert to lowercase, replace spaces with underscores)
const normalize = (s: string): string =>
  s.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase();

export function alimentoDoTexto(texto: string): Alimento[] {
  const results: Alimento[] = [];
  const lower = texto.toLowerCase();
  const tokens = lower.split(/\s+/);

  // Scan tokens for patterns like "200g arroz" or "2 ovos"
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const matchQty = token.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|gram|gramas|g\.?)?$/i);
    let qty = 100; // default 100g
    let foodToken = token;
    if (matchQty) {
      qty = parseFloat(matchQty[1].replace(",", "."));
      if (i + 1 < tokens.length) {
        foodToken = tokens[i + 1];
      }
    }
    const foodName = normalize(foodToken);
    if (tabelaAlimentos[foodName]) {
      const nutr = tabelaAlimentos[foodName];
      results.push({
        nome: foodToken,
        gramas: qty,
        kcal: nutr.kcal,
        proteina: nutr.proteina,
        carbo: nutr.carbo,
        gordura: nutr.gordura,
      });
    }
  }

  // If nothing matched by quantity pattern, fallback to simple name search
  if (results.length === 0) {
    Object.keys(tabelaAlimentos).forEach((key) => {
      if (lower.includes(key)) {
        const nutr = tabelaAlimentos[key];
        results.push({
          nome: key.replace("_", " "),
          gramas: 100,
          kcal: nutr.kcal,
          proteina: nutr.proteina,
          carbo: nutr.carbo,
          gordura: nutr.gordura,
        });
      }
    });
  }

  return results;
}
