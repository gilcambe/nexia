import { useState, useEffect } from 'react';
import { useNutrition } from '@/components/feature/NutritionContext';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc } from '@/lib/userData';

interface ProfileMainData {
  onboarding?: {
    weight?: number;
    goal?: string;
  };
  name?: string;
}

export function CardapioDoDia() {
  const { targets, totals, meals, loading: nutritionLoading, error: nutritionError } = useNutrition();
  const { user } = useAuth();

  const [profileData, setProfileData] = useState<ProfileMainData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (!user?.id) {
        setLoadingProfile(false);
        return;
      }
      try {
        setLoadingProfile(true);
        setProfileError(null);
        const doc = await getUserDoc<ProfileMainData>(user.id, 'profile', 'main');
        if (isMounted && doc) {
          setProfileData(doc);
        }
      } catch (err) {
        if (isMounted) {
          setProfileError('Não foi possível carregar o perfil.');
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const calcPercent = (current: number, target: number) => {
    if (!target || target <= 0) return 0;
    const p = Math.round((current / target) * 100);
    return p > 100 ? 100 : p;
  };

  const calsPercent = calcPercent(totals.calories, targets.calories);
  const protPercent = calcPercent(totals.protein, targets.protein);
  const carbPercent = calcPercent(totals.carbs, targets.carbs);
  const fatPercent = calcPercent(totals.fat, targets.fat);

  if (nutritionLoading || loadingProfile) {
    return (
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 animate-pulse">
        <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Cardápio e Metas do Dia</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {profileData?.name ? `Olá, ${profileData.name}!` : 'Acompanhe seu consumo diário e metas nutricionais.'}
          </p>
        </div>
        {profileData?.onboarding?.goal && (
          <span className="self-start sm:self-auto px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
            Objetivo: {profileData.onboarding.goal}
          </span>
        )}
      </div>

      {(nutritionError || profileError) && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-sm">
          {nutritionError || profileError}
        </div>
      )}

      {/* Resumo de Calorias e Macros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
        <div className="flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Calorias</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totals.calories}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400"> / {targets.calories} kcal</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${calsPercent}%` }} />
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Proteína</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totals.protein}g</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400"> / {targets.protein}g</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${protPercent}%` }} />
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Carboidratos</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totals.carbs}g</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400"> / {targets.carbs}g</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${carbPercent}%` }} />
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Gordura</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totals.fat}g</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400"> / {targets.fat}g</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${fatPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Lista de Refeições do Dia */}
      <div>
        <h3 className="text-md font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Refeições Registradas Hoje</h3>
        {meals.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma refeição registrada hoje.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{meal.name}</span>
                    {meal.time && <span className="text-xs text-zinc-500 dark:text-zinc-400">({meal.time})</span>}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 space-x-2">
                    <span>{meal.calories} kcal</span>
                    <span>•</span>
                    <span>P: {meal.protein}g</span>
                    <span>•</span>
                    <span>C: {meal.carbs}g</span>
                    <span>•</span>
                    <span>G: {meal.fat}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
