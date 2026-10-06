import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { listUserDocs } from '@/lib/userData';

interface MealItem {
  name: string;
  calories: number;
  protein: number;
}

interface Meal {
  created_at: {
    toDate: () => Date;
  };
  items: MealItem[];
}

interface DailyData {
  label: string;
  calories: number;
  protein: number;
}

export default function WeeklyTrend() {
  const { user } = useAuth();
  const [weeklyData, setWeeklyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyMeals = async () => {
      if (!user?.id) {
        setLoading(false);
        setError("User not authenticated.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const meals = await listUserDocs<Meal>(user.id, 'meals', 'created_at', 'asc');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const filteredMeals = meals.filter(meal => meal.created_at.toDate() >= sevenDaysAgo);

        const dailyAggregates: { [key: string]: { calories: number; protein: number } } = {};

        filteredMeals.forEach(meal => {
          const date = meal.created_at.toDate();
          const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' });

          if (!dailyAggregates[dayLabel]) {
            dailyAggregates[dayLabel] = { calories: 0, protein: 0 };
          }

          meal.items.forEach(item => {
            dailyAggregates[dayLabel].calories += item.calories;
            dailyAggregates[dayLabel].protein += item.protein;
          });
        });

        const last7Days: DailyData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' });
          last7Days.push({
            label: dayLabel,
            calories: dailyAggregates[dayLabel]?.calories || 0,
            protein: dailyAggregates[dayLabel]?.protein || 0,
          });
        }
        setWeeklyData(last7Days);
      } catch (err) {
        console.error("Failed to fetch weekly meals:", err);
        setError("Failed to load weekly nutrition data.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyMeals();
  }, [user?.id]);

  if (loading) {
    return <div className="h-56 w-full flex items-center justify-center">Carregando dados...</div>;
  }

  if (error) {
    return <div className="h-56 w-full flex items-center justify-center text-red-500">{error}</div>;
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