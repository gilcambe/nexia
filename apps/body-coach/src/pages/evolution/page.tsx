import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import BodyTwin from './components/BodyTwin';
import ProgressCompare from './components/ProgressCompare';
import RegisterProgress from './components/RegisterProgress';
import PeriodoEAnalise from './components/PeriodoEAnalise';
import { AvatarCorpo } from './components/AvatarCorpo';
import { listUserDocs } from '@/lib/userData';

export default function Evolution() {
  const { user } = useAuth();
  const {
    entries, loading, error, reload, height, goalBodyFat, goalWeight, weightTrend,
  } = useProgressData(user?.id);

  // Séries por grupo muscular nos últimos 7 dias, a partir dos treinos salvos.
  const [volumeSemana, setVolumeSemana] = useState<Record<string, number>>({});
  const [musculo, setMusculo] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    listUserDocs<{ done_at?: string; series_por_grupo?: Record<string, number> }>(user.id, 'workouts', 'done_at', 'desc')
      .then((lista) => {
        const corte = Date.now() - 7 * 24 * 3600 * 1000;
        const soma: Record<string, number> = {};
        for (const w of lista) {
          if (!w.done_at || new Date(w.done_at).getTime() < corte || !w.series_por_grupo) continue;
          for (const [g, n] of Object.entries(w.series_por_grupo)) soma[g] = (soma[g] ?? 0) + Number(n || 0);
        }
        setVolumeSemana(soma);
      })
      .catch(() => setVolumeSemana({}));
  }, [user?.id]);

  // Body Twin só com medição real: a mais recente que tem peso e % de gordura.
  const measured = [...entries].reverse().find((e) => e.weight_kg != null && e.body_fat_pct != null) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Evolução</h1>
        <p className="mt-1 text-sm text-foreground-600">Seu peso, medidas e fotos ao longo do tempo.</p>
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

      <PeriodoEAnalise entries={entries} />

      <Card padding="p-5">
        <div className="mb-3 flex items-center gap-2">
          <i className="ri-body-scan-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Músculos treinados (7 dias)</h2>
        </div>
        <AvatarCorpo volume={volumeSemana} selectedMuscle={musculo} onSelectMuscle={setMusculo} />
        <p className="mt-3 text-center text-sm text-foreground-600">
          {musculo ? `${musculo}: ${volumeSemana[musculo] ?? 0} séries na semana` : Object.keys(volumeSemana).length ? 'Toque num músculo para ver as séries.' : 'Faça um treino para o boneco acender.'}
        </p>
      </Card>

      {!measured ? (
        <Card padding="p-5" className="flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
          <i className="ri-body-scan-line text-4xl text-foreground-400"></i>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Body Twin</h2>
          <p className="text-sm text-foreground-500">
            Registre seu peso e uma foto para começar a acompanhar sua evolução.
          </p>
        </Card>
      ) : (
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
              selected={null}
              onSelect={() => {}}
              currentWeight={measured.weight_kg as number}
              currentBodyFat={measured.body_fat_pct as number}
              currentHeight={height}
              goalBodyFat={goalBodyFat}
              goalWeight={goalWeight}
            />
          </Card>

          {/* última medição */}
          <Card padding="p-5">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-ruler-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Última medição</h2>
              <span className="ml-auto text-xs text-foreground-500">{new Date(measured.taken_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Peso', value: `${measured.weight_kg} kg`, icon: 'ri-scales-line' },
                { label: 'Gordura corporal', value: `${measured.body_fat_pct}%`, icon: 'ri-percent-line' },
                { label: 'Registros', value: String(entries.length), icon: 'ri-history-line' },
                { label: 'Peso meta', value: goalWeight ? `${goalWeight} kg` : 'Não informado', icon: 'ri-flag-line' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-background-100/70 p-3">
                  <i className={`${s.icon} text-primary-500`}></i>
                  <p className="mt-1 font-heading text-base font-bold text-foreground-950">{s.value}</p>
                  <p className="text-[11px] text-foreground-500">{s.label}</p>
                </div>
              ))}
            </div>
            {measured.notes && <p className="mt-4 rounded-lg bg-background-100/70 p-3 text-sm text-foreground-700">{measured.notes}</p>}
          </Card>
        </div>
      )}

      {/* charts */}
      <div className="grid grid-cols-1 gap-6">
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

      </div>

      <Card padding="p-5">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-camera-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Comparar fotos por data</h2>
          <span className="ml-auto rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700">progresso real</span>
        </div>
        <ProgressCompare entries={entries} />
      </Card>

    </div>
  );
}