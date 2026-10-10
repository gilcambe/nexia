// Importa treino do relógio: arquivos .GPX e .TCX que Garmin Connect, Strava, Polar Flow, Coros e Zepp exportam.
// Lido no próprio celular (texto), sem servidor e sem custo.
import { percurso, type Ponto } from './gps';

export interface Atividade {
  nome: string;
  tipo: string;
  inicio: string; // ISO
  minutos: number;
  km: number;
  fcMedia: number | null;
  fcMaxima: number | null;
  kcal: number | null;
  pontos: number;
}

const num = (s: string | undefined) => (s == null ? NaN : Number(s));
function tudo(re: RegExp, txt: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = r.exec(txt))) out.push(m);
  return out;
}
function fc(lista: number[]): { media: number | null; maxima: number | null } {
  const v = lista.filter((x) => x > 25 && x < 240);
  if (!v.length) return { media: null, maxima: null };
  return { media: Math.round(v.reduce((a, b) => a + b, 0) / v.length), maxima: Math.max(...v) };
}
function traduzTipo(t: string): string {
  const s = t.toLowerCase();
  if (/run|corr/.test(s)) return 'Corrida';
  if (/bik|cycl|ride|pedal/.test(s)) return 'Bike';
  if (/walk|hik|camin/.test(s)) return 'Caminhada';
  if (/swim|nata/.test(s)) return 'Natação';
  if (/strength|train|muscul/.test(s)) return 'Musculação';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Atividade';
}

export function lerGpx(txt: string): Atividade {
  const pts = tudo(/<trkpt\b[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/, txt);
  const pontos: Ponto[] = [];
  const bpms: number[] = [];
  for (const m of pts) {
    const t = /<time>([^<]+)<\/time>/.exec(m[3])?.[1];
    pontos.push({ lat: num(m[1]), lon: num(m[2]), t: t ? Date.parse(t) : 0 });
    const hr = /<(?:\w+:)?hr>(\d+)<\/(?:\w+:)?hr>/.exec(m[3])?.[1];
    if (hr) bpms.push(Number(hr));
  }
  const tempos = pontos.map((p) => p.t).filter((t) => t > 0);
  const minutos = tempos.length > 1 ? (Math.max(...tempos) - Math.min(...tempos)) / 60000 : 0;
  const nome = /<trk>[\s\S]*?<name>([^<]+)<\/name>/.exec(txt)?.[1] ?? /<name>([^<]+)<\/name>/.exec(txt)?.[1] ?? 'Atividade importada';
  const tipo = /<trk>[\s\S]*?<type>([^<]+)<\/type>/.exec(txt)?.[1] ?? nome;
  const f = fc(bpms);
  return {
    nome: nome.trim(), tipo: traduzTipo(tipo), inicio: new Date(tempos.length ? Math.min(...tempos) : Date.now()).toISOString(),
    minutos: Math.round(minutos), km: percurso(pontos), fcMedia: f.media, fcMaxima: f.maxima, kcal: null, pontos: pontos.length,
  };
}

export function lerTcx(txt: string): Atividade {
  const sport = /<Activity\b[^>]*Sport="([^"]+)"/.exec(txt)?.[1] ?? '';
  const voltas = tudo(/<Lap\b[^>]*StartTime="([^"]+)"[^>]*>([\s\S]*?)<\/Lap>/, txt);
  let seg = 0, metros = 0, kcal = 0;
  for (const v of voltas) {
    seg += num(/<TotalTimeSeconds>([\d.]+)</.exec(v[2])?.[1]) || 0;
    const cabeca = v[2].split('<Track>')[0]; // dados da volta (os pontos vêm depois, dentro de <Track>)
    metros += num(/<DistanceMeters>([\d.]+)</.exec(cabeca)?.[1]) || 0;
    kcal += num(/<Calories>(\d+)</.exec(cabeca)?.[1]) || 0;
  }
  const bpms = tudo(/<HeartRateBpm>\s*<Value>(\d+)<\/Value>/, txt).map((m) => Number(m[1]));
  if (!metros) {
    const dists = tudo(/<Trackpoint>[\s\S]*?<DistanceMeters>([\d.]+)<\/DistanceMeters>/, txt).map((m) => Number(m[1]));
    metros = dists.length ? Math.max(...dists) : 0;
  }
  const f = fc(bpms);
  const inicio = voltas[0]?.[1] ?? /<Id>([^<]+)<\/Id>/.exec(txt)?.[1] ?? new Date().toISOString();
  return {
    nome: `${traduzTipo(sport)} do relógio`, tipo: traduzTipo(sport), inicio: new Date(inicio).toISOString(),
    minutos: Math.round(seg / 60), km: Math.round(metros) / 1000, fcMedia: f.media, fcMaxima: f.maxima, kcal: kcal || null,
    pontos: tudo(/<Trackpoint>/, txt).length,
  };
}

export function lerAtividade(nomeArquivo: string, txt: string): Atividade {
  if (/\.tcx$/i.test(nomeArquivo) || /<TrainingCenterDatabase/.test(txt)) return lerTcx(txt);
  if (/\.gpx$/i.test(nomeArquivo) || /<gpx\b/.test(txt)) return lerGpx(txt);
  throw new Error('Formato não reconhecido. Exporte o treino como .GPX ou .TCX (o .FIT ainda não é lido).');
}
