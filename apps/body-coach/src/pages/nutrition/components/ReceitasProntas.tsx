import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useNutrition } from '@/components/feature/NutritionContext';
import { RECEITAS, TIPOS_RECEITA, receitasParaHoje, type Receita, type TipoReceita } from '@/lib/receitas';

const TAGS: { id: Receita['tags'][number]; nome: string }[] = [
  { id: 'proteina', nome: 'Muita proteína' }, { id: 'low-carb', nome: 'Pouco carbo' }, { id: 'vegetariana', nome: 'Vegetariana' },
  { id: 'sem-lactose', nome: 'Sem lactose' }, { id: 'barata', nome: 'Barata' },
];

// Receitas fit prontas, ordenadas pelo que falta hoje; registra no dia num toque.
export default function ReceitasProntas() {
  const { totals, targets, addMeal } = useNutrition();
  const [tipo, setTipo] = useState<TipoReceita | ''>('');
  const [tag, setTag] = useState<Receita['tags'][number] | ''>('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [feito, setFeito] = useState('');
  const faltaKcal = Math.round((targets?.calories ?? 0) - (totals?.calories ?? 0));
  const faltaProt = Math.round((targets?.protein ?? 0) - (totals?.protein ?? 0));
  const lista = useMemo(() => receitasParaHoje(RECEITAS.filter((r) => (!tipo || r.tipo === tipo) && (!tag || r.tags.includes(tag))), faltaKcal, faltaProt), [tipo, tag, faltaKcal, faltaProt]);
  const registrar = async (r: Receita) => {
    const agora = new Date();
    await addMeal({ id: '', name: r.nome, time: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`, calories: r.kcal, protein: r.p, carbs: r.c, fat: r.g, fiber: 0 });
    setFeito(r.id);
  };
  const chip = (ativo: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${ativo ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-background-200 text-foreground-600'}`;
  return (
    <Card padding="p-3">
      <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-book-2-line mr-1 text-primary-500"></i>Receitas fit</h2>
      {faltaKcal > 0 && <p className="mt-0.5 text-xs text-foreground-500">Faltam {faltaKcal} kcal e {Math.max(0, faltaProt)} g de proteína hoje: as que mais encaixam vêm primeiro.</p>}
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => setTipo('')} className={chip(!tipo)}>Todas</button>
        {TIPOS_RECEITA.map((t) => <button key={t} type="button" onClick={() => setTipo(t)} className={chip(tipo === t)}>{t}</button>)}
      </div>
      <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAGS.map((t) => <button key={t.id} type="button" onClick={() => setTag(tag === t.id ? '' : t.id)} className={chip(tag === t.id)}>{t.nome}</button>)}
      </div>
      <ul className="mt-2 space-y-2" data-testid="lista-receitas">
        {lista.map((r) => (
          <li key={r.id} className="rounded-xl border border-background-200 p-3">
            <button type="button" onClick={() => setAberta(aberta === r.id ? null : r.id)} className="w-full text-left" aria-expanded={aberta === r.id}>
              <p className="font-semibold text-foreground-950">{r.nome}</p>
              <p className="text-xs text-foreground-500">{r.tipo} · {r.min} min · {r.kcal} kcal · P {r.p} g · C {r.c} g · G {r.g} g</p>
            </button>
            {aberta === r.id && (
              <div className="mt-2 text-sm text-foreground-800">
                <p className="font-semibold">Ingredientes</p>
                <ul className="ml-4 list-disc">{r.ingredientes.map((i) => <li key={i}>{i}</li>)}</ul>
                <p className="mt-2 font-semibold">Como fazer</p>
                <ol className="ml-4 list-decimal">{r.preparo.map((p) => <li key={p}>{p}</li>)}</ol>
                <button type="button" onClick={() => void registrar(r)} disabled={feito === r.id} className="mt-3 w-full rounded-xl bg-primary-500 py-2 text-sm font-semibold text-background-50 disabled:opacity-60">
                  {feito === r.id ? 'Registrado no dia ✓' : 'Comi isso: registrar no dia'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
