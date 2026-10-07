export interface CardioAtividade {
  tipo: string;
  minutos: number;
  distanciaKm?: number;
  kcal?: number;
  velocidadeKmh?: number;
}

export function cardioDoTexto(texto: string): CardioAtividade[] {
  if (!texto || typeof texto !== 'string') {
    return [];
  }

  const textoLower = texto.toLowerCase().trim();

  // Caso específico exato de teste / ex: "esteira 10:19 1.02 km 71.8 kcal 6.0 km/h"
  // Ou separação por vírgula / conjunções ("mais", "e") se houver múltiplas partes
  // Vamos primeiro tentar fatiar por separadores comuns se houver múltiplos trechos
  const partes = textoLower.split(/,|\be\b|\bmais\b/);
  
  const resultados: CardioAtividade[] = [];

  for (const parteRaw of partes) {
    const parte = parteRaw.trim();
    if (!parte) continue;

    // Detectar tipo de exercício
    let tipo = 'Cardio';
    if (/esteira|treadmill/.test(parte)) {
      tipo = 'Esteira';
    } else if (/escada|stair|step/.test(parte)) {
      tipo = 'Escada';
    } else if (/bike|bicicleta|ciclismo|pedal/.test(parte)) {
      tipo = 'Bike';
    } else if (/eliptico|elíptico|elliptical/.test(parte)) {
      tipo = 'Elíptico';
    } else if (/corrida|correr|run/.test(parte)) {
      tipo = 'Corrida';
    } else if (/caminhada|caminhar|walk/.test(parte)) {
      tipo = 'Caminhada';
    } else if (/natacao|natação|swim/.test(parte)) {
      tipo = 'Natação';
    } else if (/remo|row/.test(parte)) {
      tipo = 'Remo';
    } else {
      // Se tivermos alguma menção genérica ou se for a primeira palavra/termo
      const palavras = parte.split(/\s+/);
      if (palavras.length > 0 && !/^\d+$/.test(palavras[0])) {
        // Capitalizar primeira letra
        const t = palavras[0];
        tipo = t.charAt(0).toUpperCase() + t.slice(1);
      }
    }

    // Extrair minutos / tempo
    // Ex: "30 min", "10 min", "10:19" (10 minutos e 19 segundos ou 10 min 19 s)
    let minutos = 0;
    
    // Match formato MM:SS (ex: 10:19)
    const matchMinSec = parte.match(/(\d+):(\d{2})/);
    if (matchMinSec) {
      const m = parseInt(matchMinSec[1], 10);
      const s = parseInt(matchMinSec[2], 10);
      minutos = parseFloat((m + s / 60).toFixed(2));
    } else {
      // Match minutos ex: "30 min", "30 minutos", "30min"
      const matchMin = parte.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos|m\b)/);
      if (matchMin) {
        minutos = parseFloat(matchMin[1].replace(',', '.'));
      } else {
        // Procurar por número solto seguido de tempo se houver contexto
        const matchNumMin = parte.match(/(?:durou|por|fazer|fiz)?\s*(\d+(?:[.,]\d+)?)\s*(?:min|m)/);
        if (matchNumMin) {
          minutos = parseFloat(matchNumMin[1].replace(',', '.'));
        }
      }
    }

    // Extrair distância em km
    // Ex: "1.02 km", "1,02km", "2.5 quilômetros"
    let distanciaKm: number | undefined;
    const matchKm = parte.match(/(\d+(?:[.,]\d+)?)\s*(?:km|quilometros|quilômetros|k\b)/);
    if (matchKm) {
      distanciaKm = parseFloat(matchKm[1].replace(',', '.'));
    }

    // Extrair calorias (kcal)
    // Ex: "71.8 kcal", "71,8 cal", "500kcal"
    let kcal: number | undefined;
    const matchKcal = parte.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|calorias|cal\b)/);
    if (matchKcal) {
      kcal = parseFloat(matchKcal[1].replace(',', '.'));
    }

    // Extrair velocidade (km/h) ou faixa de velocidade
    // Ex: "6.0 km/h", "velocidade entre 7 e 10", "a 8km/h"
    let velocidadeKmh: number | undefined;
    const matchVelKmH = parte.match(/(\d+(?:[.,]\d+)?)\s*(?:km\/h|kmh|por hora)/);
    if (matchVelKmH) {
      velocidadeKmh = parseFloat(matchVelKmH[1].replace(',', '.'));
    } else {
      // Faixa de velocidade: "entre 7 e 10" ou "de 7 a 10"
      const matchFaixaVel = parte.match(/(?:velocidade|a)?\s*(?:entre|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:e|a|-)\s*(\d+(?:[.,]\d+)?)\s*(?:km\/h|kmh)?/);
      if (matchFaixaVel && matchFaixaVel[1] && matchFaixaVel[2]) {
        const v1 = parseFloat(matchFaixaVel[1].replace(',', '.'));
        const v2 = parseFloat(matchFaixaVel[2].replace(',', '.'));
        // Média da faixa para velocidadeKmh ou valor representativo
        velocidadeKmh = parseFloat(((v1 + v2) / 2).toFixed(1));
      }
    }

    // Se a parte tiver dados válidos (pelo menos minutos ou distância ou kcal ou velocidade), adiciona
    if (minutos > 0 || distanciaKm !== undefined || kcal !== undefined || velocidadeKmh !== undefined || parte.length > 3) {
      resultados.push({
        tipo,
        minutos: minutos || 0,
        ...(distanciaKm !== undefined ? { distanciaKm } : {}),
        ...(kcal !== undefined ? { kcal } : {}),
        ...(velocidadeKmh !== undefined ? { velocidadeKmh } : {})
      });
    }
  }

  // Se nada foi encontrado mas o texto tem alguma coisa, retorna um genérico
  if (resultados.length === 0 && texto.trim().length > 0) {
    resultados.push({
      tipo: 'Cardio',
      minutos: 0
    });
  }

  return resultados;
}
