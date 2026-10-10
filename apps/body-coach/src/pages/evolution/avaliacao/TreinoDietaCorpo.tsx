import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '@/components/base/Card';
import { listUserDocs } from '@/lib/userData';
import { leituraSemanas, semanasTreinoDieta } from '@/lib/avaliacao/semanas';
import type { ItemSerie } from '@/lib/avaliacao/serie';

const eixo = { fontSize: 11, fill: 'oklch(var(--foreground-400))' };

// Treino, dieta e corpo no mesmo gráfico, semana a semana (últimas 12 semanas).
export default function TreinoDietaCorpo({ uid, serie }: { uid: string | undefined; serie: ItemSerie[] }) {
  const [dados, setDados] = useState<{ treinos: { done_at?: string }[]; refeicoes: { created_at?: string; protein?: number }[] } | null>(null);
  useEffect(() => {
    if (!uid) return;
    Promise.all([
      listUserDocs<{ done_at?: string }>(uid, 'workouts', 'done_at', 'desc').catch(() => []),
      listUserDocs<{ created_at?: string; protein?: number }>(uid, 'meals', 'created_at', 'desc').catch(() => []),
    ]).then(([treinos, refeicoes]) => setDados({ treinos, refeicoes }));
  }, [uid]);

  const semanas = useMemo(() => (dados ? semanasTreinoDieta(dados.treinos, dados.refeicoes, serie.map((s) => ({ data: s.data, m: s.m }))) : []), [dados, serie]);
  const peso = [...serie].reverse().find((s) => s.m.peso != null)?.m.peso ?? null;
  const leitura = leituraSemanas(semanas, peso);
  const temCorpo = semanas.some((s) => s.gordura != null || s.peso != null);
  const temAlgo = semanas.some((s) => s.treinos || s.proteina != null);

  return (
    <Card padding="p-5">
      <h2 className="mb-1 font-heading text-base font-semibold text-foreground-950">Treino, dieta e corpo</h2>
      <p className="mb-3 text-xs text-foreground-500">Semana a semana: treinos feitos, proteína por dia e a sua gordura (ou peso).</p>
      {!dados ? <p className="text-sm text-foreground-500">Carregando...</p> : !temAlgo ? (
        <p className="text-sm text-foreground-600">Registre treinos e refeições para ver aqui como eles mexem no seu corpo.</p>
      ) : (
        <>
          <div className="h-60" data-testid="grafico-treino-dieta">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={semanas} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" />
                <XAxis dataKey="rotulo" tick={eixo} interval={1} />
                <YAxis yAxisId="t" tick={eixo} allowDecimals={false} width={24} />
                <YAxis yAxisId="p" orientation="right" tick={eixo} width={36} />
                {temCorpo && <YAxis yAxisId="c" hide domain={['dataMin - 1', 'dataMax + 1']} />}
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [n === 'Proteína (g/dia)' ? `${v} g` : n === 'Gordura (%)' ? `${v}%` : n === 'Peso (kg)' ? `${v} kg` : v, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="t" dataKey="treinos" name="Treinos" fill="oklch(var(--secondary-400))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="proteina" name="Proteína (g/dia)" stroke="oklch(var(--accent-500))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                {temCorpo && semanas.some((s) => s.gordura != null)
                  ? <Line yAxisId="c" dataKey="gordura" name="Gordura (%)" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  : temCorpo && <Line yAxisId="c" dataKey="peso" name="Peso (kg)" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {leitura && <p className="mt-3 rounded-lg bg-background-100 px-3 py-2 text-sm text-foreground-800">{leitura}</p>}
        </>
      )}
    </Card>
  );
}
