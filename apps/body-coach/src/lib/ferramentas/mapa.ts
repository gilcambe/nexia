// Academias, parques, pistas e aparelhos ao ar livre perto do aluno, pelo OpenStreetMap (Overpass, grátis).
import { distanciaKm } from './gps';

export type TipoLugar = 'academia' | 'parque' | 'pista' | 'aparelhos' | 'piscina' | 'quadra';
export interface Lugar { id: string; nome: string; tipo: TipoLugar; lat: number; lon: number; km: number; endereco?: string; horario?: string; site?: string; telefone?: string }

export const TIPOS_LUGAR: { id: TipoLugar; nome: string; icone: string }[] = [
  { id: 'academia', nome: 'Academias', icone: 'ri-boxing-line' },
  { id: 'parque', nome: 'Parques', icone: 'ri-tree-line' },
  { id: 'aparelhos', nome: 'Aparelhos ao ar livre', icone: 'ri-run-line' },
  { id: 'pista', nome: 'Pistas', icone: 'ri-route-line' },
  { id: 'quadra', nome: 'Quadras', icone: 'ri-basketball-line' },
  { id: 'piscina', nome: 'Piscinas', icone: 'ri-drop-line' },
];

export const SERVIDORES_OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export function consultaOverpass(lat: number, lon: number, raioM: number): string {
  const a = `(around:${Math.round(raioM)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  return `[out:json][timeout:20];(
nwr["leisure"="fitness_centre"]${a};nwr["amenity"="gym"]${a};nwr["sport"="fitness"]${a};
nwr["leisure"="park"]["name"]${a};nwr["leisure"="fitness_station"]${a};
nwr["leisure"="track"]${a};nwr["leisure"="pitch"]["name"]${a};nwr["leisure"="sports_centre"]${a};
nwr["leisure"="swimming_pool"]["access"!="private"]["name"]${a};
);out center tags 150;`;
}

interface ElementoOsm { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function tipoDe(t: Record<string, string>): TipoLugar | null {
  if (t.leisure === 'fitness_centre' || t.amenity === 'gym' || t.sport === 'fitness' || t.leisure === 'sports_centre') return 'academia';
  if (t.leisure === 'fitness_station') return 'aparelhos';
  if (t.leisure === 'track') return 'pista';
  if (t.leisure === 'swimming_pool') return 'piscina';
  if (t.leisure === 'pitch') return 'quadra';
  if (t.leisure === 'park') return 'parque';
  return null;
}

const NOME_PADRAO: Record<TipoLugar, string> = { academia: 'Academia', parque: 'Parque', pista: 'Pista de corrida', aparelhos: 'Academia ao ar livre', piscina: 'Piscina', quadra: 'Quadra' };

export function lerLugares(json: { elements?: ElementoOsm[] }, lat: number, lon: number): Lugar[] {
  const vistos = new Set<string>();
  const out: Lugar[] = [];
  for (const e of json.elements ?? []) {
    const t = e.tags ?? {};
    const tipo = tipoDe(t);
    const la = e.lat ?? e.center?.lat;
    const lo = e.lon ?? e.center?.lon;
    if (!tipo || la == null || lo == null) continue;
    const nome = t.name || NOME_PADRAO[tipo];
    const chave = `${tipo}|${nome}|${la.toFixed(3)}|${lo.toFixed(3)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const endereco = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ') || undefined;
    out.push({ id: `${e.type}/${e.id}`, nome, tipo, lat: la, lon: lo, km: distanciaKm({ lat, lon }, { lat: la, lon: lo }), endereco, horario: t.opening_hours, site: t.website || t['contact:website'], telefone: t.phone || t['contact:phone'] });
  }
  return out.sort((a, b) => a.km - b.km);
}

export async function buscarLugares(lat: number, lon: number, raioM = 3000): Promise<Lugar[]> {
  const q = consultaOverpass(lat, lon, raioM);
  let ultimoErro: unknown = null;
  for (const url of SERVIDORES_OVERPASS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return lerLugares(await r.json(), lat, lon);
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Mapa indisponível agora.');
}

export const linkRota = (l: { lat: number; lon: number }) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}`;
export const linkOsm = (l: { lat: number; lon: number }) => `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=17/${l.lat}/${l.lon}`;
export function mapaEmbutido(lat: number, lon: number, raioKm: number, marcador?: { lat: number; lon: number }): string {
  const dLat = raioKm / 111;
  const dLon = raioKm / (111 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(5)).join(',');
  const m = marcador ?? { lat, lon };
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${m.lat.toFixed(5)},${m.lon.toFixed(5)}`;
}
