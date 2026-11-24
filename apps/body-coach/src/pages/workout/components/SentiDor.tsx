import { useState } from 'react';

import type { Lesao } from '@/lib/exerciseDb';

const ONDE = ['Ombro', 'Cotovelo', 'Punho', 'Lombar', 'Joelho', 'Quadril', 'Pescoço', 'Outro lugar'];
// Região → lesão do banco de exercícios: a troca deixa de sugerir o que força a região.
const LESAO: Record<string, Lesao> = { Ombro: 'ombro', Cotovelo: 'cotovelo', Punho: 'punho', Lombar: 'lombar', Joelho: 'joelho', Quadril: 'quadril', 'Pescoço': 'pescoco' };

// "Senti dor": registra para o coach e diz o que fazer. Dor forte → troca o exercício (ou para).
export default function SentiDor({ exercicio, onRegistrar, onTrocar, onFechar }: {
  exercicio: string;
  onRegistrar: (texto: string, lesao: Lesao | null) => void;
  onTrocar: () => void;
  onFechar: () => void;
}) {
  const [onde, setOnde] = useState('');
  const [forte, setForte] = useState<boolean | null>(null);
  const pronto = !!onde && forte !== null;
  const confirmar = () => {
    if (!pronto) return;
    onRegistrar(`Dor ${forte ? 'forte' : 'leve'} no(a) ${onde.toLowerCase()} em ${exercicio}`, forte ? LESAO[onde] ?? null : null);
    if (forte) onTrocar(); else onFechar();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Senti dor" onClick={onFechar}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background-50 p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-foreground-950">Senti dor</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-500 hover:bg-background-100"><i className="ri-close-line text-2xl"></i></button>
        </div>
        <p className="mt-1 text-sm text-red-700"><i className="ri-alarm-warning-line mr-1"></i>Estalo, dor aguda, formigamento ou dor no peito: pare o treino agora e procure um médico.</p>
        <p className="mt-3 text-sm font-semibold text-foreground-800">Onde?</p>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {ONDE.map((o) => <button key={o} type="button" onClick={() => setOnde(o)} aria-pressed={onde === o} className={`rounded-xl border-2 px-1 py-2 text-xs font-semibold ${onde === o ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-700'}`}>{o}</button>)}
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground-800">Como é a dor?</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setForte(false)} aria-pressed={forte === false} className={`rounded-xl border-2 p-2 text-left text-sm ${forte === false ? 'border-primary-500 bg-primary-50' : 'border-background-200'}`}><b>Leve</b><span className="block text-xs text-foreground-600">Incômodo, dá para continuar</span></button>
          <button type="button" onClick={() => setForte(true)} aria-pressed={forte === true} className={`rounded-xl border-2 p-2 text-left text-sm ${forte === true ? 'border-red-400 bg-red-50' : 'border-background-200'}`}><b>Forte</b><span className="block text-xs text-foreground-600">Piora no movimento</span></button>
        </div>
        {forte === false && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tire uns 30% da carga, diminua a amplitude e vá devagar. Se piorar, pare este exercício.</p>}
        {forte === true && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">Pare este exercício. Vamos trocar por outro que não force essa região. O coach vai saber.</p>}
        <button type="button" onClick={confirmar} disabled={!pronto} className="mt-4 w-full rounded-2xl bg-primary-500 px-6 py-3.5 text-base font-bold text-background-50 disabled:opacity-40" data-testid="confirmar-dor">
          {forte ? 'Avisar o coach e trocar o exercício' : 'Avisar o coach e continuar'}
        </button>
      </div>
    </div>
  );
}
