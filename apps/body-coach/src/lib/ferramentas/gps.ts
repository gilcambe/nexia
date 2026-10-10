// Corrida/caminhada com o GPS do celular: distância (fórmula de Haversine), ritmo e gasto estimado.
export interface Ponto { lat: number; lon: number; t: number; acc?: number }

export function distanciaKm(a: Ponto, b: Ponto): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Soma o percurso ignorando pontos imprecisos (> 35 m) e saltos impossíveis (> 30 km/h a pé).
export function percurso(pontos: Ponto[]): number {
  let km = 0;
  let ultimo: Ponto | null = null;
  for (const p of pontos) {
    if (p.acc != null && p.acc > 35) continue;
    if (ultimo) {
      const d = distanciaKm(ultimo, p);
      const h = (p.t - ultimo.t) / 3600000;
      if (d < 0.003) continue; // parado: ruído do GPS
      if (h > 0 && d / h > 30) continue;
      km += d;
    }
    ultimo = p;
  }
  return Math.round(km * 1000) / 1000;
}

// Gasto aproximado: corrida ~1 kcal/kg/km, caminhada ~0,55 kcal/kg/km.
export function kcalPercurso(km: number, pesoKg: number, tipo: 'corrida' | 'caminhada' | 'bike'): number {
  const fator = tipo === 'corrida' ? 1 : tipo === 'bike' ? 0.3 : 0.55;
  return Math.round(km * (pesoKg || 70) * fator);
}
