import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { listUserDocs } from '@/lib/userData';

// Refeição como é gravada em bodycoach_users/{uid}/meals (created_at em ISO).
interface Meal {
  created_at?: string;
  calories?: number;
  protein?: number;
}

interface DailyData {
  label: string;
  calories: number;
  protein: number;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function WeeklyTrend() {
  const { user } = useAuth();
  const [weeklyData, setWeeklyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    listUserDocs<Meal>(user.id, 'meals', 'created_at', 'asc')
      .then((meals) => {
        if (!active) return;
        const byDay: Record<string, { calories: number; protein: number }> = {};
        for (const m of meals) {
          const k = typeof m.created_at === 'string' ? dayKey(new Date(m.created_at)) : null;
          if (!k) continue;
          byDay[k] ??= { calories: 0, protein: 0 };
          byDay[k].calories += Number(m.calories) || 0;
          byDay[k].protein += Number(m.protein) || 0;
        }
        const days: DailyData[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const v = byDay[dayKey(d)] ?? { calories: 0, protein: 0 };
          days.push({ label: WEEKDAYS[d.getDay()], calories: Math.round(v.calories), protein: Math.round(v.protein) });
        }
        setWeeklyData(days);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a tendência da semana.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) {
    return <div className="flex h-56 w-full items-center justify-center text-sm text-foreground-500">Carregando...</div>;
  }

  if (error) {
    return <div className="flex h-56 w-full items-center justify-center text-sm text-red-600">{error}</div>;
  }

  if (!weeklyData.some((d) => d.calories > 0 || d.protein > 0)) {
    return (
      <div className="flex h-56 w-full items-center justify-center px-4 text-center text-sm text-foreground-500">
        Registre suas refeições para ver a tendência da semana.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={weeklyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="cal"
            tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="prot" orientation="right" hide />
          <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="cal"
            dataKey="calories"
            name="Calorias (kcal)"
            fill="oklch(var(--primary-500))"
            radius={[5, 5, 0, 0]}
          />
          <Line
            yAxisId="prot"
            dataKey="protein"
            name="Proteína (g)"
            stroke="oklch(var(--accent-500))"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}