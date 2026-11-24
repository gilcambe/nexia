import { useState } from 'react';
import Card from '@/components/base/Card';
import { useNutrition } from '@/components/feature/NutritionContext';
import { BEBIDAS, planoParaCaber, somar } from '@/lib/bebida';

const CHAVE = 'bc_bebida_plano';

// Bebida no fim de semana: monte o que vai beber, veja as calorias, o plano para caber e registre no dia.
export default function BebidaFimDeSemana() {
  const { addMeal } = useNutrition();
  const [itens, setItens] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; } });
  const [registrado, setRegistrado] = useState(false);
  const mudar = (id: string, d: number) => {
    setItens((atual) => {
      const n = { ...atual, [id]: Math.max(0, Math.min(20, (atual[id] ?? 0) + d)) };
      if (!n[id]) delete n[id];
      try { localStorage.setItem(CHAVE, JSON.stringify(n)); } catch { /* ok */ }
      return n;
    });
    setRegistrado(false);
  };
  const lista = Object.entries(itens).map(([id, qtd]) => ({ id, qtd }));
  const r = somar(lista);
  const registrar = async () => {
    const agora = new Date();
    const nome = lista.map(({ id, qtd }) => `${qtd}× ${BEBIDAS.find((b) => b.id === id)?.nome ?? id}`).join(' + ').slice(0, 190);
    await addMeal({ id: '', name: `Bebida: ${nome}`, time: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`, calories: Math.round(r.kcal), protein: 0, carbs: Math.round(r.carbo), fat: 0, fiber: 0 });
    setRegistrado(true);
  };
  return (
    <Card padding="p-3">
      <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-goblet-line mr-1 text-primary-500"></i>Bebida no fim de semana</h2>
      <p className="mt-0.5 text-xs text-foreground-500">Vai beber? Planeje antes: o app soma as calorias e mostra como caber na semana, sem culpa.</p>
      <ul className="mt-2 divide-y divide-background-200" data-testid="lista-bebidas">
        {BEBIDAS.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0 text-sm text-foreground-900">{b.nome}<span className="block text-xs text-foreground-500">{b.kcal} kcal por dose</span></span>
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => mudar(b.id, -1)} disabled={!itens[b.id]} aria-label={`Menos ${b.nome}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-100 text-lg font-bold disabled:opacity-30">−</button>
              <span className="w-6 text-center font-semibold tabular-nums">{itens[b.id] ?? 0}</span>
              <button type="button" onClick={() => mudar(b.id, 1)} aria-label={`Mais ${b.nome}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-100 text-lg font-bold">+</button>
            </span>
          </li>
        ))}
      </ul>
      {r.doses > 0 && (
        <div className="mt-3 rounded-xl bg-primary-50 p-3 text-sm text-foreground-900" data-testid="plano-bebida">
          <ul className="space-y-1">{planoParaCaber(r).map((d) => <li key={d}>• {d}</li>)}</ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setItens({}); try { localStorage.removeItem(CHAVE); } catch { /* ok */ } }} className="rounded-lg border border-background-200 py-2 text-sm font-semibold text-foreground-700">Limpar</button>
            <button type="button" onClick={() => void registrar()} disabled={registrado} className="rounded-lg bg-primary-500 py-2 text-sm font-semibold text-background-50 disabled:opacity-60">{registrado ? 'Registrado ✓' : 'Bebi: registrar hoje'}</button>
          </div>
        </div>
      )}
    </Card>
  );
}
