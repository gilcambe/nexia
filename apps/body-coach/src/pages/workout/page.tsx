import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { session, sessionReview, type SetLog } from '@/mocks/workout';
import SetEntry, { type NewSet } from './components/SetEntry';

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
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('PRE_SESSION');
  const [exIndex, setExIndex] = useState(0);
  const [setsByEx, setSetsByEx] = useState<Record<string, SetLog[]>>({});
  const [restLeft, setRestLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const [cardioDone, setCardioDone] = useState(false);

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
              {session.exercises.length} exercícios · {session.estimatedMinutes} min. Volume reduzido 20% hoje.
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

            {/* add set */}
            <div className="mt-5 border-t border-background-200 pt-4">
              <p className="mb-2 text-xs font-semibold text-foreground-500">Registrar série</p>
              <SetEntry
                minWeight={exercise.minWeight}
                maxWeight={exercise.maxWeight}
                weightUnit={exercise.weightUnit}
                targetReps={exercise.targetReps}
                onSubmit={addSet}
              />
            </div>

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
          </div>
        )}

        {/* rest overlay */}
        {resting && restLeft > 0 && (
          <div className="rounded-2xl border border-background-200 bg-background-100/80 p-6 text-center">
            <p className="text-sm font-semibold text-foreground-500">Descanso</p>
            <p className="font-heading text-5xl font-bold text-foreground-950">{restLeft}s</p>
            <button
              onClick={() => setResting(false)}
              className="mt-3 rounded-full bg-background-50 border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-200"
            >
              Pular descanso
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
            <p className="mt-1 text-sm text-foreground-600">{session.cardio?.type} · {session.cardio?.note}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-foreground-500">Duração (min)</span>
                <input defaultValue="12" className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-foreground-500">Inclinação (%)</span>
                <input defaultValue="8" className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm" />
              </label>
            </div>
            <p className="mt-3 text-xs text-foreground-400">
              As calorias da máquina são tratadas como estimativa, não como verdade absoluta. Você pode fotografar a máquina e validar depois.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => { setCardioDone(true); setPhase('SESSION_REVIEW'); }}
                className="flex-1 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
              >
                CONCLUIR
              </button>
              <button
                onClick={() => { setCardioDone(true); setPhase('SESSION_REVIEW'); }}
                className="flex-1 rounded-xl border border-background-200 bg-background-50 px-6 py-3 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
              >
                ENCERRAR
              </button>
            </div>
          </div>
        )}

        {phase === 'SESSION_REVIEW' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Resumo da sessão</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Duração', value: `${sessionReview.duration} min`, icon: 'ri-time-line' },
                { label: 'Exercícios', value: sessionReview.exercises, icon: 'ri-heart-pulse-line' },
                { label: 'Séries', value: sessionReview.sets, icon: 'ri-list-unordered' },
                { label: 'Volume', value: `${sessionReview.volumeKg.toLocaleString('pt-BR')} kg`, icon: 'ri-fire-line' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-background-100/70 p-3">
                  <i className={`${s.icon} text-primary-500`}></i>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground-950">{s.value}</p>
                  <p className="text-[11px] text-foreground-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Progressões</h3>
              {sessionReview.progressions.map((p) => (
                <div key={p.name} className="rounded-lg bg-accent-100/60 px-4 py-2.5 text-sm text-accent-800">
                  <span className="font-semibold">{p.name}:</span> {p.detail}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-background-100/70 p-4 text-sm text-foreground-700">
              <span className="font-semibold text-foreground-800">Alterações hoje:</span>{' '}
              {sessionReview.changes.map((c) => `${c.made} (${c.reason})`).join(' · ')}
            </div>

            <button
              onClick={() => setPhase('SESSION_COMPLETE')}
              className="mt-5 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              FINALIZAR SESSÃO
            </button>
          </div>
        )}

        {phase === 'SESSION_COMPLETE' && (
          <div className="rounded-2xl border border-accent-200 bg-accent-100/50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-background-50">
              <i className="ri-check-line text-2xl"></i>
            </div>
            <h2 className="mt-4 font-heading text-2xl font-bold text-foreground-950">Sessão concluída!</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-foreground-600">{sessionReview.nextRecommendation}</p>
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