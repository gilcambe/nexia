import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoach } from '@/components/feature/CoachContext';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc } from '@/lib/userData';
import { DIVISOES } from '@/lib/dayPlan';
import { fichaDoPerfil, treinoDaFicha, type Ficha } from '@/lib/ficha';
import { diaDaFichaCoach, sessaoDaFichaCoach, temFichaCoach } from '@/lib/coach/fichaCoach';
import { gravarOuGuardar } from '@/lib/pendentes';
import { lerAndamento, seriesFeitas } from '@/lib/treinoAndamento';
import Card from '@/components/base/Card';

export default function TodayCard() {
  const navigate = useNavigate();
  const { setOpen } = useCoach();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ onboarding?: Record<string, unknown>; ficha?: Partial<Ficha>; mobility?: string[]; ficha_coach?: unknown; ficha_coach_dia?: number } | null>(null);
  const [trocando, setTrocando] = useState(false);
  const andamento = user?.id ? lerAndamento(user.id) : null;

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ onboarding?: Record<string, unknown>; ficha?: Partial<Ficha>; mobility?: string[]; ficha_coach?: unknown; ficha_coach_dia?: number }>(user.id, 'profile', 'main')
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => {});
  }, [user?.id]);

  // Mesmo treino que a ficha e o botão INICIAR TREINO abrem: o próximo dia do ciclo da ficha.
  const ficha = profile?.onboarding ? fichaDoPerfil(profile) : null;
  const respostas = profile?.onboarding ? { ...profile.onboarding, mobility: profile.mobility ?? [] } : null;
  let treino: ReturnType<typeof treinoDaFicha> | null = null;
  try {
    treino = ficha && respostas ? treinoDaFicha(respostas, ficha.divisao, ficha.proximoDia) : null;
  } catch {
    treino = null;
  }
  const dia = ficha ? DIVISOES[ficha.divisao].dias[ficha.proximoDia] : null;

  // A ficha que o coach montou vem antes da automática.
  const fc = temFichaCoach(profile?.ficha_coach) ? profile.ficha_coach : null;
  const sessaoCoach = fc ? sessaoDaFichaCoach(fc, diaDaFichaCoach(fc, profile?.ficha_coach_dia)) : null;

  // Opções para "Mudar treino de hoje": os dias do ciclo da ficha ativa. Escolher um passa a ser o treino de hoje e o ciclo segue dali.
  const opcoes: { titulo: string; escolher: () => Record<string, unknown> }[] = fc
    ? fc.dias.map((d, i) => ({ titulo: d.titulo || `Treino ${i + 1}`, escolher: () => ({ ficha_coach_dia: i }) }))
    : ficha
      ? DIVISOES[ficha.divisao].dias.map((d, i) => ({ titulo: d.titulo, escolher: () => ({ ficha: { divisao: ficha.divisao, proximoDia: i } }) }))
      : [];
  const escolherTreino = (o: (typeof opcoes)[number]) => {
    if (!user?.id) return;
    const dados = o.escolher();
    setProfile((p) => (p ? { ...p, ...dados } : p));
    setTrocando(false);
    void gravarOuGuardar(user.id, 'profile', 'main', dados, true).catch(() => {});
  };

  const title = andamento ? andamento.session.title : sessaoCoach ? sessaoCoach.title : dia ? dia.titulo : 'Treino de hoje';
  const subtitle = andamento
    ? `Treino em andamento · ${seriesFeitas(andamento)} séries anotadas. Continue de onde parou.`
    : sessaoCoach && fc
      ? `Ficha do coach${fc.coach ? ` ${fc.coach}` : ''} · ${sessaoCoach.exercises.length} exercícios · ~${sessaoCoach.estimatedMinutes} min`
      : treino && ficha
        ? `Ficha ${DIVISOES[ficha.divisao].nome} · ${treino.sessao.estimatedMinutes} min · ${treino.sessao.exercises.length} exercícios`
        : 'Responda o questionário e o treino do seu plano aparece aqui.';

  return (
    <Card className="relative overflow-hidden" padding="p-3">
      <div className="absolute right-0 top-0 h-full w-1.5 bg-primary-500"></div>
      <h1 className="font-heading text-xl font-bold leading-tight text-foreground-950 md:text-[28px]">
        {title}
      </h1>
      <p className="mt-1 text-xs text-foreground-600">{subtitle}</p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => navigate('/workout')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 whitespace-nowrap"
        >
          <i className="ri-play-circle-line text-lg"></i>
          {andamento ? 'CONTINUAR TREINO' : 'INICIAR TREINO'}
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-700 hover:underline"
        >
          <i className="ri-mic-line"></i>
          Falar com o Coach
        </button>
      {opcoes.length > 1 && !andamento && (
        <div>
          <button
            onClick={() => setTrocando((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
            data-testid="mudar-treino"
          >
            <i className="ri-shuffle-line"></i>
            Mudar treino
          </button>
          {trocando && (
            <ul className="mt-2 flex flex-col gap-2" data-testid="lista-treinos">
              {opcoes.map((o, i) => (
                <li key={i}>
                  <button
                    onClick={() => escolherTreino(o)}
                    className="w-full rounded-lg border border-background-200 bg-background-50 px-4 py-2.5 text-left text-sm text-foreground-800 transition hover:bg-background-100"
                  >
                    {o.titulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </Card>
  );
}