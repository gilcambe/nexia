import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type SetLog, type Session } from '@/mocks/workout';
import type { Answers } from '@/lib/trainingPlan';
import { montarTreinoDoDia, type TreinoDoDia, trocarExercicio } from '@/lib/dayPlan';
import { moverExercicio } from '@/lib/ordemTreino';
import { alternativas, videoDeExecucao, lesoesDoTexto, type Lesao } from '@/lib/exerciseDb';
import PreTreino from './components/PreTreino';
import { dicaAoVivo } from '@/lib/liveCoach';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import SetEntry, { type NewSet } from './components/SetEntry';
import DescansoTimer from './components/DescansoTimer';
import { CardioEntry } from './components/CardioEntry';
import { useCoach } from '@/components/feature/CoachContext';
import { setTreinoAtivo } from '@/lib/treinoAtivo';

type Phase =
  | 'PRE_SESSION'
  | 'WARMUP'
  | 'EXERCISE_ACTIVE'
  | 'STRENGTH_COMPLETE'
  | 'CARDIO_DECISION'
  | 'CARDIO'
  | 'SESSION_REVIEW'
  | 'SESSION_COMPLETE';

export default function Workout() {
  const { user } = useAuth();
  const [respostas, setRespostas] = useState<Record<string, unknown> | null>(null);
  const [treino, setTreino] = useState<TreinoDoDia | null>(null);
  const [estado, setEstado] = useState<'loading' | 'rest' | 'no-plan' | 'ready'>('loading');

  useEffect(() => {
    if (!user) return;
    getUserDoc<{ onboarding?: Answers }>(user.id, 'profile', 'main')
      .then((p) => {
        if (!p?.onboarding) return setEstado('no-plan');
        setRespostas(p.onboarding as unknown as Record<string, unknown>);
        setEstado('ready');
      })
      .catch(() => setEstado('no-plan'));
  }, [user]);

  if (estado !== 'ready' || !respostas) return <WorkoutEmpty estado={estado} />;
  if (!treino) {
    return (
      <PreTreino
        respostas={respostas}
        onStart={(cfg) => setTreino(montarTreinoDoDia({ respostas, ...cfg, variacao: Date.now() % 1000 }))}
      />
    );
  }
  return <WorkoutFlow session={treino.sessao} lesoes={treino.lesoes} onSessionChange={(sessao) => setTreino({ ...treino, sessao })} />;
}

function WorkoutEmpty({ estado }: { estado: string }) {
  if (estado === 'loading') return <p className="text-sm text-foreground-500">Carregando...</p>;
  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
      <h1 className="font-heading text-xl font-bold text-foreground-950">{estado === 'rest' ? 'Hoje é dia de descanso' : 'Responda o questionário para montar seu treino'}</h1>
      <p className="mt-2 text-sm text-foreground-600">{estado === 'rest' ? 'Recupere bem: sono, água e alimentação. Veja a semana no Plano.' : 'Com seus dias livres e seu nível, o treino do dia aparece aqui.'}</p>
      <Link to={estado === 'rest' ? '/plan' : '/onboarding'} className="mt-4 inline-flex rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50">{estado === 'rest' ? 'Ver plano' : 'Responder agora'}</Link>
    </div>
  );
}

function WorkoutFlow({ session, lesoes = [], onSessionChange }: { session: Session; lesoes?: Lesao[]; onSessionChange?: (s: Session) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOpen } = useCoach();
  const [startedAt] = useState(() => new Date().toISOString());
  const [phase, setPhase] = useState<Phase>('PRE_SESSION');
  const [exIndex, setExIndex] = useState(0);
  const [setsByEx, setSetsByEx] = useState<Record<string, SetLog[]>>({});
  const [restLeft, setRestLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const [cardioDone, setCardioDone] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  const exercise = session.exercises[exIndex] ?? session.exercises[0];

  // rest countdown
  useEffect(() => {
    if (!resting || restLeft <= 0) return;
    const t = setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resting, restLeft]);

  const startRest = (sec: number) => {
    setRestLeft(sec);
    setResting(true);
  };

  const addSet = (newSet: NewSet) => {
    const prev = setsByEx[exercise.id] ?? [];
    const setLog: SetLog = {
      id: `${exercise.id}-${Date.now()}`,
      set: prev.length + 1,
      weight: newSet.weight,
      reps: newSet.reps,
      rir: newSet.rir,
      rpe: null,
      restSec: exercise.restSec,
      completed: true,
    };
    setSetsByEx((v) => ({ ...v, [exercise.id]: [...prev, setLog] }));
    startRest(exercise.restSec);
  };

  const finishExercise = () => {
    if (exIndex < session.exercises.length - 1) {
      setExIndex((i) => i + 1);
      setPhase('EXERCISE_ACTIVE');
    } else {
      setPhase('STRENGTH_COMPLETE');
    }
  };

  const currentSets = setsByEx[exercise.id] ?? [];

  useEffect(() => {
    if (phase === 'EXERCISE_ACTIVE') {
      setTreinoAtivo({ exercise, sets: currentSets });
    }
  }, [phase, exercise, currentSets]);

  useEffect(() => {
    if (phase !== 'EXERCISE_ACTIVE') {
      setTreinoAtivo(null);
    }
  }, [phase]);

  // Extrair faixa de repetições alvo do exercício (ex: "8-12 reps" -> [8, 12])
  const parseReps = (target: string): [number, number] => {
    const match = target.match(/(\d+)\s*-\s*(\d+)/);
    if (match) return [parseInt(match[1], 10), parseInt(match[2], 10)];
    return [8, 12];
  };

  const dica = dicaAoVivo({
    exercicio: exercise.name,
    repsAlvo: parseReps(exercise.targetReps || '8-12'),
    seriesPlanejadas: 3,
    feitas: currentSets.map(s => ({ carga: s.weight, reps: s.reps, rir: s.rir ?? undefined })),
    descansoSeg: exercise.restSec || 90
  });

  return (
    <div className="mx-auto max-w-3xl">
      {/* top progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-heading font-semibold text-foreground-950">{session.title}</span>
          <span className="text-foreground-500">
            {exIndex + 1}/{session.exercises.length} exercícios
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background-200">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${(exIndex / session.exercises.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-4">
        {phase === 'PRE_SESSION' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Pronto para começar?</h2>
            <p className="mt-2 text-sm text-foreground-600">
              {session.exercises.length} exercícios · {session.estimatedMinutes} min.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {session.exercises.map((e) => (
                <span key={e.id} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700">
                  <i className="ri-heart-pulse-line mr-1 text-accent-600"></i>
                  {e.name}
                </span>
              ))}
            </div>
            <button
              onClick={() => setPhase('WARMUP')}
              className="mt-6 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              INICIAR TREINO
            </button>
          </div>
        )}

        {phase === 'WARMUP' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Aquecimento</h2>
            <p className="mt-1 text-sm text-foreground-600">Prepare o corpo antes de carregar peso.</p>
            <div className="mt-4 space-y-2">
              {session.warmup.map((w) => (
                <div key={w.name} className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-3">
                  <span className="text-sm text-foreground-800">{w.name}</span>
                  <span className="text-sm font-medium text-foreground-500">{Math.round(w.durationSec / 60)} min</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPhase('EXERCISE_ACTIVE')}
              className="mt-6 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              COMEÇAR EXERCÍCIOS
            </button>
          </div>
        )}

        {phase === 'EXERCISE_ACTIVE' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  Exercício {exIndex + 1}
                </p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-foreground-950">{exercise.name}</h2>
                <p className="mt-1 text-sm text-foreground-500">{exercise.muscleGroup}</p>
              </div>
              <span className="rounded-full bg-secondary-100 px-3 py-1.5 text-xs font-semibold text-secondary-800">
                {exercise.targetReps} · RIR 2
              </span>
            </div>

            <p className="mt-4 rounded-xl bg-background-100/70 p-3 text-sm text-foreground-700">
              <i className="ri-information-line mr-1 text-primary-500"></i>
              {exercise.note}
            </p>

            {/* ver como fazer & trocar exercício & reordenar */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowVideo(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-200 transition"
              >
                <i className="ri-play-circle-line"></i>
                Ver execução
              </button>
              <button
                onClick={() => setShowSwapModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-300 transition"
              >
                <i className="ri-refresh-line"></i>
                Trocar exercício
              </button>
              <div className="flex items-center gap-1 bg-background-200/70 p-1 rounded-lg">
                <button
                  onClick={() => {
                    const novaSessao = moverExercicio(session, exIndex, exIndex - 1);
                    if (novaSessao !== session) {
                      onSessionChange?.(novaSessao);
                      setExIndex((i) => Math.max(0, i - 1));
                    }
                  }}
                  disabled={exIndex === 0}
                  title="Subir exercício"
                  className="inline-flex items-center justify-center p-1 rounded text-foreground-700 hover:bg-background-300 disabled:opacity-40 transition"
                >
                  <i className="ri-arrow-up-line text-sm"></i>
                </button>
                <button
                  onClick={() => {
                    const novaSessao = moverExercicio(session, exIndex, exIndex + 1);
                    if (novaSessao !== session) {
                      onSessionChange?.(novaSessao);
                      setExIndex((i) => Math.min(session.exercises.length - 1, i + 1));
                    }
                  }}
                  disabled={exIndex === session.exercises.length - 1}
                  title="Descer exercício"
                  className="inline-flex items-center justify-center p-1 rounded text-foreground-700 hover:bg-background-300 disabled:opacity-40 transition"
                >
                  <i className="ri-arrow-down-line text-sm"></i>
                </button>
              </div>
            </div>

            {/* modal vídeo */}
            {showVideo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-background-50 p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-foreground-950">Como executar: {exercise.name}</h3>
                    <button onClick={() => setShowVideo(false)} className="rounded-lg p-1 text-foreground-400 hover:bg-background-200">
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-xl bg-background-900 aspect-video flex items-center justify-center text-background-50">
                    <div className="text-center p-4">
                      <i className="ri-movie-line text-4xl text-primary-400 mb-2"></i>
                      <p className="text-sm font-medium">{videoDeExecucao(exercise.name)}</p>
                      <p className="text-xs text-background-400 mt-1">Vídeo demonstrativo de postura e movimento</p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={() => setShowVideo(false)}
                      className="rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* modal trocar exercício */}
            {showSwapModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md rounded-2xl bg-background-50 p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-foreground-950">Trocar exercício</h3>
                    <button onClick={() => setShowSwapModal(false)} className="rounded-lg p-1 text-foreground-400 hover:bg-background-200">
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-foreground-600">Escolha uma alternativa compatível para {exercise.name}:</p>
                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {alternativas(exercise.id, new Set(lesoes), [], session.exercises.map((e) => e.id)).map((alt) => (
                      <button
                        key={alt.id}
                        onClick={() => {
                          onSessionChange?.(trocarExercicio(session, exercise.id, alt.id));
                          setShowSwapModal(false);
                        }}
                        className="w-full text-left rounded-xl border border-background-200 bg-background-100/60 p-3 text-sm font-medium text-foreground-800 hover:bg-primary-50 hover:border-primary-300 transition flex items-center justify-between"
                      >
                        <span>{alt.nome}</span>
                        <i className="ri-arrow-right-s-line text-foreground-400"></i>
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={() => setShowSwapModal(false)}
                      className="rounded-xl border border-background-200 bg-background-50 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* memory */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Memória</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-600">
                  <i className="ri-history-line text-accent-600"></i>
                  {exercise.prevSession.date}
                </span>
                {exercise.prevSession.sets.map((s) => (
                  <span key={s.set} className="rounded-full bg-background-100 px-2.5 py-1.5 text-xs font-medium text-foreground-700">
                    {s.weight}{exercise.weightUnit === 'kg/lado' ? '' : ' kg'} × {s.reps}
                  </span>
                ))}
              </div>
            </div>

            {/* current sets */}
            {currentSets.length > 0 && (
              <div className="mt-5 space-y-2">
                {currentSets.map((s) => {
                  const prevSame = exercise.prevSession.sets[s.set - 1];
                  const delta = prevSame ? s.reps - prevSame.reps : null;
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-2.5">
                      <span className="flex items-center gap-2 text-sm text-foreground-500">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-[11px] font-semibold text-background-50">
                          {s.set}
                        </span>
                        Série
                      </span>
                      <span className="text-sm font-medium text-foreground-900">
                        {s.weight}{exercise.weightUnit === 'kg/lado' ? ' kg/lado' : ' kg'} × {s.reps}
                        <span className="ml-2 text-xs text-foreground-400">RIR {s.rir}</span>
                      </span>
                      {delta !== null && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${delta > 0 ? 'bg-accent-100 text-accent-700' : delta < 0 ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-500'}`}>
                          {delta > 0 ? `+${delta} rep` : delta < 0 ? `${delta} rep` : 'igual'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* live coach tip */}
            {dica && dica.texto && (
              <div className={`mt-5 rounded-xl p-4 text-sm flex items-start gap-3 ${dica.alerta ? 'bg-primary-100/80 text-primary-900 border border-primary-200' : 'bg-background-100/80 text-foreground-800'}`}>
                <i className={`ri-lightbulb-line text-lg shrink-0 mt-0.5 ${dica.alerta ? 'text-primary-600' : 'text-accent-600'}`}></i>
                <div>
                  <p className="font-semibold text-xs uppercase tracking-wide opacity-75 mb-0.5">Dica do Coach ao Vivo</p>
                  <p>{dica.texto}</p>
                </div>
              </div>
            )}

            {/* add set */}
            <div className="mt-5 border-t border-background-200 pt-4">
              <p className="mb-2 text-xs font-semibold text-foreground-500">Registrar série</p>
              <SetEntry
                minWeight={exercise.minWeight}
                maxWeight={exercise.maxWeight}
                weightUnit={exercise.weightUnit}
                targetReps={exercise.targetReps}
                onSubmit={(s) => {
                  addSet(s);
                  if (dica && dica.descansoSeg) {
                    startRest(dica.descansoSeg);
                  }
                }}
              />
            </div>

            {/* DescansoTimer inline logo após registrar */}
            {resting && restLeft > 0 && (
              <div className="mt-5">
                <DescansoTimer
                  segundos={restLeft}
                  onFinish={() => setResting(false)}
                  onSkip={() => setResting(false)}
                />
              </div>
            )}

            <button
              onClick={finishExercise}
              className={`mt-5 w-full rounded-xl px-6 py-3 text-sm font-semibold transition whitespace-nowrap ${
                exIndex < session.exercises.length - 1
                  ? 'bg-primary-500 text-background-50 hover:bg-primary-600'
                  : 'bg-accent-500 text-background-50 hover:bg-accent-600'
              }`}
            >
              {exIndex < session.exercises.length - 1
                ? 'CONCLUIR EXERCÍCIO → PRÓXIMO'
                : 'FINALIZAR FORÇA'}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-lg transition hover:bg-primary-600"
              aria-label="Falar com o coach"
            >
              <i className="ri-chat-3-line text-2xl"></i>
            </button>
          </div>
        )}

        {phase === 'STRENGTH_COMPLETE' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Força concluída 💪</h2>
            <p className="mt-1 text-sm text-foreground-600">Nenhum desconforto relevante relatado.</p>
            <div className="mt-5 space-y-2">
              {session.exercises.map((e) => {
                const sets = setsByEx[e.id] ?? [];
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground-800">{e.name}</span>
                    <span className="text-sm text-foreground-500">{sets.length} séries</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl bg-primary-100/70 p-4 text-sm text-foreground-800">
              <span className="font-semibold text-primary-700">Decisão do Coach:</span> Vamos fazer cardio hoje?
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setPhase('CARDIO')}
                className="flex-1 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
              >
                SIM, FAZER CARDIO
              </button>
              <button
                onClick={() => { setCardioDone(true); setPhase('SESSION_REVIEW'); }}
                className="flex-1 rounded-xl border border-background-200 bg-background-50 px-6 py-3 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
              >
                PULAR CARDIO
              </button>
            </div>
          </div>
        )}

        {phase === 'CARDIO' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Cardio</h2>
            <p className="mt-1 mb-4 text-sm text-foreground-600">{session.cardio?.type} · {session.cardio?.note}</p>
            <CardioEntry
              onSubmit={(atividades, fotoNome) => {
                setCardioDone(true);
                setPhase('SESSION_REVIEW');
              }}
            />
          </div>
        )}

        {phase === 'SESSION_REVIEW' && (() => {
          const durationMin = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
          const allSets = Object.values(setsByEx).flat().filter((x) => x.completed);
          const totalSets = allSets.length;
          const totalVolume = allSets.reduce((acc, s) => acc + (s.weight * s.reps), 0);
          const exercisesCount = Object.values(setsByEx).filter((l) => l.some((x) => x.completed)).length;

          const progressions = session.exercises.map((e) => {
            const sets = setsByEx[e.id] ?? [];
            if (sets.length === 0) return null;
            const maxWeight = Math.max(...sets.map(s => s.weight));
            const totalReps = sets.reduce((acc, s) => acc + s.reps, 0);
            return {
              name: e.name,
              detail: `${maxWeight}${e.weightUnit === 'kg/lado' ? ' kg/lado' : ' kg'} · ${totalReps} reps totais`
            };
          }).filter(Boolean);

          const handleFinishSession = async () => {
            if (user) {
              // Campos que as regras do Firestore exigem: title e done_at (texto).
              const w = {
                user_id: user.id,
                title: session.title,
                done_at: new Date().toISOString(),
                duration_min: durationMin,
                exercises: exercisesCount,
                sets: totalSets,
                volume_kg: totalVolume,
              };
              try {
                const key = `bc_workouts_${user.id}`;
                const list = JSON.parse(localStorage.getItem(key) || '[]');
                localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
              } catch {
                // Sem armazenamento local: fica só no Firebase.
              }
              await setUserDoc(user.id, 'workouts', session.id, w).catch(() => {});
            }
            setPhase('SESSION_COMPLETE');
          };

          return (
            <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
              <h2 className="font-heading text-xl font-bold text-foreground-950">Resumo da sessão</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Duração', value: `${durationMin} min`, icon: 'ri-time-line' },
                  { label: 'Exercícios', value: exercisesCount, icon: 'ri-heart-pulse-line' },
                  { label: 'Séries', value: totalSets, icon: 'ri-list-unordered' },
                  { label: 'Volume', value: `${totalVolume.toLocaleString('pt-BR')} kg`, icon: 'ri-fire-line' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-background-100/70 p-3">
                    <i className={`${s.icon} text-primary-500`}></i>
                    <p className="mt-1 font-heading text-lg font-bold text-foreground-950">{s.value}</p>
                    <p className="text-[11px] text-foreground-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {progressions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Progressões</h3>
                  {progressions.map((p) => p && (
                    <div key={p.name} className="rounded-lg bg-accent-100/60 px-4 py-2.5 text-sm text-accent-800">
                      <span className="font-semibold">{p.name}:</span> {p.detail}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleFinishSession}
                className="mt-5 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
              >
                FINALIZAR SESSÃO
              </button>
            </div>
          );
        })()}

        {phase === 'SESSION_COMPLETE' && (
          <div className="rounded-2xl border border-accent-200 bg-accent-100/50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-background-50">
              <i className="ri-check-line text-2xl"></i>
            </div>
            <h2 className="mt-4 font-heading text-2xl font-bold text-foreground-950">Sessão concluída!</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-foreground-600">Excelente trabalho. Bom descanso e hidratação.</p>
            <p className="mt-3 text-xs text-foreground-400">Tudo foi salvo no seu diário mestre.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              VOLTAR PARA O HOJE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}