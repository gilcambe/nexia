import { useState } from 'react';
import Card from '@/components/base/Card';
import { diaDaFichaCoach, type FichaCoach } from '@/lib/coach/fichaCoach';

// Antes do treino, quando o coach montou a ficha: mostra o treino da vez (A, B, C...) e deixa trocar o dia.
export default function PreTreinoCoach({ ficha, diaInicial, onStart, onUsarApp }: { ficha: FichaCoach; diaInicial: number; onStart: (dia: number) => void; onUsarApp: () => void }) {
  const [dia, setDia] = useState(() => diaDaFichaCoach(ficha, diaInicial));
  const d = ficha.dias[dia];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card padding="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-600"><i className="ri-user-star-line mr-1"></i>Ficha do seu coach{ficha.coach ? ` · ${ficha.coach}` : ''}</p>
        <h1 className="mt-1 font-heading text-xl font-bold text-foreground-950">{ficha.nome}</h1>
        {ficha.obs && <p className="mt-2 rounded-lg bg-background-100 px-3 py-2 text-sm text-foreground-700">{ficha.obs}</p>}
        {ficha.dias.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Escolher o treino">
            {ficha.dias.map((x, i) => (
              <button key={i} type="button" onClick={() => setDia(i)} aria-pressed={dia === i} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${dia === i ? 'bg-primary-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`}>
                {x.titulo}{i === diaDaFichaCoach(ficha, diaInicial) ? ' · da vez' : ''}
              </button>
            ))}
          </div>
        )}
        <h2 className="mt-4 font-heading text-base font-semibold text-foreground-950">{d.titulo}</h2>
        <ol className="mt-2 space-y-2">
          {d.exercicios.map((x, i) => (
            <li key={`${x.id}-${i}`} className="rounded-xl bg-background-100/70 px-3 py-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-foreground-900">{i + 1}. {x.nome}</span>
                <span className="shrink-0 text-xs font-semibold text-foreground-600">{x.series} × {x.reps}</span>
              </div>
              <p className="mt-0.5 text-xs text-foreground-500">
                Descanso {x.descanso >= 60 ? `${Math.floor(x.descanso / 60)} min${x.descanso % 60 ? ` ${x.descanso % 60} s` : ''}` : `${x.descanso} s`}
                {x.carga ? ` · Carga: ${x.carga}` : ''}
              </p>
              {x.obs && <p className="mt-1 text-xs text-foreground-700"><i className="ri-chat-quote-line mr-1 text-primary-500"></i>{x.obs}</p>}
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => onStart(dia)} className="mt-5 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 hover:bg-primary-600">
          <i className="ri-play-circle-line mr-1"></i>COMEÇAR ESTE TREINO
        </button>
        <button type="button" onClick={onUsarApp} className="mt-3 w-full text-center text-xs font-medium text-foreground-500 underline">
          Hoje prefiro o treino automático do app
        </button>
      </Card>
    </div>
  );
}
