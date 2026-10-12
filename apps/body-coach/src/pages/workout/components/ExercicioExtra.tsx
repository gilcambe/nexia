import { useState } from 'react';
import { NO_INTERVALO, sugerirNomes } from '@/lib/exercicioLivre';

export type ModoExtra = 'trocar' | 'mais' | 'intervalo';

// Folha de baixo para anotar um exercício que não está na lista: no lugar do atual, a mais, ou feito no intervalo.
export default function ExercicioExtra({ modoInicial, atual, onTrocar, onAdicionar, onIntervalo, onFechar }: {
  modoInicial: ModoExtra;
  atual: string;
  onTrocar: (nome: string) => void;
  onAdicionar: (nome: string) => void;
  onIntervalo: (nome: string, quanto: string) => void;
  onFechar: () => void;
}) {
  const [modo, setModo] = useState<ModoExtra>(modoInicial);
  const [nome, setNome] = useState('');
  const [quanto, setQuanto] = useState('');
  const sugestoes = modo === 'intervalo' && nome.trim().length < 2 ? NO_INTERVALO : sugerirNomes(nome);
  const ok = nome.trim().length >= 2;

  const salvar = () => {
    if (!ok) return;
    if (modo === 'trocar') onTrocar(nome);
    else if (modo === 'mais') onAdicionar(nome);
    else onIntervalo(nome, quanto);
    onFechar();
  };

  const opcoes: { id: ModoExtra; titulo: string; sub: string; icone: string }[] = [
    { id: 'trocar', titulo: `No lugar de ${atual}`, sub: 'Ex.: a corda estava ocupada e fiz coice', icone: 'ri-swap-line' },
    { id: 'mais', titulo: 'Um exercício a mais', sub: 'Entra logo depois deste, com séries', icone: 'ri-add-circle-line' },
    { id: 'intervalo', titulo: 'Fiz no intervalo', sub: 'Ex.: abdominal no descanso entre as séries', icone: 'ri-timer-line' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Anotar outro exercício" onClick={onFechar}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background-50 p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-foreground-950">Fiz outro exercício</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-500 hover:bg-background-100"><i className="ri-close-line text-2xl"></i></button>
        </div>

        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Como foi">
          {opcoes.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={modo === o.id} onClick={() => setModo(o.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${modo === o.id ? 'border-primary-500 bg-primary-50' : 'border-background-200 bg-background-50'}`}>
              <i className={`${o.icone} text-2xl ${modo === o.id ? 'text-primary-600' : 'text-foreground-400'}`}></i>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground-950">{o.titulo}</span>
                <span className="block text-sm text-foreground-500">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-foreground-700">Nome do exercício</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus
            placeholder={modo === 'intervalo' ? 'Ex.: Abdominal' : 'Ex.: Tríceps coice'} aria-label="Nome do exercício"
            className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-4 py-3 text-lg text-foreground-950 outline-none focus:border-primary-400"
            onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }} />
        </label>
        {sugestoes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="sugestoes-exercicio">
            {sugestoes.map((s) => (
              <button key={s} type="button" onClick={() => setNome(s)} className="rounded-full border border-background-200 bg-background-100 px-3 py-2 text-sm font-medium text-foreground-800">{s}</button>
            ))}
          </div>
        )}

        {modo === 'intervalo' && (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-foreground-700">Quanto? (opcional)</span>
            <input value={quanto} onChange={(e) => setQuanto(e.target.value)} maxLength={40} placeholder="Ex.: 3x20 ou 1 min" aria-label="Quanto fez"
              className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-4 py-3 text-lg text-foreground-950 outline-none focus:border-primary-400"
              onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }} />
            <span className="mt-1 flex flex-wrap gap-2">
              {['3x15', '3x20', '1 min', '2 min'].map((q) => (
                <button key={q} type="button" onClick={() => setQuanto(q)} className="rounded-full border border-background-200 bg-background-100 px-3 py-2 text-sm font-medium text-foreground-800">{q}</button>
              ))}
            </span>
          </label>
        )}

        <button type="button" onClick={salvar} disabled={!ok} className="mt-5 w-full rounded-2xl bg-primary-500 px-6 py-4 text-base font-bold text-background-50 disabled:opacity-40" data-testid="salvar-extra">
          {modo === 'trocar' ? 'Trocar e anotar as séries' : modo === 'mais' ? 'Adicionar ao treino' : 'Anotar'}
        </button>
      </div>
    </div>
  );
}
