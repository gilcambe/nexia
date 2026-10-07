export interface CargaRep {
  reps: number;
  weight: number;
}

/**
 * Analisa um texto descrevendo séries, repetições e cargas de musculação.
 * 
 * Exemplos suportados:
 * - "4 x 12 .. 15/20/25/30" -> 4 séries de 12 reps com 15, 20, 25 e 30 kg
 * - "3x10 40kg" -> 3 séries de 10 reps com 40 kg cada
 * - "fiz 12 com 70" -> 1 série de 12 reps com 70 kg
 * - "12x20, 10x25" -> 12 reps com 20kg, 10 reps com 25kg
 */
export function cargasDoTexto(texto: string): CargaRep[] | null {
  if (!texto || typeof texto !== 'string') return null;
  const t = texto.trim().toLowerCase();
  if (!t) return null;

  const results: CargaRep[] = [];

  // 1. Padrão composto com múltiplas cargas progressivas: "4 x 12 .. 15/20/25/30" ou "4x12: 10/15/20/25"
  const patternProgressive = /^(\d+)\s*[xX]\s*(\d+)\s*(?:\.\.|[:\-–])\s*([\d\/\s,\.]+)/;
  const matchProg = t.match(patternProgressive);
  if (matchProg) {
    const numSets = parseInt(matchProg[1], 10);
    const reps = parseInt(matchProg[2], 10);
    const weightPart = matchProg[3];
    const weightStrs = weightPart.match(/\d+(?:[,\.]\d+)?/g);
    if (weightStrs && weightStrs.length > 0) {
      const weights = weightStrs.map(w => parseFloat(w.replace(',', '.')));
      for (let i = 0; i < numSets; i++) {
        const w = weights[i < weights.length ? i : weights.length - 1];
        results.push({ reps, weight: !isNaN(w) ? w : 0 });
      }
      return results.length > 0 ? results : null;
    }
  }

  // 2. Padrão múltiplo separado por vírgula ou "e": "12x20, 10x25" ou "12x20 e 10x25"
  if (t.includes(',') || t.includes(' e ')) {
    const parts = t.split(/,| e /);
    let validCount = 0;
    for (const part of parts) {
      const subRes = cargasDoTexto(part.trim());
      if (subRes && subRes.length > 0) {
        results.push(...subRes);
        validCount++;
      }
    }
    if (validCount > 0) {
      return results;
    }
  }

  // 3. Padrão simples repetido: "3x10 40kg" ou "3 x 10 de 40kg"
  const patternRepeat = /^(\d+)\s*[xX]\s*(\d+)(?:\s*(?:kg|quilos?|com|de|\:)?\s*(\d+(?:[,\.]\d+)?)\s*(?:kg|quilos?)?)?/;
  const matchRep = t.match(patternRepeat);
  if (matchRep && matchRep[3]) {
    const numSets = parseInt(matchRep[1], 10);
    const reps = parseInt(matchRep[2], 10);
    const weight = parseFloat(matchRep[3].replace(',', '.'));
    if (!isNaN(numSets) && !isNaN(reps) && !isNaN(weight)) {
      for (let i = 0; i < numSets; i++) {
        results.push({ reps, weight });
      }
      return results;
    }
  } else if (matchRep && !matchRep[3]) {
    const numSets = parseInt(matchRep[1], 10);
    const reps = parseInt(matchRep[2], 10);
    const weightMatch = t.match(/(?:com|peso|de)?\s*(\d+(?:[,\.]\d+)?)\s*kg/);
    const weight = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : 0;
    if (!isNaN(numSets) && !isNaN(reps)) {
      for (let i = 0; i < numSets; i++) {
        results.push({ reps, weight });
      }
      return results;
    }
  }

  // 4. Padrão único ou frase livre: "fiz 12 com 70", "12 reps 70kg", "12 x 70"
  const patternSingle = /(?:fiz|fazer)?\s*(\d+)\s*(?:reps?|x)?\s*(?:com|de)?\s*(\d+(?:[,\.]\d+)?)\s*(?:kg|quilos?)?/i;
  const matchSingle = t.match(patternSingle);
  if (matchSingle) {
    const reps = parseInt(matchSingle[1], 10);
    const weight = matchSingle[2] ? parseFloat(matchSingle[2].replace(',', '.')) : 0;
    if (!isNaN(reps)) {
      results.push({ reps, weight: !isNaN(weight) ? weight : 0 });
      return results;
    }
  }

  // Fallback geral: extrai quaisquer pares de números
  const allNums = t.match(/\d+(?:[,\.]\d+)?/g);
  if (allNums && allNums.length >= 2) {
    if (allNums.length === 2) {
      return [{ reps: parseFloat(allNums[0]), weight: parseFloat(allNums[1].replace(',', '.')) }];
    }
  }

  return null;
}
