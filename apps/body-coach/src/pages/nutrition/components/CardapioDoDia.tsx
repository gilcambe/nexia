import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNutrition } from '@/components/feature/NutritionContext';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc } from '@/lib/userData';
import { montarCardapio } from '@/lib/dietPlan';

// Cardápio sugerido do dia: calculado das metas do aluno e das respostas do questionário.
export default function CardapioDoDia() {
  const { targets } = useNutrition();
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    getUserDoc<{ onboarding?: Record<string, unknown> }>(user.id, 'profile', 'main')
      .then((p) => setOnboarding(p?.onboarding ?? null))
      .catch(() => setOnboarding(null));
  }, [user]);

  const refeicoes = useMemo(
    () => (onboarding ? montarCardapio(onboarding, { kcal: targets.calories, proteina: targets.protein, carbo: targets.carbs, gordura: targets.fat }) : []),
    [onboarding, targets],
  );

  if (onboarding === undefined) return null;
  if (!onboarding) {
    return (
      <div className="rounded-2xl border border-background-200 bg-background-50 p-4">
        <h2 className="font-heading text-lg font-bold text-foreground-950">Cardápio sugerido de hoje</h2>
        <p className="mt-1 text-sm text-foreground-600">Responda o questionário para montar seu cardápio.</p>
        <Link to="/onboarding" className="mt-3 inline-flex rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50">Responder agora</Link>
      </div>
    );
  }

  const totalKcal = refeicoes.reduce((s, r) => s + r.itens.reduce((t, i) => t + i.kcal, 0), 0);
  const totalProt = Math.round(refeicoes.reduce((s, r) => s + r.itens.reduce((t, i) => t + i.p, 0), 0));

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-4">
      <h2 className="font-heading text-lg font-bold text-foreground-950">Cardápio sugerido de hoje</h2>
      <p className="mt-1 text-xs text-foreground-500">Montado com suas metas e restrições. Troque o que quiser pelo equivalente.</p>
      <div className="mt-3 space-y-3">
        {refeicoes.map((r) => (
          <div key={r.nome}>
            <p className="text-sm font-semibold text-foreground-900">{r.nome} <span className="font-normal text-foreground-500">· {r.horario}</span></p>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground-700">
              {r.itens.map((i) => (
                <li key={i.nome} className="flex justify-between gap-3">
                  <span>{i.nome} <span className="text-foreground-500">({i.porcao})</span></span>
                  <span className="shrink-0 text-foreground-500">{i.kcal} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-background-200 pt-2 text-sm font-semibold text-foreground-900">Total: {totalKcal} kcal · {totalProt} g de proteína</p>
    </div>
  );
}
