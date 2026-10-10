import { useMemo, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import Card from '@/components/base/Card';
import { dataBr, metricaInfo, prever } from '@/lib/avaliacao/calculos';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import TabelaEvolucao from './TabelaEvolucao';

const ORDEM = [
  'peso', 'gordura', 'massaGorda', 'mlg', 'cintura', 'abdomen', 'quadril', 'torax', 'braco_relaxado', 'braco_contraido',
  'coxa_medial', 'panturrilha', 'somaDobras', 'cmb', 'rcq', 'imc', 'massa_muscular', 'smm', 'visceral', 'agua_kg', 'idade_metabolica',
  'gorduraBio', 'tricipital', 'abdominal', 'suprailiaca', 'subescapular', 'coxa', 'peitoral', 'axilar_media',
];

const eixo = { fontSize: 11, fill: 'oklch(var(--foreground-400))' };
const curta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

export default function GraficosEvolucao({ serie, metaGordura, metaPeso }: { serie: ItemSerie[]; metaGordura: number | null; metaPeso: number | null }) {
  const disponiveis = useMemo(
    () => ORDEM.filter((k) => serie.filter((s) => s.m[k] != null).length >= 2),
    [serie],
  );
  const [metrica, setMetrica] = useState<string>('gordura');
  const atual = disponiveis.includes(metrica) ? metrica : disponiveis[0];
  const info = atual ? metricaInfo(atual) : null;

  const pontos = atual ? serie.filter((s) => s.m[atual] != null).map((s) => ({ data: s.data, valor: s.m[atual] })) : [];
  const meta = atual === 'gordura' ? metaGordura : atual === 'peso' ? metaPeso : null;
  const previsao = prever(pontos, meta);
  const composicao = serie.filter((s) => s.m.massaGorda != null && s.m.mlg != null).map((s) => ({ label: curta(s.data), gordura: s.m.massaGorda, magra: s.m.mlg }));

  if (serie.length < 2 || !atual || !info) {
    return (
      <Card padding="p-5">
        <p className="text-sm text-foreground-500">Os gráficos aparecem quando houver pelo menos duas avaliações. Importe as antigas na aba Avaliações.</p>
      </Card>
    );
  }

  const ganho = previsao ? previsao.porSemana : 0;
  const leitura = info.sentido === 0 || !ganho ? 'text-foreground-700' : Math.sign(ganho) === info.sentido ? 'text-accent-700' : 'text-red-600';

  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Gráfico de evolução</h2>
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {disponiveis.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetrica(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                k === atual ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'bg-background-100 text-foreground-700'
              }`}
            >
              {metricaInfo(k)?.label}
            </button>
          ))}
        </div>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos.map((p) => ({ label: curta(p.data), valor: p.valor }))} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
              <XAxis dataKey="label" tick={eixo} axisLine={false} tickLine={false} />
              <YAxis tick={eixo} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} formatter={(v) => [`${v} ${info.unidade}`, info.label]} />
              <Line type="monotone" dataKey="valor" name={info.label} stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {previsao && (
          <p className={`mt-3 rounded-lg bg-background-100/70 px-3 py-2 text-sm ${leitura}`}>
            <i className="ri-line-chart-line mr-1"></i>
            No ritmo atual: {previsao.porSemana > 0 ? '+' : ''}{previsao.porSemana.toLocaleString('pt-BR')} {info.unidade} por semana.
            {previsao.semanas != null && previsao.dataMeta && (
              <> Meta de {meta} {info.unidade} em cerca de <b>{previsao.semanas} semanas</b> ({dataBr(previsao.dataMeta)}).</>
            )}
          </p>
        )}
      </Card>

      {composicao.length >= 2 && (
        <Card padding="p-5">
          <h2 className="mb-1 font-heading text-base font-semibold text-foreground-950">Gordura x massa magra</h2>
          <p className="mb-3 text-xs text-foreground-500">O ideal é a linha laranja (gordura) descer e a verde (massa magra) subir ou ficar.</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={composicao} margin={{ top: 8, right: 0, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="label" tick={eixo} axisLine={false} tickLine={false} />
                <YAxis yAxisId="m" tick={eixo} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <YAxis yAxisId="g" orientation="right" tick={eixo} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="m" type="monotone" dataKey="magra" name="Massa magra (kg)" stroke="oklch(var(--accent-600))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="g" type="monotone" dataKey="gordura" name="Gordura (kg)" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <TabelaEvolucao serie={serie} />
    </div>
  );
}
