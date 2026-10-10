import { useEffect } from 'react';
import type { Alimento } from '@/lib/dietPlan';

export interface OpcaoTroca { nome: string; porcao: string; kcal?: number; p?: number; c?: number; g?: number }

interface Props {
  item: { nome: string; porcao: string; kcal?: number };
  doNutri?: string[]; // opções que o próprio nutricionista listou
  doApp: Alimento[]; // equivalentes calculados pelo app
  trocado: boolean;
  onEscolher: (o: OpcaoTroca) => void;
  onDesfazer: () => void;
  onFechar: () => void;
  extra?: { label: string; marcado: boolean; onMudar: (v: boolean) => void };
}

// Folha de troca: mostra só alimentos compatíveis (mesmo grupo) com a porção já ajustada.
export default function TrocaAlimento({ item, doNutri = [], doApp, trocado, onEscolher, onDesfazer, onFechar, extra }: Props) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const nada = !doNutri.length && !doApp.length;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onFechar} role="dialog" aria-modal="true" aria-label={`Trocar ${item.nome}`}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background-50 p-4 pb-8 sm:rounded-2xl" onClick={(e) => e.stopPropagation()} data-testid="troca-folha">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Trocar</p>
            <h3 className="font-heading text-lg font-bold text-foreground-950">{item.nome} <span className="font-normal text-foreground-500">({item.porcao})</span></h3>
            {item.kcal != null && <p className="text-xs text-foreground-500">{item.kcal} kcal</p>}
          </div>
          <button type="button" onClick={onFechar} className="rounded-full p-2 text-foreground-500" aria-label="Fechar"><i className="ri-close-line text-xl"></i></button>
        </div>

        {doNutri.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-foreground-800">Do seu nutricionista</p>
            <ul className="mt-1.5 space-y-1.5">
              {doNutri.map((o) => (
                <li key={o}>
                  <button type="button" onClick={() => onEscolher({ nome: o, porcao: '' })} className="w-full rounded-xl border border-background-200 px-3 py-2.5 text-left text-sm text-foreground-800 active:bg-primary-50">{o}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {doApp.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-foreground-800">{doNutri.length ? 'Outras opções equivalentes' : 'Opções equivalentes'}</p>
            <p className="text-[11px] text-foreground-500">Mesmo tipo de alimento, porção ajustada para o mesmo nutriente principal.</p>
            <ul className="mt-1.5 space-y-1.5">
              {doApp.map((a) => (
                <li key={a.nome}>
                  <button type="button" onClick={() => onEscolher({ nome: a.nome, porcao: a.porcao, kcal: a.kcal, p: a.p, c: a.c, g: a.g })} className="flex w-full items-center justify-between gap-3 rounded-xl border border-background-200 px-3 py-2.5 text-left text-sm active:bg-primary-50" data-testid="troca-opcao">
                    <span className="text-foreground-800">{a.nome} <span className="text-foreground-500">({a.porcao})</span></span>
                    <span className="shrink-0 text-xs text-foreground-500">{a.kcal} kcal · {a.p} g prot</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nada && <p className="mt-3 text-sm text-foreground-600">Não achei um equivalente seguro para este item. Peça a troca ao seu nutricionista ou coach.</p>}

        {extra && (
          <label className="mt-4 flex items-start gap-2 text-sm text-foreground-700">
            <input type="checkbox" className="mt-0.5" checked={extra.marcado} onChange={(e) => extra.onMudar(e.target.checked)} />
            {extra.label}
          </label>
        )}

        {trocado && (
          <button type="button" onClick={onDesfazer} className="mt-4 w-full rounded-xl bg-background-100 px-3 py-2.5 text-sm font-semibold text-foreground-700">Voltar ao original</button>
        )}
      </div>
    </div>
  );
}
