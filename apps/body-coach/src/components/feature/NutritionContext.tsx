import { calcularMetas } from '@/lib/metas';
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { nutritionTargets, waterGoal as defaultWaterGoal, initialMeals, type MealFood } from '@/mocks/nutrition';
import { listUserDocs, setUserDoc, deleteUserDoc } from '@/lib/userData';
import { useAuth } from './AuthContext';

interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface NutritionContextValue {
  meals: MealFood[];
  water: number;
  waterGoal: number;
  targets: typeof nutritionTargets;
  totals: NutritionTotals;
  loading: boolean;
  error: string | null;
  reload: () => void;
  addMeal: (meal: MealFood) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  addWater: (liters: number) => void;
  resetWater: () => void;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

// Refeição com a data em que foi lançada (só as de hoje entram nos totais do dia).
type DayMeal = MealFood & { created_at?: string };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isToday = (m: DayMeal) => !m.created_at || m.created_at.slice(0, 10) === today();

function mapRow(row: any): DayMeal {
  return {
    id: String(row._docId ?? row.id),
    name: row.name,
    time: row.meal_time ?? '',
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
  };
}

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition deve ser usado dentro do NutritionProvider');
  return ctx;
}

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { user, isLocalDemo, profile } = useAuth();
  const [allMeals, setMeals] = useState<DayMeal[]>([]);
  const meals = useMemo(() => allMeals.filter(isToday), [allMeals]);
  // Água do dia guardada no navegador (por usuário e por data).
  const waterKey = `bc_water_${user?.id ?? 'anon'}_${today()}`;
  const [water, setWater] = useState<number>(0);
  useEffect(() => {
    try {
      setWater(Number(localStorage.getItem(waterKey)) || 0);
    } catch {
      setWater(0);
    }
  }, [waterKey]);
  useEffect(() => {
    try {
      localStorage.setItem(waterKey, String(water));
    } catch {
      // Navegador sem armazenamento: a água só vale nesta sessão.
    }
  }, [waterKey, water]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setMeals([]);
        setLoading(false);
        return;
      }
      if (isLocalDemo) {
        setMeals(initialMeals);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await listUserDocs<Record<string, unknown>>(user.id, 'meals', 'created_at', 'asc');
        if (!active) return;
        setMeals(data.map(mapRow));
      } catch {
        if (active) setError('Não foi possível carregar suas refeições.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user?.id, reloadKey, isLocalDemo]);

  const addMeal = useCallback(
    async (meal: MealFood) => {
      if (!user) return;
      // MODO LOCAL: mantém as refeições em memória, sem tocar no backend.
      if (isLocalDemo) {
        setMeals((prev) => [...prev, { ...meal, id: meal.id || `m-${Date.now()}` }]);
        return;
      }
      // Firestore: bodycoach_users/{uid}/meals/{id} — o id já nasce no cliente.
      const newId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMeals((prev) => [...prev, { ...meal, id: newId, created_at: new Date().toISOString() }]);
      try {
        await setUserDoc(user.id, 'meals', newId, {
          user_id: user.id,
          name: meal.name,
          meal_time: meal.time,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          fiber: meal.fiber,
          created_at: new Date().toISOString(),
        });
      } catch {
        setMeals((prev) => prev.filter((m) => m.id !== newId));
        setError('Falha ao salvar a refeição.');
      }
    },
    [user?.id, isLocalDemo],
  );

  const removeMeal = useCallback(
    async (id: string) => {
      if (!user) return;
      if (isLocalDemo) {
        setMeals((prev) => prev.filter((m) => m.id !== id));
        return;
      }
      setMeals((prev) => prev.filter((m) => m.id !== id));
      try {
        await deleteUserDoc(user.id, 'meals', id);
      } catch {
        setError('Falha ao remover a refeição.');
        reload();
      }
    },
    [user?.id, reload, isLocalDemo],
  );

  const totals = useMemo<NutritionTotals>(
    () => ({
      calories: meals.reduce((a, m) => a + m.calories, 0),
      protein: meals.reduce((a, m) => a + m.protein, 0),
      carbs: meals.reduce((a, m) => a + m.carbs, 0),
      fat: meals.reduce((a, m) => a + m.fat, 0),
      fiber: meals.reduce((a, m) => a + m.fiber, 0),
    }),
    [meals],
  );

  const { targets, waterGoal } = useMemo(() => {
    const peso = Number((profile as any)?.onboarding?.weight) || 0;
    if (!(peso > 0)) return { targets: nutritionTargets, waterGoal: defaultWaterGoal };
    return {
      targets: calcularMetas(peso, (profile as any)?.onboarding?.goal, Number((profile as any)?.ajuste_kcal) || 0),
      waterGoal: Math.round(peso * 0.035 * 10) / 10,
    };
  }, [profile]);

  const value = useMemo(
    () => ({
      meals,
      water,
      waterGoal,
      targets,
      totals,
      loading,
      error,
      reload,
      addMeal,
      removeMeal,
      addWater: (liters: number) => setWater((prev) => Math.round((prev + liters) * 100) / 100),
      resetWater: () => setWater(0),
    }),
    [meals, water, waterGoal, targets, totals, loading, error, reload, addMeal, removeMeal],
  );

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}