import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { weeklyTrend } from '@/mocks/nutrition';

export default function WeeklyTrend() {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="cal"
            tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }}
            axisLine={false}
            tickLine={false}
            domain={[2000, 3200]}
          />
          <YAxis yAxisId="prot" orientation="right" hide domain={[140, 200]} />
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