import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import { listUserDocs } from '@/lib/userData';
import { montarSerie } from '@/lib/avaliacao/serie';
import RegisterProgress from './components/RegisterProgress';
import PeriodoEAnalise from './components/PeriodoEAnalise';
import ResumoEvolucao from './ResumoEvolucao';
import AbaAvaliacoes from './avaliacao/AbaAvaliacoes';
import GraficosEvolucao from './avaliacao/GraficosEvolucao';
import AbaFotos from './fotos/AbaFotos';
import TreinoDietaCorpo from './avaliacao/TreinoDietaCorpo';

type Aba = 'resumo' | 'avaliacoes' | 'fotos' | 'graficos';
const ABAS: { id: Aba; label: string; icone: string }[] = [
  { id: 'resumo', label: 'Resumo', icone: 'ri-body-scan-line' },
  { id: 'avaliacoes', label: 'Avaliações', icone: 'ri-file-list-3-line' },
  { id: 'fotos', label: 'Fotos', icone: 'ri-camera-line' },
  { id: 'graficos', label: 'Gráficos', icone: 'ri-line-chart-line' },
];

export default function Evolution() {
  const { user } = useAuth();
  const { entries, loading, error, reload, goalBodyFat, goalWeight, perfil, height } = useProgressData(user?.id);
  const serie = useMemo(() => montarSerie(entries, perfil), [entries, perfil]);
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'resumo') as Aba;
  const irPara = (a: Aba) => {
    setParams(a === 'resumo' ? {} : { aba: a }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [rapido, setRapido] = useState(false);

  // Séries por grupo muscular nos últimos 7 dias, a partir dos treinos salvos.
  const [volumeSemana, setVolumeSemana] = useState<Record<string, number>>({});
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Evolução</h1>
        <p className="mt-1 text-sm text-foreground-600">Avaliações, fotos, gráficos e o seu corpo realista.</p>
      </header>

      <nav className="sticky top-0 z-20 -mx-1 grid grid-cols-4 gap-1 rounded-2xl border border-background-200 bg-background-50/95 p-1 backdrop-blur" aria-label="Seções da evolução">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => irPara(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${aba === a.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'text-foreground-600'}`}
          >
            <i className={`${a.icone} text-base`}></i>
            {a.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button onClick={reload} className="whitespace-nowrap rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200">
            Tentar novamente
          </button>
        </div>
      )}
      {loading && entries.length === 0 && (
        <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>
      )}

      {aba === 'resumo' && (
        <>
          <ResumoEvolucao uid={user?.id} altura={height} serie={serie} perfil={perfil} volume={volumeSemana} metaGordura={goalBodyFat || null} metaPeso={goalWeight} irPara={irPara} onMudou={reload} />

          <Card padding="p-5">
            <button type="button" onClick={() => setRapido((r) => !r)} className="flex w-full items-center gap-2 text-left" aria-expanded={rapido}>
              <i className="ri-add-circle-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Registro rápido de peso</h2>
              <i className={`ml-auto text-lg text-foreground-500 ${rapido ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
            </button>
            {rapido && <div className="mt-4"><RegisterProgress userId={user?.id} onSaved={reload} /></div>}
          </Card>

          <Card padding="p-5">
            <div className="mb-3 flex items-center gap-2">
              <i className="ri-fire-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Músculos treinados (7 dias)</h2>
            </div>
            {Object.keys(volumeSemana).length === 0 ? (
              <p className="text-sm text-foreground-500">Faça um treino para ver aqui quantas séries cada músculo recebeu.</p>
            ) : (
              <ul className="space-y-2.5">
                {Object.entries(volumeSemana).sort((x, y) => y[1] - x[1]).map(([g, n]) => {
                  const max = Math.max(...Object.values(volumeSemana), 1);
                  const faixa = n >= 18 ? 'bg-primary-600' : n >= 10 ? 'bg-primary-500' : n >= 5 ? 'bg-primary-400' : 'bg-primary-300';
                  return (
                    <li key={g}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-foreground-800">{g}</span>
                        <span className="font-semibold text-foreground-950">{n} séries</span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-background-200">
                        <div className={`h-full rounded-full transition-all duration-700 ${faixa}`} style={{ width: `${Math.max(6, (n / max) * 100)}%` }}></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-foreground-500">Referência por semana: 10 a 20 séries por músculo costuma funcionar bem para hipertrofia.</p>
          </Card>

          <PeriodoEAnalise entries={entries} />
        </>
      )}

      {aba === 'avaliacoes' && <AbaAvaliacoes uid={user?.id} perfil={perfil} entries={entries} serie={serie} onMudou={reload} />}
      {aba === 'fotos' && <AbaFotos uid={user?.id} entries={entries} serie={serie} onMudou={reload} />}
      {aba === 'graficos' && (
        <>
          <GraficosEvolucao serie={serie} metaGordura={goalBodyFat || null} metaPeso={goalWeight} />
          <TreinoDietaCorpo uid={user?.id} serie={serie} />
        </>
      )}
    </div>
  );
}
