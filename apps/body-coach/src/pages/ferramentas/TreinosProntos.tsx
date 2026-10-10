import { useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import CompartilharCartao from '@/components/feature/CompartilharCartao';
import MonitorCardiaco from '@/components/feature/MonitorCardiaco';
import { setUserDoc } from '@/lib/userData';
import { useWakeLock } from '@/lib/useWakeLock';
import { estadoFC, zerarSessaoFC } from '@/lib/ferramentas/frequencia';
import { CATEGORIAS_PRONTOS, PLANOS_CORRIDA, TREINOS_PRONTOS, duracaoMin, kcalTreinoPronto, type TreinoPronto } from '@/lib/ferramentas/treinosProntos';

const ICONE: Record<string, string> = {
  HIIT: 'ri-flashlight-line', Abdômen: 'ri-focus-3-line', Alongamento: 'ri-body-scan-line', Yoga: 'ri-mental-health-line',
  Mobilidade: 'ri-refresh-line', 'Em casa': 'ri-home-heart-line', Cardio: 'ri-riding-line',
};

function falar(texto: string, ligado: boolean) {
  if (!ligado || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}
let audio: AudioContext | null = null;
function bip(agudo: boolean, ligado: boolean) {
  if (!ligado) return;
  try {
    audio = audio ?? new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = agudo ? 1320 : 880;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (agudo ? 0.45 : 0.15));
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (agudo ? 0.45 : 0.15));
  } catch { /* sem áudio */ }
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Player({ treino, onSair }: { treino: TreinoPronto; onSair: () => void }) {
  const { user, profile } = useAuth();
  const peso = Number(profile?.onboarding?.weight) || 70;
  const [idx, setIdx] = useState(0);
  const [resta, setResta] = useState(treino.blocos[0].seg);
  const [rodando, setRodando] = useState(false);
  const [som, setSom] = useState(true);
  const [feito, setFeito] = useState(0);
  const [fim, setFim] = useState<null | { kcal: number; min: number }>(null);
  useWakeLock(rodando);
  const bloco = treino.blocos[idx];
  const prox = treino.blocos[idx + 1];
  const total = useMemo(() => treino.blocos.reduce((s, b) => s + b.seg, 0), [treino]);
  const ref = useRef({ idx, som });
  ref.current = { idx, som };

  const terminar = async (segFeitos: number) => {
    setRodando(false);
    const fc = estadoFC();
    const kcal = fc.kcal > 1 ? Math.round(fc.kcal) : kcalTreinoPronto(treino, peso, segFeitos);
    const min = Math.max(1, Math.round(segFeitos / 60));
    setFim({ kcal, min });
    falar('Treino concluído! Parabéns.', ref.current.som);
    if (!user) return;
    const w = {
      user_id: user.id, title: treino.nome, done_at: new Date().toISOString(), duration_min: min, exercises: new Set(treino.blocos.filter((b) => !b.descanso).map((b) => b.nome)).size,
      sets: 0, volume_kg: 0, series_por_grupo: {}, melhores: {}, kcal, origem: 'pronto', fc_media: fc.media || null, fc_maxima: fc.maxima || null,
      cardio: ['HIIT', 'Cardio'].includes(treino.categoria) ? [{ tipo: treino.nome, minutos: min, km: null, kcal }] : [],
    };
    try {
      const key = `bc_workouts_${user.id}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
    } catch { /* sem armazenamento */ }
    await setUserDoc(user.id, 'workouts', `pronto-${Date.now()}`, w).catch(() => {});
  };

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => {
      setFeito((f) => f + 1);
      setResta((r) => {
        if (r <= 4 && r > 1) bip(false, ref.current.som);
        if (r > 1) return r - 1;
        const n = ref.current.idx + 1;
        if (n >= treino.blocos.length) { void terminar(total); return 0; }
        setIdx(n);
        bip(true, ref.current.som);
        const b = treino.blocos[n];
        falar(b.descanso ? `${b.nome}. Próximo: ${treino.blocos[n + 1]?.nome ?? 'fim'}` : b.nome, ref.current.som);
        return b.seg;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, treino]);

  const pular = (d: number) => {
    const n = Math.min(treino.blocos.length - 1, Math.max(0, idx + d));
    setIdx(n);
    setResta(treino.blocos[n].seg);
    falar(treino.blocos[n].nome, som);
  };
  const iniciar = () => {
    if (idx === 0 && resta === treino.blocos[0].seg) { zerarSessaoFC(); falar(`Vamos lá! ${bloco.nome}`, som); }
    setRodando(true);
  };

  if (fim) {
    return (
      <div className="space-y-3">
        <Card className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white"><i className="ri-check-line"></i></div>
          <h2 className="mt-3 font-heading text-xl font-bold text-foreground-950">{treino.nome} concluído!</h2>
          <p className="mt-1 text-sm text-foreground-600">{fim.min} min · {fim.kcal} kcal · salvo no seu histórico</p>
          <div className="mx-auto mt-4 max-w-xs">
            <CompartilharCartao dados={{ titulo: treino.nome, data: new Date(), itens: [{ rotulo: 'minutos', valor: String(fim.min) }, { rotulo: 'kcal', valor: String(fim.kcal) }, { rotulo: 'categoria', valor: treino.categoria }, { rotulo: 'nível', valor: treino.nivel }] }} />
          </div>
        </Card>
        <button type="button" onClick={onSair} className="w-full rounded-xl border border-background-300 py-3 font-semibold text-foreground-700">Voltar aos treinos</button>
      </div>
    );
  }

  const pct = ((total - (treino.blocos.slice(idx).reduce((s, b) => s + b.seg, 0) - (bloco.seg - resta))) / total) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { setRodando(false); if (feito < 60 || window.confirm('Sair do treino?')) onSair(); }} className="text-sm font-medium text-primary-700"><i className="ri-close-line mr-1"></i>Sair</button>
        <button type="button" onClick={() => setSom((s) => !s)} aria-pressed={som} className="rounded-full border border-background-200 px-3 py-1 text-xs font-semibold text-foreground-700"><i className={som ? 'ri-volume-up-line mr-1' : 'ri-volume-mute-line mr-1'}></i>{som ? 'Voz ligada' : 'Sem som'}</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-200"><div className="h-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} /></div>
      <Card className={bloco.descanso ? 'bg-sky-50' : ''}>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-foreground-500">{bloco.descanso ? 'Descanso' : `Exercício ${treino.blocos.slice(0, idx + 1).filter((b) => !b.descanso).length} de ${treino.blocos.filter((b) => !b.descanso).length}`}</p>
        <p className="mt-1 text-center font-heading text-2xl font-bold text-foreground-950">{bloco.nome}</p>
        <p className={`mt-2 text-center font-heading text-7xl font-bold tabular-nums ${resta <= 3 ? 'text-red-500' : bloco.descanso ? 'text-sky-600' : 'text-primary-600'}`}>{mmss(resta)}</p>
        {bloco.dica && <p className="mt-2 text-center text-sm text-foreground-600">{bloco.dica}</p>}
        {prox && <p className="mt-3 text-center text-xs text-foreground-500">A seguir: <b>{prox.nome}</b></p>}
        <div className="mt-4 grid grid-cols-[auto_1fr_auto] gap-2">
          <button type="button" onClick={() => pular(-1)} className="rounded-xl border border-background-300 px-4 text-xl text-foreground-700" aria-label="Voltar exercício"><i className="ri-skip-back-fill"></i></button>
          {rodando
            ? <button type="button" onClick={() => setRodando(false)} className="rounded-xl bg-foreground-900 py-4 text-lg font-bold text-background-50"><i className="ri-pause-fill mr-1"></i>Pausar</button>
            : <button type="button" onClick={iniciar} className="rounded-xl bg-primary-500 py-4 text-lg font-bold text-background-50 dark:text-foreground-950"><i className="ri-play-fill mr-1"></i>{feito ? 'Continuar' : 'Começar'}</button>}
          <button type="button" onClick={() => pular(1)} className="rounded-xl border border-background-300 px-4 text-xl text-foreground-700" aria-label="Pular exercício"><i className="ri-skip-forward-fill"></i></button>
        </div>
        {feito > 30 && <button type="button" onClick={() => void terminar(feito)} className="mt-3 w-full py-1 text-xs font-medium text-foreground-500">Terminar agora e salvar</button>}
      </Card>
      <MonitorCardiaco compacto />
    </div>
  );
}

export default function TreinosProntos() {
  const [cat, setCat] = useState<string>('Todos');
  const [ativo, setAtivo] = useState<TreinoPronto | null>(null);
  const [plano, setPlano] = useState<string | null>(null);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [ativo, plano]);
  if (ativo) return <Player treino={ativo} onSair={() => setAtivo(null)} />;

  const pc = PLANOS_CORRIDA.find((p) => p.id === plano);
  if (pc) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setPlano(null)} className="text-sm font-medium text-primary-700"><i className="ri-arrow-left-line mr-1"></i>Treinos prontos</button>
        <h2 className="font-heading text-xl font-bold text-foreground-950">{pc.nome} · {pc.semanas.length} semanas</h2>
        <p className="text-xs text-foreground-500">3 corridas por semana. Use a Corrida com GPS para registrar e as Zonas FC das calculadoras para o ritmo.</p>
        {pc.semanas.map((s) => (
          <Card key={s.semana} padding="p-4">
            <p className="text-sm font-semibold text-foreground-950">Semana {s.semana}</p>
            <ol className="mt-1.5 space-y-1 text-sm text-foreground-700">
              {s.treinos.map((t, i) => <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">{i + 1}</span>{t}</li>)}
            </ol>
          </Card>
        ))}
      </div>
    );
  }

  const lista = TREINOS_PRONTOS.filter((t) => cat === 'Todos' || t.categoria === cat);
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {['Todos', ...CATEGORIAS_PRONTOS, 'Corrida'].map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{c}</button>
        ))}
      </div>
      {cat !== 'Corrida' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {lista.map((t) => (
            <button key={t.id} type="button" onClick={() => setAtivo(t)} className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3 text-left active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-2xl text-primary-700"><i className={ICONE[t.categoria]}></i></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground-950">{t.nome}</span>
                <span className="block text-xs text-foreground-500">{duracaoMin(t)} min · {t.nivel} · {t.categoria}</span>
                <span className="block truncate text-xs text-foreground-500">{t.desc}</span>
              </span>
              <i className="ri-play-circle-fill text-3xl text-primary-500"></i>
            </button>
          ))}
        </div>
      )}
      {(cat === 'Todos' || cat === 'Corrida') && (
        <>
          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Planos de corrida</h2>
          <div className="grid grid-cols-3 gap-2">
            {PLANOS_CORRIDA.map((p) => (
              <button key={p.id} type="button" onClick={() => setPlano(p.id)} className="rounded-2xl border border-background-200 bg-background-50 p-3 text-center">
                <i className="ri-run-line text-2xl text-primary-600"></i>
                <span className="block font-heading text-lg font-bold text-foreground-950">{p.id.toUpperCase()}</span>
                <span className="block text-[11px] text-foreground-500">{p.semanas.length} semanas</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="text-center text-[11px] text-foreground-400">O app fala o nome de cada exercício e apita nos últimos 3 segundos. Dá para assistir algo ou ouvir música junto.</p>
    </div>
  );
}
