import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import Card from '@/components/base/Card';

export default function EvolutionMini() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latest, weightTrend, loading } = useProgressData(user?.id);

  const latestWeight = latest?.weight_kg ?? null;
  const latestCintura = latest?.measurements?.cintura ?? null;
  const latestFat = latest?.body_fat_pct ?? null;

  const leanMass =
    latestWeight != null && latestFat != null
      ? latestWeight * (1 - latestFat / 100)
      : null;

  const firstWeight = weightTrend.length > 0 ? weightTrend[0].peso : null;
  const deltaWeight =
    latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null;

  const fmt = (v: number | null) => (v != null ? v.toFixed(1).replace('.', ',') : '—');

  if (loading) {
    return (
      <Card padding="p-5">
        <div className="flex h-40 items-center justify-center text-sm text-foreground-400">
          Carregando evolução...
        </div>
      </Card>
    );
  }

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-line-chart-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Evolução</h2>
        </div>
        <button
          onClick={() => navigate('/evolution')}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Ver tudo
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>

      {weightTrend.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <i className="ri-line-chart-line text-2xl"></i>
          </div>
          <p className="text-sm text-foreground-600">
            Registre seu primeiro progresso em Evolução para ver o gráfico aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Peso</p>
              <p className="mt-0.5 font-heading text-lg font-bold text-foreground-950">{fmt(latestWeight)}</p>
              {deltaWeight != null && (
                <p className={`text-[11px] font-medium ${deltaWeight <= 0 ? 'text-accent-600' : 'text-primary-600'}`}>
                  {deltaWeight > 0 ? '+' : ''}
                  {deltaWeight.toFixed(1).replace('.', ',')} kg
                </p>
              )}
            </div>
            <div className="rounded-xl bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Cintura</p>
              <p className="mt-0.5 font-heading text-lg font-bold text-foreground-950">{fmt(latestCintura)}</p>
              <p className="text-[11px] font-medium text-foreground-400">cm</p>
            </div>
            <div className="rounded-xl bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Massa magra</p>
              <p className="mt-0.5 font-heading text-lg font-bold text-foreground-950">{fmt(leanMass)}</p>
              <p className="text-[11px] font-medium text-foreground-400">kg</p>
            </div>
          </div>

          <div className="mt-4 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightTrend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="evoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--primary-500))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="oklch(var(--primary-500))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                <Area type="monotone" dataKey="peso" stroke="oklch(var(--primary-500))" strokeWidth={2.5} fill="url(#evoGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}