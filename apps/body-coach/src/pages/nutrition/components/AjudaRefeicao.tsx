import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useNutrition } from '@/components/feature/NutritionContext';
import { listUserDocs } from '@/lib/userData';
import { sugerirRefeicao } from '@/lib/ferramentas/oQueComer';

type Linha = { name?: string; meal_time?: string; calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; created_at?: string };
const ontemISO = () => { const d = new Date(Date.now() - 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// "O que comer agora" (com o que falta no dia) e "Comer igual a ontem" em 1 toque.
export default function AjudaRefeicao() {
  const { user, profile } = useAuth();
  const { meals, targets, totals, addMeal } = useNutrition();
  const [ontem, setOntem] = useState<Linha[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [adicionado, setAdicionado] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    listUserDocs<Linha>(user.id, 'meals', 'created_at', 'desc')
      .then((l) => setOntem(l.filter((m) => m.created_at?.slice(0, 10) === ontemISO())))
      .catch(() => setOntem([]));
  }, [user]);

  const falta = { kcal: targets.calories - totals.calories, p: targets.protein - totals.protein, c: targets.carbs - totals.carbs, g: targets.fat - totals.fat };
  const sugestoes = useMemo(
    () => sugerirRefeicao(falta, (profile?.onboarding ?? {}) as Record<string, unknown>, profile?.alimentos_evitar ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [falta.kcal, falta.p, falta.c, falta.g, profile?.onboarding, profile?.alimentos_evitar],
  );

  const repetirOntem = async () => {
    for (const m of ontem) {
      await addMeal({ id: '', name: m.name ?? 'Refeição', time: m.meal_time ?? '', calories: Number(m.calories) || 0, protein: Number(m.protein) || 0, carbs: Number(m.carbs) || 0, fat: Number(m.fat) || 0, fiber: Number(m.fiber) || 0 });
    }
    setCopiado(true);
  };
  const adicionar = async (i: number) => {
    const s = sugestoes[i];
    const hora = new Date().toTimeString().slice(0, 5);
    await addMeal({ id: '', name: s.itens.map((a) => `${a.nome} (${a.porcao})`).join(' + ').slice(0, 190), time: hora, calories: s.kcal, protein: s.p, carbs: s.c, fat: s.g, fiber: 0 });
    setAdicionado(i);
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <i className="ri-magic-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">O que comer agora?</h2>
      </div>
      {falta.kcal < 80 ? (
        <p className="mt-2 text-sm text-foreground-600">Você já bateu as calorias de hoje. {falta.p > 10 ? `Faltam ${Math.round(falta.p)} g de proteína: prefira algo leve e proteico (whey, iogurte, ovo).` : 'Agora é hidratar e descansar.'}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-foreground-500">Faltam hoje: <b>{Math.round(falta.kcal)} kcal</b> · {Math.max(0, Math.round(falta.p))} g proteína · {Math.max(0, Math.round(falta.c))} g carbo · {Math.max(0, Math.round(falta.g))} g gordura</p>
          <div className="mt-3 space-y-2">
            {sugestoes.map((s, i) => (
              <div key={i} className="rounded-xl bg-background-100/70 p-3">
                <p className="text-sm font-semibold text-foreground-900">{s.itens.map((a) => `${a.nome} (${a.porcao})`).join(' + ')}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground-500">{s.kcal} kcal · P {s.p} g · C {s.c} g · G {s.g} g</span>
                  <button type="button" onClick={() => void adicionar(i)} disabled={adicionado === i} className="shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 disabled:opacity-60 dark:text-foreground-950">{adicionado === i ? 'Registrado' : 'Comi isso'}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {ontem.length > 0 && meals.length === 0 && (
        <button type="button" onClick={() => void repetirOntem()} disabled={copiado} className="mt-3 w-full rounded-xl border border-primary-300 py-2.5 text-sm font-semibold text-primary-700 disabled:opacity-60">
          <i className="ri-repeat-line mr-1"></i>{copiado ? 'Refeições de ontem registradas' : `Comer igual a ontem (${ontem.length} refeições, ${Math.round(ontem.reduce((s, m) => s + (Number(m.calories) || 0), 0))} kcal)`}
        </button>
      )}
    </Card>
  );
}
