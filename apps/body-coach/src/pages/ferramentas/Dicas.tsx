import { useState } from 'react';
import Card from '@/components/base/Card';
import { DICAS, dicaDoDia } from '@/lib/ferramentas/dicas';

const ICONES: Record<string, string> = { Sono: 'ri-moon-line', Hidratação: 'ri-drop-line', Alimentação: 'ri-restaurant-line', Treino: 'ri-boxing-line', Recuperação: 'ri-battery-charge-line', Mente: 'ri-brain-line', Postura: 'ri-user-line' };

export default function Dicas() {
  const [cat, setCat] = useState('Todas');
  const hoje = dicaDoDia();
  const cats = ['Todas', ...new Set(DICAS.map((d) => d.cat))];
  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-br from-primary-500 to-primary-700 text-background-50 dark:text-foreground-950">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80"><i className={`${ICONES[hoje.cat]} mr-1`}></i>Dica do dia · {hoje.cat}</p>
        <p className="mt-1 font-heading text-xl font-bold">{hoje.titulo}</p>
        <p className="mt-1 text-sm opacity-95">{hoje.texto}</p>
      </Card>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{c}</button>)}
      </div>
      <div className="space-y-2">
        {DICAS.filter((d) => cat === 'Todas' || d.cat === cat).map((d) => (
          <div key={d.titulo} className="flex gap-3 rounded-2xl border border-background-200 bg-background-50 p-3">
            <i className={`${ICONES[d.cat]} mt-0.5 text-xl text-primary-600`}></i>
            <div><p className="font-semibold text-foreground-950">{d.titulo}</p><p className="text-sm text-foreground-600">{d.texto}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
