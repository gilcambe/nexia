import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from 'recharts';
import {
  bodyTwin, strengthTrend, personalRecords, correlations, evolutionSummary,
  type MeasurementRegion,
} from '@/mocks/evolution';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import BodyTwin from './components/BodyTwin';
import ProgressCompare from './components/ProgressCompare';
import RegisterProgress from './components/RegisterProgress';

const regionTwinKey: Record<string, string> = {
  peito: 'pecs',
  ombro: 'deltoides',
  cintura: 'abdomen',
  bracos: 'biceps',
  ante: 'biceps',
  coxa: 'quadriceps',
  pantur: 'panturrilhas',
  quadril: 'gluteos',
};

const regionIcon: Record<string, string> = {
  peito: 'ri-heart-pulse-line',
  ombro: 'ri-body-scan-line',
  cintura: 'ri-drop-line',
  bracos: 'ri-heart-pulse-line',
  ante: 'ri-heart-pulse-line',
  coxa: 'ri-body-scan-line',
  pantur: 'ri-body-scan-line',
  quadril: 'ri-body-scan-line',
  gordura: 'ri-line-chart-line',
  massa: 'ri-scales-line',
};

function regionConfidenceTag(c: MeasurementRegion) {
  if (c.source === 'estimado') return 'estimado';
  return c.confidence === 'alta' ? 'medido' : 'estimado';
}

export default function Evolution() {
  const { user } = useAuth();
  const {
    entries, loading, error, reload, latest, height, goalBodyFat, goalWeight, weightTrend,
  } = useProgressData(user?.id);

  const [selected, setSelected] = useState<string | null>('peito');
  const selRegions = bodyTwin.regions.filter((r) =>
    Object.keys(regionTwinKey).includes(r.key)
  );
  const detail = selRegions.find((r) => r.key === selected) ?? null;
  const twinKey = detail ? regionTwinKey[detail.key] : null;

  // Dados reais do aluno (última medição) que alimentam o Body Twin.
  const currentWeight = latest?.weight_kg ?? 82.5;
  const currentBodyFat = latest?.body_fat_pct ?? 16;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Evolução</h1>
        <p className="mt-1 text-sm text-foreground-600">{evolutionSummary}</p>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={reload}
            className="whitespace-nowrap rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Registrar progresso */}
      <Card padding="p-5">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-add-circle-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Registrar progresso</h2>
          <span className="ml-auto rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700">
            foto + medidas
          </span>
        </div>
        <RegisterProgress userId={user?.id} onSaved={reload} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Body Twin */}
        <Card padding="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-body-scan-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Body Twin</h2>
            </div>
            <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-700">IA + Foto</span>
          </div>
          <BodyTwin
            selected={twinKey}
            onSelect={(k) => {
              const found = selRegions.find((r) => regionTwinKey[r.key] === k);
              if (found) setSelected(found.key);
            }}
            currentWeight={currentWeight}
            currentBodyFat={currentBodyFat}
            currentHeight={height}
            goalBodyFat={goalBodyFat}
            goalWeight={goalWeight}
          />
        </Card>

        {/* detail */}
        <Card padding="p-5">
          {detail ? (
            <div>
              <div className="flex items-center gap-2">
                <i className={`${regionIcon[detail.key] ?? 'ri-heart-pulse-line'} text-xl text-primary-500`}></i>
                <h2 className="font-heading text-lg font-bold text-foreground-950">{detail.label}</h2>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  detail.source === 'estimado' ? 'bg-secondary-100 text-secondary-700' : 'bg-accent-100 text-accent-700'
                }`}>
                  {regionConfidenceTag(detail)}
                </span>
              </div>
              <div className="mt-4 flex items-end gap-6">
                <div>
                  <p className="text-xs text-foreground-500">Valor atual</p>
                  <p className="font-heading text-4xl font-bold text-foreground-950">
                    {detail.value}
                    <span className="ml-1 text-lg font-medium text-foreground-400">{detail.unit}</span>
                  </p>
                </div>
                <div className="pb-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    detail.delta > 0 ? 'bg-accent-100 text-accent-700' : detail.delta < 0 ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-500'
                  }`}>
                    <i className={detail.delta > 0 ? 'ri-arrow-up-line' : detail.delta < 0 ? 'ri-arrow-down-line' : 'ri-arrow-right-line'}></i>
                    {detail.delta > 0 ? '+' : ''}{detail.delta} {detail.unit} <span className="lowercase">em 6 sem</span>
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-sm text-foreground-600">Dados associados a esta região:</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Volume de treino', value: '+12%', icon: 'ri-fire-line' },
                    { label: 'Força', value: '+6%', icon: 'ri-line-chart-line' },
                    { label: 'Tendência', value: 'melhorando', icon: 'ri-arrow-up-line' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-background-100/70 p-3">
                      <i className={`${s.icon} text-primary-500`}></i>
                      <p className="mt-1 font-heading text-base font-bold text-foreground-950">{s.value}</p>
                      <p className="text-[11px] text-foreground-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg bg-background-100/70 p-3 text-xs text-foreground-500">
                  Confiança: {detail.confidence} · Origem: {detail.source === 'medido' ? 'medida real' : 'estimado'} · Atualizado recentemente.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-500">Selecione uma região no Body Twin para ver detalhes.</p>
          )}

          {/* measurements list */}
          <div className="mt-6 border-t border-background-200 pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-400">Medidas</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selRegions.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setSelected(r.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    selected === r.key ? 'border-primary-300 bg-primary-100/70' : 'border-background-200 bg-background-50 hover:bg-background-100'
                  }`}
                >
                  <p className="text-[11px] text-foreground-500">{r.label}</p>
                  <p className="text-sm font-semibold text-foreground-900">{r.value} {r.unit}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="p-5">
          <div className="mb-3 flex items-center gap-2">
            <i className="ri-scales-line text-lg text-primary-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Peso &amp; cintura</h2>
            <span className="ml-auto rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700">dados reais</span>
          </div>
          {loading && weightTrend.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-foreground-500">
              <i className="ri-loader-4-line mr-2 animate-spin"></i> Carregando...
            </div>
          ) : weightTrend.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="cintura" name="Cintura (cm)" stroke="oklch(var(--accent-500))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
              <i className="ri-scales-line text-2xl text-foreground-400"></i>
              <p className="text-sm text-foreground-500">Sem dados ainda. Registre seu primeiro peso acima.</p>
            </div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="mb-3 flex items-center gap-2">
            <i className="ri-sword-line text-lg text-primary-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Força (kg)</h2>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strengthTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="legPress" name="Leg press" fill="oklch(var(--primary-500))" radius={[5, 5, 0, 0]} />
                <Bar dataKey="agachamento" name="Agachamento" fill="oklch(var(--accent-500))" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card padding="p-5">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-camera-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Comparar fotos por data</h2>
          <span className="ml-auto rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700">progresso real</span>
        </div>
        <ProgressCompare entries={entries} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PRs */}
        <Card padding="p-5">
          <div className="mb-4 flex items-center gap-2">
            <i className="ri-trophy-line text-lg text-primary-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Recordes pessoais</h2>
          </div>
          <div className="space-y-2">
            {personalRecords.map((p) => (
              <div key={p.exercise} className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground-800">{p.exercise}</p>
                  <p className="text-[11px] text-foreground-400">{p.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground-950">{p.value}</p>
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">{p.type}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* correlations */}
        <Card padding="p-5">
          <div className="mb-4 flex items-center gap-2">
            <i className="ri-link-m line text-lg text-primary-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Correlações</h2>
          </div>
          <div className="space-y-2">
            {correlations.map((c) => (
              <div key={c.id} className="rounded-lg bg-background-100/70 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground-800">{c.label}</p>
                  <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-700">{c.value}</span>
                </div>
                <p className="mt-1 text-xs text-foreground-500">{c.note}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}