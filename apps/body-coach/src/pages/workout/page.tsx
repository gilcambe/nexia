import { useState, useEffect, useRef } from 'react';
import { guardarMomento, listarMomentos } from '@/lib/momentos';
import { Link, useNavigate } from 'react-router-dom';
import { type SetLog, type Session } from '@/mocks/workout';
import type { Answers } from '@/lib/trainingPlan';
import { type TreinoDoDia, trocarExercicio } from '@/lib/dayPlan';
import { moverExercicio } from '@/lib/ordemTreino';
import { fichaDoPerfil, avancarFicha, treinoDaFicha, type Ficha } from '@/lib/ficha';
import { useWakeLock } from '@/lib/useWakeLock';
import { sugerirCarga } from '@/lib/cargaSugerida';
import VideoDoCoach from '@/components/feature/VideoDoCoach';
import { alternativas, lesoesDoTexto, POR_ID, type Lesao } from '@/lib/exerciseDb';
import { diaDaFichaCoach, sessaoDaFichaCoach, temFichaCoach, type FichaCoach } from '@/lib/coach/fichaCoach';
import { guardarAndamento, lerAndamento, limparAndamento, seriesFeitas, type Origem, type TreinoAndamento } from '@/lib/treinoAndamento';
import { apiOuGuardar, gravarOuGuardar } from '@/lib/pendentes';
import PreTreinoCoach from './components/PreTreinoCoach';
import PreTreino from './components/PreTreino';
import MusicaTreino from './components/MusicaTreino';
import EntretenimentoTreino from './components/EntretenimentoTreino';
import { minutosDoTexto } from '@/lib/entretenimento';
import GravarParaCoach from '@/components/feature/GravarParaCoach';
import { dicaAoVivo } from '@/lib/liveCoach';
import { getUserDoc, listUserDocs } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import SetEntry, { type NewSet } from './components/SetEntry';
import { ehPorTempo } from '@/lib/porTempo';
import ExercicioExtra, { type ModoExtra } from './components/ExercicioExtra';
import { adicionarDepois, notaDoExtra, novoExtra, textoExtra, trocarPorLivre, type Extra } from '@/lib/exercicioLivre';
import DescansoTimer from './components/DescansoTimer';
import { CardioEntry } from './components/CardioEntry';
import type { CardioAtividade } from '@/lib/cardioDoTexto';
import { useCoach } from '@/components/feature/CoachContext';
import { setTreinoAtivo } from '@/lib/treinoAtivo';
import { ehRecorde } from '@/lib/recorde';
import CompartilharCartao from '@/components/feature/CompartilharCartao';
import MonitorCardiaco from '@/components/feature/MonitorCardiaco';
import { estadoFC, kcalMusculacao, zerarSessaoFC } from '@/lib/ferramentas/frequencia';
import type { DadosCartao } from '@/lib/ferramentas/cartao';
import { definirVoz, falar, fraseExercicio, fraseFim, fraseSerie, vozDisponivel, vozLigada } from '@/lib/ferramentas/vozCoach';
import { useTelaLigada } from '@/lib/telaLigada';
import { duplaAtual, enviarStatusDupla } from '@/lib/ferramentas/social';
import { confirmar } from '../../lib/dialogo';

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
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [fichaCoach, setFichaCoach] = useState<{ ficha: FichaCoach; dia: number } | null>(null);
  const [usarApp, setUsarApp] = useState(false);
  const [origem, setOrigem] = useState<Origem>({ tipo: 'livre' });
  const [andamento, setAndamento] = useState<TreinoAndamento | null>(() => (user ? lerAndamento(user.id) : null));
  const [retomado, setRetomado] = useState<TreinoAndamento | null>(null);
  const [estado, setEstado] = useState<'loading' | 'rest' | 'no-plan' | 'ready'>('loading');

  useEffect(() => {
    if (!user) return;
    setAndamento(lerAndamento(user.id));
    getUserDoc<{ onboarding?: Answers; ficha?: Partial<Ficha>; mobility?: string[]; ficha_coach?: unknown; ficha_coach_dia?: number }>(user.id, 'profile', 'main')
      .then((p) => {
        // Com ficha do coach, treina mesmo sem ter respondido o questionário.
        if (temFichaCoach(p?.ficha_coach)) setFichaCoach({ ficha: p.ficha_coach, dia: diaDaFichaCoach(p.ficha_coach, p.ficha_coach_dia) });
        if (!p?.onboarding) return setEstado(temFichaCoach(p?.ficha_coach) ? 'ready' : 'no-plan');
        setFicha(fichaDoPerfil(p as Parameters<typeof fichaDoPerfil>[0]));
        setRespostas({ ...(p.onboarding as unknown as Record<string, unknown>), mobility: p.mobility ?? [] });
        setEstado('ready');
      })
      .catch(() => setEstado('no-plan'));
  }, [user]);

  // Treino concluído: o ciclo da ficha (do app ou do coach) avança para o próximo dia. Treino "só por hoje" não mexe.
  const treinoSalvo = (o: Origem) => {
    if (!user) return;
    if (o.tipo === 'ficha') {
      const nova = avancarFicha(o.ficha);
      setFicha(nova);
      void gravarOuGuardar(user.id, 'profile', 'main', { ficha: nova }, true).catch(() => {});
    } else if (o.tipo === 'coach') {
      const dia = (o.dia + 1) % Math.max(1, o.dias);
      setFichaCoach((f) => (f ? { ...f, dia } : f));
      void gravarOuGuardar(user.id, 'profile', 'main', { ficha_coach_dia: dia }, true).catch(() => {});
    }
    setOrigem({ tipo: 'livre' });
  };

  if (!treino && andamento) {
    return (
      <ContinuarTreino
        t={andamento}
        onContinuar={() => { setRetomado(andamento); setOrigem(andamento.origem); setTreino({ sessao: andamento.session, avisos: [], lesoes: andamento.lesoes }); setAndamento(null); }}
        onDescartar={() => { if (user) limparAndamento(user.id); setAndamento(null); }}
      />
    );
  }
  if (estado !== 'ready') return <WorkoutEmpty estado={estado} />;
  if (!treino && fichaCoach && (!usarApp || !respostas)) {
    return (
      <PreTreinoCoach
        ficha={fichaCoach.ficha}
        diaInicial={fichaCoach.dia}
        onUsarApp={() => (respostas ? setUsarApp(true) : undefined)}
        onStart={(dia) => {
          setOrigem({ tipo: 'coach', dia, dias: fichaCoach.ficha.dias.length });
          setTreino({ sessao: sessaoDaFichaCoach(fichaCoach.ficha, dia), avisos: [], lesoes: respostas ? [...lesoesDoTexto(respostas.injuries, respostas.symptoms, respostas.history)] : [] });
        }}
      />
    );
  }
  if (!respostas) return <WorkoutEmpty estado="no-plan" />;
  if (!treino) {
    return (
      <PreTreino
        respostas={respostas}
        divisaoInicial={ficha?.divisao}
        diaInicial={ficha?.proximoDia}
        onStart={(cfg) => {
          const daFicha = !!ficha && cfg.divisao === ficha.divisao && cfg.diaDaDivisao === ficha.proximoDia;
          setOrigem(daFicha && ficha ? { tipo: 'ficha', ficha } : { tipo: 'livre' });
          setTreino(treinoDaFicha(respostas, cfg.divisao, cfg.diaDaDivisao, cfg.estado, cfg.enfase));
        }}
      />
    );
  }
  return <WorkoutFlow session={treino.sessao} lesoes={treino.lesoes} origem={origem} inicial={retomado} onSessionChange={(sessao) => setTreino({ ...treino, sessao })} onSaved={() => treinoSalvo(origem)} />;
}

// Treino que ficou pela metade (saiu da tela, fechou o app, acabou a bateria): continuar ou começar outro.
function ContinuarTreino({ t, onContinuar, onDescartar }: { t: TreinoAndamento; onContinuar: () => void; onDescartar: () => void }) {
  const feitas = seriesFeitas(t);
  const min = Math.max(1, Math.round((Date.now() - new Date(t.startedAt).getTime()) / 60000));
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-primary-200 bg-primary-50 p-4 sm:p-6" data-testid="continuar-treino">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-700"><i className="ri-history-line mr-1"></i>Treino em andamento</p>
      <h1 className="mt-1 font-heading text-xl font-bold text-foreground-950">{t.session.title}</h1>
      <p className="mt-2 text-sm text-foreground-700">
        Você parou no exercício {Math.min(t.exIndex + 1, t.session.exercises.length)} de {t.session.exercises.length}, com {feitas} série{feitas === 1 ? '' : 's'} anotada{feitas === 1 ? '' : 's'}. Começou há {min} min. Nada foi perdido.
      </p>
      <button type="button" onClick={onContinuar} className="mt-4 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 hover:bg-primary-600">
        <i className="ri-play-circle-line mr-1"></i>CONTINUAR DE ONDE PAREI
      </button>
      <button type="button" onClick={async () => { if (await confirmar('Apagar o treino em andamento e começar outro?')) onDescartar(); }} className="mt-3 w-full rounded-xl border border-background-200 bg-background-50 px-6 py-2.5 text-sm font-medium text-foreground-700">
        Descartar e começar outro
      </button>
    </div>
  );
}

function WorkoutEmpty({ estado }: { estado: string }) {
  if (estado === 'loading') return <p className="text-sm text-foreground-500">Carregando...</p>;
  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
      <h1 className="font-heading text-xl font-bold text-foreground-950">{estado === 'rest' ? 'Hoje é dia de descanso' : 'Responda o questionário para montar seu treino'}</h1>
      <p className="mt-2 text-sm text-foreground-600">{estado === 'rest' ? 'Recupere bem: sono, água e alimentação. Veja a sua ficha de treino.' : 'Com seus dias livres e seu nível, o treino do dia aparece aqui.'}</p>
      <Link to={estado === 'rest' ? '/plan' : '/onboarding'} className="mt-4 inline-flex rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50">{estado === 'rest' ? 'Ver ficha' : 'Responder agora'}</Link>
    </div>
  );
}

function WorkoutFlow({ session, lesoes = [], origem, inicial, onSessionChange, onSaved }: { session: Session; lesoes?: Lesao[]; origem: Origem; inicial?: TreinoAndamento | null; onSessionChange?: (s: Session) => void; onSaved?: () => void }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const pesoAluno = Number(profile?.onboarding?.weight) || 70;
  const { setOpen } = useCoach();
  const [startedAt] = useState(() => inicial?.startedAt ?? new Date().toISOString());
  const [phase, setPhase] = useState<Phase>(() => (inicial?.phase as Phase | undefined) ?? 'PRE_SESSION');
  const [ficouNoCelular, setFicouNoCelular] = useState(false);
  const [esforco, setEsforco] = useState(0); // 1 a 5, opcional
  const [comentario, setComentario] = useState('');
  useWakeLock(phase !== 'PRE_SESSION' && phase !== 'SESSION_COMPLETE');
  // Cartão do treino para o story (Instagram/WhatsApp), montado ao finalizar.
  const [cartao, setCartao] = useState<Omit<DadosCartao, 'nome' | 'link'> | null>(null);
  const [exIndex, setExIndex] = useState(() => inicial?.exIndex ?? 0);
  const [setsByEx, setSetsByEx] = useState<Record<string, SetLog[]>>(() => inicial?.setsByEx ?? {});
  const [restLeft, setRestLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const [cardioDone, setCardioDone] = useState(false);
  const [cardioFeito, setCardioFeito] = useState<CardioAtividade[]>(() => inicial?.cardioFeito ?? []);
  const [extras, setExtras] = useState<Extra[]>(() => inicial?.extras ?? []);
  const [extraModo, setExtraModo] = useState<ModoExtra | null>(null);

  // Guarda o treino no celular a cada mudança: sair da tela ou fechar o app não perde nada.
  useEffect(() => {
    if (!user?.id) return;
    if (phase === 'PRE_SESSION') return;
    if (phase === 'SESSION_COMPLETE') { limparAndamento(user.id); return; }
    guardarAndamento(user.id, { startedAt, phase, exIndex, session, lesoes, setsByEx, cardioFeito, origem, extras });
  }, [user?.id, phase, exIndex, session, lesoes, setsByEx, cardioFeito, origem, startedAt, extras]);
  // Melhores séries de treinos anteriores, por nome de exercício (para o selo de recorde).
  const [historicoSeries, setHistoricoSeries] = useState<Record<string, { weight: number; reps: number }[]>>({});
  useEffect(() => {
    if (!user?.id) return;
    listUserDocs<{ melhores?: Record<string, { weight: number; reps: number }> }>(user.id, 'workouts', 'done_at', 'desc')
      .then((lista) => {
        const h: Record<string, { weight: number; reps: number }[]> = {};
        for (const w of lista) {
          for (const [nome, m] of Object.entries(w.melhores ?? {})) (h[nome] ??= []).push(m);
        }
        setHistoricoSeries(h);
      })
      .catch(() => setHistoricoSeries({}));
  }, [user?.id]);
  const [showVideo, setShowVideo] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  const exercise = session.exercises[exIndex] ?? session.exercises[0];

  // Coach por voz: anuncia cada exercício com a carga sugerida (liga e desliga na barra do treino).
  const [voz, setVoz] = useState(vozLigada);
  useEffect(() => {
    if (phase !== 'EXERCISE_ACTIVE') return;
    const sug = sugerirCarga(historicoSeries[exercise.name], exercise.targetReps);
    falar(fraseExercicio(exercise.name, exercise.targetSets || 3, exercise.targetReps || '8-12', sug));
    void enviarStatusDupla({ exercicio: exercise.name, series: (setsByEx[exercise.id] ?? []).length, bpm: estadoFC().bpm || 0 }, true);
    // só ao trocar de exercício
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIndex, voz]);

  // O descanso conta sozinho no DescansoTimer (pelo relógio); cada série nova recomeça a contagem.
  const [restKey, setRestKey] = useState(0);
  const startRest = (sec: number) => {
    setRestLeft(sec);
    setRestKey((k) => k + 1);
    setResting(true);
  };
  useTelaLigada(phase !== 'SESSION_COMPLETE');

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
      ...(newSet.falha ? { falha: true } : {}),
      ...(newSet.nota ? { nota: newSet.nota } : {}),
      ...(newSet.porLado ? { porLado: true } : {}),
      ...(newSet.unilateral ? { unilateral: true } : {}),
      ...(newSet.porTempo ? { porTempo: true } : {}),
    };
    setSetsByEx((v) => ({ ...v, [exercise.id]: [...prev, setLog] }));
    startRest(exercise.restSec);
    const antes = historicoSeries[exercise.name] ?? [];
    const recorde = antes.length > 0 && ehRecorde(antes, { weight: newSet.weight, reps: newSet.reps });
    falar(fraseSerie(setLog.set, exercise.targetSets || 3, newSet.weight, newSet.reps, recorde, exercise.restSec));
    void enviarStatusDupla({ exercicio: exercise.name, series: setLog.set, bpm: estadoFC().bpm || 0, recado: recorde ? 'Recorde! 🏆' : '' }, true);
  };

  // Apaga uma série registrada por engano e renumera as outras.
  const removerSerie = (id: string) => setSetsByEx((v) => ({ ...v, [exercise.id]: (v[exercise.id] ?? []).filter((s) => s.id !== id).map((s, i) => ({ ...s, set: i + 1 })) }));

  const finishExercise = () => {
    if (exIndex < session.exercises.length - 1) {
      setExIndex((i) => i + 1);
      setPhase('EXERCISE_ACTIVE');
    } else {
      setPhase('STRENGTH_COMPLETE');
    }
  };

  const currentSets = setsByEx[exercise.id] ?? [];

  // Cargas ditas no chat do coach caem direto na ficha do exercício atual.
  useEffect(() => {
    if (phase !== 'EXERCISE_ACTIVE') {
      setTreinoAtivo(null);
      return;
    }
    setTreinoAtivo((series) => {
      setSetsByEx((v) => {
        const prev = v[exercise.id] ?? [];
        const novas: SetLog[] = series.map((s, i) => ({
          id: `${exercise.id}-chat-${Date.now()}-${i}`,
          set: prev.length + i + 1,
          weight: s.weight,
          reps: s.reps,
          rir: null,
          rpe: null,
          restSec: exercise.restSec,
          completed: true,
        }));
        return { ...v, [exercise.id]: [...prev, ...novas] };
      });
      return `Anotei ${series.length} série(s) em ${exercise.name}.`;
    });
    return () => setTreinoAtivo(null);
  }, [phase, exercise]);

  // Extrair faixa de repetições alvo do exercício (ex: "8-12 reps" -> [8, 12])
  const parseReps = (target: string): [number, number] => {
    const match = target.match(/(\d+)\s*-\s*(\d+)/);
    if (match) return [parseInt(match[1], 10), parseInt(match[2], 10)];
    return [8, 12];
  };

  // Prancha e isometria: a dica de reps e carga não serve.
  const dica = ehPorTempo(exercise.name) ? null : dicaAoVivo({
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

      {/* barra de música/entretenimento/coach: fica no fluxo da página, nunca por cima dos botões */}
      {phase !== 'PRE_SESSION' && phase !== 'SESSION_COMPLETE' && (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2" data-testid="barra-treino">
          <MusicaTreino variante="pilula" />
          <EntretenimentoTreino variante="pilula" />
          {vozDisponivel() && (
            <button type="button" onClick={() => { const n = !voz; definirVoz(n); setVoz(n); if (n) falar('Coach por voz ligado.', true); else window.speechSynthesis?.cancel(); }} aria-pressed={voz} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${voz ? 'bg-accent-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`} aria-label={voz ? 'Desligar coach por voz' : 'Ligar coach por voz'}>
              <i className={voz ? 'ri-volume-up-line text-base' : 'ri-volume-mute-line text-base'}></i>Voz
            </button>
          )}
          <MomentoTreino />
          {duplaAtual() && (
            <Link to="/ferramentas/dupla" className="inline-flex items-center gap-1.5 rounded-full border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-700"><i className="ri-team-line text-base"></i>Dupla</Link>
          )}
          <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-2.5 text-sm font-semibold text-background-50 shadow-sm" aria-label="Falar com o coach">
            <i className="ri-chat-3-line text-base"></i>Coach
          </button>
        </div>
      )}
      <div className="space-y-4">
        {phase === 'PRE_SESSION' && <MusicaTreino variante="cartao" />}
        {phase !== 'SESSION_COMPLETE' && phase !== 'SESSION_REVIEW' && <MonitorCardiaco compacto soConectado={phase !== 'PRE_SESSION' && phase !== 'WARMUP'} />}
        {phase === 'PRE_SESSION' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
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
              onClick={() => { zerarSessaoFC(); setPhase('WARMUP'); }}
              className="mt-6 w-full rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              INICIAR TREINO
            </button>
          </div>
        )}

        {phase === 'WARMUP' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
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
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-primary-600">
              Exercício {exIndex + 1} de {session.exercises.length}
            </p>
            <h2 className="mt-1 font-heading text-2xl font-bold leading-tight text-foreground-950 sm:text-3xl">{exercise.name}</h2>
            <p className="mt-1 text-base text-foreground-600">
              {exercise.targetSets || 3} séries · {ehPorTempo(exercise.name) ? 'por tempo' : `${exercise.targetReps} reps`} · descanso {exercise.restSec || 60} s
            </p>

            <VideoDoCoach id={exercise.id} nome={exercise.name} className="aspect-[4/3] w-full rounded-xl sm:max-w-sm" />

            {exercise.note && (
              <p className="mt-3 rounded-xl bg-background-100/70 p-3 text-sm text-foreground-700">
                <i className="ri-information-line mr-1 text-primary-500"></i>{exercise.note}
              </p>
            )}
            {exercise.prevSession.sets.length > 0 && (
              <p className="mt-2 text-sm text-foreground-600">
                <i className="ri-history-line mr-1 text-accent-600"></i>Última vez: {exercise.prevSession.sets.map((s) => `${s.weight} × ${s.reps}`).join(' · ')}
              </p>
            )}

            {/* séries feitas */}
            {currentSets.length > 0 && (
              <div className="mt-4 space-y-2">
                {currentSets.map((s) => {
                  const prevSame = exercise.prevSession.sets[s.set - 1];
                  const delta = prevSame ? s.reps - prevSame.reps : null;
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-background-100/70 px-4 py-3">
                      <span className="flex items-center gap-2 text-base text-foreground-600">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-background-50">{s.set}</span>
                        Série
                      </span>
                      <span className="text-right text-base font-semibold text-foreground-950">
                        {s.porTempo ? `${s.reps} s` : <>{s.weight}{s.porLado || exercise.weightUnit === 'kg/lado' ? ' kg cada lado' : ' kg'} × {s.reps}{s.unilateral ? ' (unilateral)' : ''}</>}
                        <span className="ml-2 text-sm font-normal text-foreground-500">{s.porTempo ? '' : s.falha ? 'falha' : `RIR ${s.rir}`}</span>
                        {s.nota && <span className="block text-sm font-normal text-primary-700"><i className="ri-sticky-note-line mr-0.5"></i>{s.nota}</span>}
                      </span>
                      {delta !== null && (
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${delta > 0 ? 'bg-accent-100 text-accent-700' : delta < 0 ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-500'}`}>
                          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '='}
                        </span>
                      )}
                      <button type="button" onClick={() => removerSerie(s.id)} aria-label={`Apagar série ${s.set}`} data-testid="apagar-serie" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground-500 hover:bg-red-50 hover:text-red-600"><i className="ri-delete-bin-line text-lg"></i></button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* feito no intervalo (ex.: abdominal no descanso) */}
            {extras.filter((x) => x.depoisDe === exercise.name).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="extras-do-exercicio">
                {extras.filter((x) => x.depoisDe === exercise.name).map((x) => (
                  <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-secondary-100 py-1.5 pl-3 pr-1 text-sm font-medium text-secondary-900">
                    <i className="ri-timer-line"></i>No intervalo: {textoExtra(x)}
                    <button type="button" onClick={() => setExtras((l) => l.filter((y) => y.id !== x.id))} aria-label={`Apagar ${x.nome}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary-200"><i className="ri-close-line"></i></button>
                  </span>
                ))}
              </div>
            )}

            {/* descanso logo após registrar */}
            {resting && restLeft > 0 && (
              <div className="mt-4">
                <DescansoTimer
                  key={restKey}
                  segundos={restLeft}
                  proximo={(() => { const feitas = currentSets.length; return feitas < (exercise.targetSets || 3) ? `${exercise.name}, série ${feitas + 1}` : session.exercises[exIndex + 1]?.name; })()}
                  onFinish={() => setResting(false)}
                  onSkip={() => setResting(false)}
                />
                <button type="button" onClick={() => setExtraModo('intervalo')} className="mt-2 w-full rounded-xl border border-dashed border-secondary-300 px-4 py-3 text-base font-semibold text-secondary-800" data-testid="fiz-no-intervalo">
                  <i className="ri-add-line mr-1"></i>Fiz algo no descanso? (ex.: abdominal)
                </button>
              </div>
            )}

            {/* dica do coach ao vivo: só quando pede atenção */}
            {dica && dica.texto && dica.alerta && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-100/80 p-3 text-sm text-primary-900">
                <i className="ri-lightbulb-line mt-0.5 text-lg text-primary-600"></i>{dica.texto}
              </p>
            )}

            {/* registrar série */}
            <div className="mt-4 border-t border-background-200 pt-4">
              <SetEntry
                key={exercise.id}
                minWeight={exercise.minWeight}
                maxWeight={exercise.maxWeight}
                weightUnit={exercise.weightUnit}
                exercicio={exercise.name}
                targetReps={exercise.targetReps}
                sugestao={exercise.sets.length === 0 && !ehPorTempo(exercise.name) ? sugerirCarga(historicoSeries[exercise.name], exercise.targetReps) : null}
                ultima={(() => { const l = currentSets[currentSets.length - 1] ?? exercise.sets[exercise.sets.length - 1]; return l ? { weight: l.weight, reps: l.reps } : null; })()}
                onSubmit={(s) => {
                  addSet(s);
                  if (dica && dica.descansoSeg) {
                    startRest(dica.descansoSeg);
                  }
                }}
              />
            </div>

            <div className="mt-4 flex gap-2">
              {exIndex > 0 && (
                <button
                  onClick={() => { setResting(false); setExIndex((i) => Math.max(0, i - 1)); }}
                  aria-label="Voltar ao exercício anterior"
                  className="shrink-0 rounded-2xl border-2 border-background-200 bg-background-50 px-4 py-4 text-base font-bold text-foreground-700 transition hover:bg-background-100"
                >
                  ← ANTERIOR
                </button>
              )}
              <button
                onClick={finishExercise}
                className={`min-w-0 flex-1 rounded-2xl px-4 py-4 text-base font-bold transition ${
                  exIndex < session.exercises.length - 1
                    ? 'bg-primary-500 text-background-50 hover:bg-primary-600'
                    : 'bg-accent-500 text-background-50 hover:bg-accent-600'
                }`}
              >
                {exIndex < session.exercises.length - 1 ? 'CONCLUIR → PRÓXIMO' : 'FINALIZAR FORÇA'}
              </button>
            </div>

            {/* mais opções: botões grandes, um toque cada */}
            <p className="mb-2 mt-5 text-sm font-semibold text-foreground-500">Mais opções</p>
            <div className="grid grid-cols-2 gap-2" data-testid="mais-opcoes">
              {[
                { rotulo: 'Ver execução', icone: 'ri-play-circle-line', acao: () => setShowVideo(true) },
                { rotulo: 'Trocar exercício', icone: 'ri-refresh-line', acao: () => setShowSwapModal(true) },
                { rotulo: 'Fiz outro exercício', icone: 'ri-edit-2-line', acao: () => setExtraModo('trocar'), id: 'fiz-outro' },
                { rotulo: 'Fiz no intervalo', icone: 'ri-timer-line', acao: () => setExtraModo('intervalo') },
              ].map((o) => (
                <button key={o.rotulo} type="button" onClick={o.acao} data-testid={o.id} className="flex min-h-[52px] items-center gap-2 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-left text-sm font-semibold text-foreground-800 hover:bg-background-100">
                  <i className={`${o.icone} text-xl text-primary-600`}></i>{o.rotulo}
                </button>
              ))}
              <GravarParaCoach compacto exercicio={exercise.name} detalhe={(() => { const u = currentSets[currentSets.length - 1]; return u ? `${u.weight} kg x ${u.reps}` : undefined; })()} />
              <div className="flex min-h-[52px] items-center justify-between gap-1 rounded-xl border border-background-200 bg-background-50 px-2">
                <span className="pl-1 text-sm font-semibold text-foreground-800">Ordem</span>
                <span className="flex gap-1">
                  <button
                    onClick={() => {
                      const novaSessao = moverExercicio(session, exIndex, exIndex - 1);
                      if (novaSessao !== session) {
                        onSessionChange?.(novaSessao);
                        setExIndex((i) => Math.max(0, i - 1));
                      }
                    }}
                    disabled={exIndex === 0}
                    title="Mudar a ordem: fazer este exercício antes"
                    aria-label="Mudar a ordem: fazer este exercício antes"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-100 text-foreground-700 disabled:opacity-30"
                  >
                    <i className="ri-arrow-up-line text-lg"></i>
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
                    title="Mudar a ordem: fazer este exercício depois"
                    aria-label="Mudar a ordem: fazer este exercício depois"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-100 text-foreground-700 disabled:opacity-30"
                  >
                    <i className="ri-arrow-down-line text-lg"></i>
                  </button>
                </span>
              </div>
            </div>

            {/* modal vídeo */}
            {showVideo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-background-50 p-4 sm:p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-foreground-950">Como executar: {exercise.name}</h3>
                    <button onClick={() => setShowVideo(false)} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-400 hover:bg-background-200">
                      <i className="ri-close-line text-2xl"></i>
                    </button>
                  </div>
                  <VideoDoCoach id={exercise.id} nome={exercise.name} className="aspect-square w-full rounded-xl" gravar={false} />
                  <p className="mt-2 text-sm text-foreground-500">Posição inicial e final do movimento. Capriche na postura e controle a descida.</p>
                  <button
                    onClick={() => setShowVideo(false)}
                    className="mt-5 w-full rounded-xl bg-primary-500 px-5 py-3 text-base font-semibold text-background-50 hover:bg-primary-600"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}

            {/* modal trocar exercício */}
            {showSwapModal && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
                <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-background-50 p-5 shadow-xl sm:rounded-3xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-xl font-bold text-foreground-950">Trocar exercício</h3>
                    <button onClick={() => setShowSwapModal(false)} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-400 hover:bg-background-200">
                      <i className="ri-close-line text-2xl"></i>
                    </button>
                  </div>
                  <button type="button" onClick={() => { setShowSwapModal(false); setExtraModo('trocar'); }} className="mt-3 w-full rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-4 py-3 text-left text-base font-semibold text-primary-700" data-testid="escrever-exercicio">
                    <i className="ri-edit-2-line mr-1"></i>Não está na lista? Escreva o nome
                  </button>
                  <p className="mt-3 text-sm text-foreground-600">Ou escolha uma opção para {exercise.name}:</p>
                  <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
                    {alternativas(exercise.id, new Set(lesoes), [], session.exercises.map((e) => e.id), exercise.muscleGroup).map(({ ex: alt, aviso }) => (
                      <button
                        key={alt.id}
                        onClick={() => {
                          onSessionChange?.(trocarExercicio(session, exercise.id, alt.id));
                          setShowSwapModal(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-background-200 bg-background-100/60 p-4 text-left text-base font-medium text-foreground-800 transition hover:border-primary-300 hover:bg-primary-50"
                      >
                        <span>
                          {alt.nome}
                          {aviso && <span className="mt-0.5 block text-sm font-normal text-amber-700">{aviso}</span>}
                        </span>
                        <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {extraModo && (
              <ExercicioExtra
                modoInicial={extraModo}
                atual={exercise.name}
                onFechar={() => setExtraModo(null)}
                onTrocar={(nome) => onSessionChange?.(trocarPorLivre(session, exIndex, nome))}
                onAdicionar={(nome) => { onSessionChange?.(adicionarDepois(session, exIndex, nome)); setResting(false); setExIndex((i) => i + 1); }}
                onIntervalo={(nome, quanto) => { const x = novoExtra(nome, quanto, exercise.name); if (x) setExtras((l) => [...l, x]); }}
              />
            )}
          </div>
        )}

        {phase === 'STRENGTH_COMPLETE' && (
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
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
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
            <h2 className="font-heading text-xl font-bold text-foreground-950">Cardio</h2>
            {session.cardio && <p className="mt-1 text-sm text-foreground-600">{session.cardio.type} · {session.cardio.note}</p>}
            <div className="mb-4 mt-4"><EntretenimentoTreino variante="cartao" minutosSugeridos={minutosDoTexto(session.cardio?.note)} /></div>
            <CardioEntry
              onSubmit={(atividades) => {
                setCardioFeito(atividades);
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
          // Calorias: pelos batimentos se um relógio/cinta ficou conectado; senão, estimativa por MET.
          const fcSessao = estadoFC();
          const kcalTreino = fcSessao.kcal > 1 ? Math.round(fcSessao.kcal) : kcalMusculacao(durationMin, pesoAluno);

          const melhores: Record<string, { weight: number; reps: number }> = {};
          const progressions = session.exercises.map((e) => {
            const sets = setsByEx[e.id] ?? [];
            if (sets.length === 0) return null;
            const maxWeight = Math.max(...sets.map(s => s.weight));
            const totalReps = sets.reduce((acc, s) => acc + s.reps, 0);
            const melhor = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
            melhores[e.name] = { weight: melhor.weight, reps: melhor.reps };
            const antes = historicoSeries[e.name] ?? [];
            return {
              name: e.name,
              recorde: antes.length > 0 && ehRecorde(antes, melhores[e.name]),
              detail: `${maxWeight}${e.weightUnit === 'kg/lado' ? ' kg/lado' : ' kg'} · ${totalReps} reps totais`
            };
          }).filter(Boolean);

          const seriesPorGrupo: Record<string, number> = {};
          session.exercises.forEach((e) => {
            const g = POR_ID[e.id]?.grupo;
            const n = (setsByEx[e.id] ?? []).filter((x) => x.completed).length;
            if (g && n > 0) seriesPorGrupo[g] = (seriesPorGrupo[g] ?? 0) + n;
          });

          // Séries com "até a falha" ou nota: vão no treino salvo e na conversa com o coach.
          const notasSeries = session.exercises.flatMap((e) => (setsByEx[e.id] ?? []).filter((x) => x.falha || x.nota).map((x) => ({ ex: e.name, serie: x.set, falha: !!x.falha, nota: x.nota ?? '', carga: x.porLado ? `${x.weight}/lado` : x.weight, reps: x.reps })));
          // O que foi feito no intervalo também vai para o coach.
          const notas = [...notasSeries, ...extras.map(notaDoExtra)];
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
                kcal: kcalTreino,
                fc_media: fcSessao.media || null,
                fc_maxima: fcSessao.maxima || null,
                series_por_grupo: seriesPorGrupo,
                melhores,
                cardio: cardioFeito.map((c) => ({ tipo: c.tipo, minutos: c.minutos, km: c.distanciaKm ?? null, kcal: c.kcal ?? null })),
                notas,
                extras: extras.map((x) => ({ nome: x.nome, quanto: x.quanto, depois_de: x.depoisDe })),
                esforco: esforco || null,
                comentario: comentario.trim() || null,
              };
              try {
                const key = `bc_workouts_${user.id}`;
                const list = JSON.parse(localStorage.getItem(key) || '[]');
                localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
              } catch {
                // Sem armazenamento local: fica só no Firebase.
              }
              // Sem internet, fica guardado no celular e vai sozinho quando a conexão voltar.
              const foi = await gravarOuGuardar(user.id, 'workouts', session.id, w).catch(() => true);
              const avisou = await apiOuGuardar(user.id, { acao: 'treino_feito', minutos: durationMin, kcal: kcalTreino, feitoEm: Date.now(), titulo: session.title, notas, esforco: esforco || undefined, comentario: comentario.trim() || undefined, melhores: session.exercises.filter((e) => melhores[e.name]).map((e) => ({ ex: e.name, grupo: POR_ID[e.id]?.grupo ?? '', kg: melhores[e.name].weight, reps: melhores[e.name].reps })) });
              setFicouNoCelular(!foi || !avisou);
              onSaved?.();
            }
            const rec = progressions.find((p) => p && p.recorde);
            setCartao({
              titulo: session.title,
              data: new Date(),
              itens: [
                { rotulo: 'minutos', valor: String(durationMin) },
                { rotulo: 'séries', valor: String(totalSets) },
                { rotulo: 'kg levantados', valor: totalVolume.toLocaleString('pt-BR') },
                { rotulo: fcSessao.media ? `kcal · FC média ${fcSessao.media}` : 'kcal (estimado)', valor: String(kcalTreino) },
              ],
              destaque: rec ? `Novo recorde: ${rec.name}` : undefined,
            });
            falar(fraseFim(durationMin, kcalTreino));
            void enviarStatusDupla({ exercicio: 'Treino concluído', series: totalSets, recado: 'Terminei! 💪' }, true);
            setPhase('SESSION_COMPLETE');
          };

          return (
            <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
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
                    <p className="text-xs text-foreground-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm text-foreground-800">
                <i className="ri-fire-fill text-primary-500"></i>
                <span><b>{kcalTreino} kcal</b> {fcSessao.media ? `pelos batimentos (média ${fcSessao.media}, máx. ${fcSessao.maxima} bpm)` : 'estimadas pelo tempo e seu peso'}</span>
              </p>

              {progressions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Progressões</h3>
                  {progressions.map((p) => p && (
                    <div key={p.name} className="rounded-lg bg-accent-100/60 px-4 py-2.5 text-sm text-accent-800">
                      <span className="font-semibold">{p.name}:</span> {p.detail}
                      {p.recorde && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">🏆 Recorde</span>}
                    </div>
                  ))}
                </div>
              )}

              {extras.length > 0 && (
                <div className="mt-4 space-y-2" data-testid="resumo-extras">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-400">No intervalo</h3>
                  {extras.map((x) => (
                    <div key={x.id} className="rounded-lg bg-secondary-100/70 px-4 py-2.5 text-sm text-secondary-900"><span className="font-semibold">{textoExtra(x)}</span> · depois de {x.depoisDe}</div>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-xl border border-background-200 p-3" data-testid="como-foi">
                <p className="text-sm font-semibold text-foreground-900">Como foi o treino?</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Esforço do treino">
                  {(['😌', '🙂', '💪', '😮‍💨', '🥵'] as const).map((emo, i) => (
                    <button key={i} type="button" role="radio" aria-checked={esforco === i + 1} aria-label={['Muito leve', 'Leve', 'Na medida', 'Pesado', 'No limite'][i]} onClick={() => setEsforco(esforco === i + 1 ? 0 : i + 1)} className={`rounded-lg border py-1.5 text-center ${esforco === i + 1 ? 'border-primary-400 bg-primary-100' : 'border-background-200'}`}>
                      <span className="block text-lg">{emo}</span>
                      <span className="block text-xs text-foreground-500">{['Muito leve', 'Leve', 'Na medida', 'Pesado', 'No limite'][i]}</span>
                    </button>
                  ))}
                </div>
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} rows={2} placeholder="Recado para o coach (opcional): dor, cansaço, o que mudou..." aria-label="Recado para o coach" className="mt-2 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300" />
                {notasSeries.length > 0 && <p className="mt-1 text-xs text-foreground-500"><i className="ri-sticky-note-line mr-0.5"></i>{notasSeries.length} série{notasSeries.length > 1 ? 's' : ''} com nota ou até a falha: o seu coach vê.</p>}
              </div>

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
          <div className="rounded-2xl border border-accent-200 bg-accent-100/50 p-5 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-background-50">
              <i className="ri-check-line text-2xl"></i>
            </div>
            <h2 className="mt-4 font-heading text-2xl font-bold text-foreground-950">Sessão concluída!</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-foreground-600">Excelente trabalho. Bom descanso e hidratação.</p>
            {ficouNoCelular
              ? <p className="mx-auto mt-3 max-w-md rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-900" role="status"><i className="ri-wifi-off-line mr-1"></i>Sem internet agora: o treino ficou guardado no celular e vai sozinho para o seu histórico quando a conexão voltar.</p>
              : <p className="mt-3 text-xs text-foreground-400">Tudo foi salvo no seu diário mestre.</p>}
            {cartao && (
              <button type="button" onClick={() => navigate('/ferramentas/post', { state: { titulo: cartao.titulo, numeros: cartao.itens.slice(0, 3).map((i) => ({ valor: i.valor, rotulo: i.rotulo === 'kg levantados' ? 'kg' : i.rotulo })) } })} className="mx-auto mt-5 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 py-4 text-base font-bold text-white" data-testid="criar-post-treino">
                <i className="ri-camera-line text-xl"></i>Criar post com fotos e vídeos
              </button>
            )}
            {cartao && <div className="mx-auto mt-3 max-w-xs"><CompartilharCartao dados={cartao} rotulo="Cartão com os números" /></div>}
            {cartao && <PostarNoFeed cartao={cartao} />}
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
// Foto ou vídeo curto durante o treino: fica guardado no celular para virar post no fim.
function MomentoTreino() {
  const ref = useRef<HTMLInputElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => { void listarMomentos().then((l) => setN(l.filter((m) => Date.now() - m.em < 12 * 3600000).length)); }, []);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-700" aria-label="Tirar foto ou vídeo do treino" data-testid="momento-treino">
        <i className="ri-camera-line text-base"></i>Foto{n ? ` (${n})` : ''}
      </button>
      <input ref={ref} type="file" accept="image/*,video/*" capture="environment" className="hidden" data-testid="entrada-momento"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && (await guardarMomento(f))) setN((x) => x + 1); }} />
    </>
  );
}

// Depois do treino: posta o resumo no feed da equipe com um toque (só aparece para quem tem equipe).
function PostarNoFeed({ cartao }: { cartao: { titulo: string; itens: { rotulo: string; valor: string }[]; destaque?: string } }) {
  const [estado, setEstado] = useState<'' | 'enviando' | 'ok' | 'sem'>('');
  if (estado === 'sem') return null;
  const texto = `💪 Terminei: ${cartao.titulo}\n${cartao.itens.map((i) => `${i.valor} ${i.rotulo}`).join(' · ')}${cartao.destaque ? `\n🏆 ${cartao.destaque}` : ''}`;
  return (
    <button type="button" disabled={estado !== ''} onClick={async () => {
      setEstado('enviando');
      try { const { postar } = await import('@/lib/comunidade'); await postar(texto, undefined, 'treino'); setEstado('ok'); } catch { setEstado('sem'); }
    }} className="mx-auto mt-3 block rounded-xl border border-background-200 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-800 disabled:opacity-70">
      {estado === 'ok' ? '✅ Postado no feed da equipe' : estado === 'enviando' ? 'Postando...' : <><i className="ri-group-line mr-1"></i>Postar no feed da equipe</>}
    </button>
  );
}
