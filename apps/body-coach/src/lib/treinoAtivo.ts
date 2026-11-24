import type { CargaRep } from '@/lib/cargasDoTexto';
import type { SetLog } from '@/mocks/workout';
import { lerSeries, type SeriesLidas } from '@/lib/serieFalada';
import { guardarAndamento, lerAndamento } from '@/lib/treinoAndamento';

// Liga o chat (texto ou voz) ao treino do dia: "fiz 12 com 30 kg" vira série anotada no exercício certo.
// Com a tela do treino aberta, quem anota é ela (registrador); fora dela, grava direto no treino em andamento.

type Registrador = (series: CargaRep[], exercicio: string | null) => string | null;
let registrador: Registrador | null = null;
let nomesAtuais: string[] = [];

export function setTreinoAtivo(fn: Registrador | null, nomes: string[] = []): void {
  registrador = fn;
  nomesAtuais = fn ? nomes : [];
}

const kg = (n: number) => (n ? `${String(n).replace('.', ',')} kg` : 'sem peso');
export const resumoSeries = (s: CargaRep[]) => s.map((x) => `${x.reps} × ${kg(x.weight)}`).join(', ');

// Anota o que o texto disser. Devolve a frase de confirmação, ou null se não era uma série / não tem treino aberto.
export function anotarDoTexto(texto: string, uid?: string): string | null {
  if (registrador) {
    const lidas = lerSeries(texto, nomesAtuais);
    return lidas ? registrador(lidas.series, lidas.exercicio) : null;
  }
  if (!uid) return null;
  const t = lerAndamento(uid);
  if (!t) return null;
  const lidas = lerSeries(texto, t.session.exercises.map((e) => e.name));
  return lidas ? anotarNoAndamento(uid, lidas) : null;
}

function anotarNoAndamento(uid: string, lidas: SeriesLidas): string | null {
  const t = lerAndamento(uid);
  if (!t) return null;
  const idx = lidas.exercicio ? t.session.exercises.findIndex((e) => e.name === lidas.exercicio) : t.exIndex;
  const ex = t.session.exercises[idx >= 0 ? idx : t.exIndex];
  if (!ex) return null;
  const antes = t.setsByEx[ex.id] ?? [];
  const novas: SetLog[] = lidas.series.map((s, i) => ({
    id: `${ex.id}-chat-${Date.now()}-${i}`, set: antes.length + i + 1, weight: s.weight, reps: s.reps,
    rir: null, rpe: null, restSec: ex.restSec, completed: true,
  }));
  const { v: _v, salvoEm: _s, ...resto } = t;
  guardarAndamento(uid, { ...resto, setsByEx: { ...t.setsByEx, [ex.id]: [...antes, ...novas] } });
  return `Anotei no seu treino: ${ex.name}, ${resumoSeries(lidas.series)}. Dá para corrigir ou apagar na tela do treino.`;
}

// Compatibilidade com quem ainda chama pelo formato antigo.
export function registrarSeries(series: CargaRep[]): string | null {
  return registrador ? registrador(series, null) : null;
}
