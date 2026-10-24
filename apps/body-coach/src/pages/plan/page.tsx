import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Answers } from '@/lib/trainingPlan';
import { DIVISOES, type Divisao } from '@/lib/dayPlan';
import { fichaDoPerfil, treinoDaFicha, diasPorSemana, type Ficha } from '@/lib/ficha';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import Lembretes from './components/Lembretes';
import Card from '@/components/base/Card';
import ExportarPlano from '@/components/feature/ExportarPlano';
import { diaDaFichaCoach, temFichaCoach, type FichaCoach } from '@/lib/coach/fichaCoach';

export default function Plan() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [onboarding, setOnboarding] = useState<Answers | null>(null);
  const [fichaSalva, setFichaSalva] = useState<Partial<Ficha> | undefined>(undefined);
  const [fichaCoach, setFichaCoach] = useState<{ ficha: FichaCoach; dia: number } | null>(null);
  const [loading, setLoading] = useState(true);
  // Fechado por padrão: só o treino de hoje aberto, o resto abre no toque (a tela cabe sem rolar).
  const [trocando, setTrocando] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [lembretes, setLembretes] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ onboarding?: Answers; ficha?: Partial<Ficha>; mobility?: string[]; ficha_coach?: unknown; ficha_coach_dia?: number }>(user.id, 'profile', 'main')
      .then((res) => { if (temFichaCoach(res?.ficha_coach)) setFichaCoach({ ficha: res.ficha_coach, dia: diaDaFichaCoach(res.ficha_coach, res.ficha_coach_dia) }); setOnboarding(res?.onboarding ? { ...res.onboarding, mobility: res.mobility ?? [] } as unknown as Answers : null); setFichaSalva(res?.ficha); })
      .catch(() => setOnboarding(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const ficha = fichaDoPerfil({ ficha: fichaSalva, onboarding: onboarding as unknown as Record<string, unknown> | undefined });
  const dias = DIVISOES[ficha.divisao].dias;
  const previa = (i: number): string[] => {
    try {
      const t = treinoDaFicha(onboarding as unknown as Record<string, unknown>, ficha.divisao, i);
      return t.sessao.exercises.map((e) => e.name);
    } catch { return []; }
  };
  const escolher = (d: Divisao) => {
    const nova = { divisao: d, proximoDia: 0 };
    setFichaSalva(nova);
    setTrocando(false); setAberto(null);
    if (user?.id) void setUserDoc(user.id, 'profile', 'main', { ficha: nova }, true).catch(() => {});
  };

  if (loading) return <p className="text-sm text-foreground-500">Carregando...</p>;

  if (fichaCoach) return <FichaDoCoach ficha={fichaCoach.ficha} dia={fichaCoach.dia} onTreinar={() => navigate('/workout')} />;

  if (!onboarding) {
    return (
      <Card padding="p-5">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Responda o questionário para montar seu plano</h1>
        <p className="mt-2 text-sm text-foreground-600">Com seus dias livres, nível e objetivo, o plano da semana é montado na hora.</p>
        <Link
          to="/onboarding"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          Responder agora <i className="ri-arrow-right-line"></i>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl font-bold text-foreground-950">Ficha de treino</h1>

      <Card padding="p-3">
        <button type="button" onClick={() => setTrocando((t) => !t)} aria-expanded={trocando} className="flex w-full items-center justify-between gap-2 text-left">
          <span className="min-w-0">
            <span className="block text-xs text-foreground-500">Divisão do treino ({dias.length} {dias.length === 1 ? 'dia' : 'dias'} em ciclo)</span>
            <span className="block truncate text-sm font-semibold text-foreground-950">{DIVISOES[ficha.divisao].nome}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary-600">{trocando ? 'Fechar' : 'Trocar'} <i className={trocando ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i></span>
        </button>
        {trocando && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-3">
            {(Object.keys(DIVISOES) as Divisao[]).map((d) => (
              <button
                key={d}
                onClick={() => escolher(d)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition ${ficha.divisao === d ? 'border-primary-400 bg-primary-100/60 ring-2 ring-primary-200' : 'border-background-200 bg-background-50 hover:border-background-300'}`}
              >
                <span className="block text-xs font-semibold leading-tight text-foreground-950">{DIVISOES[d].nome}</span>
                <span className="block text-[11px] text-foreground-500">{DIVISOES[d].dias.length} {DIVISOES[d].dias.length === 1 ? 'dia' : 'dias'}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {dias.map((d, i) => {
          const proximo = i === ficha.proximoDia;
          const lista = previa(i);
          const mostra = proximo || aberto === i;
          return (
            <div key={d.titulo} className={`rounded-2xl border px-3 py-2.5 ${proximo ? 'border-primary-300 bg-primary-100/50' : 'border-background-200 bg-background-50'}`}>
              <button type="button" onClick={() => !proximo && setAberto(aberto === i ? null : i)} aria-expanded={mostra} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="min-w-0">
                  <span className="block truncate font-heading text-sm font-semibold text-foreground-950">{d.titulo}</span>
                  {!mostra && <span className="block truncate text-xs text-foreground-500">{lista.length} exercícios: {lista.join(', ')}</span>}
                </span>
                {proximo ? <span className="shrink-0 rounded-full bg-primary-500 px-2 py-0.5 text-xs font-semibold text-background-50">Próximo</span> : <i className={`shrink-0 text-foreground-400 ${mostra ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>}
              </button>
              {mostra && (
                <ul className="mt-1.5 grid grid-cols-1 gap-0.5">
                  {lista.map((n) => <li key={n} className="truncate text-xs text-foreground-600"><i className="ri-checkbox-circle-line mr-1 text-accent-600"></i>{n}</li>)}
                </ul>
              )}
              {proximo && (
                <button onClick={() => navigate('/workout')} className="mt-2 w-full rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600">Treinar agora</button>
              )}
            </div>
          );
        })}
      </div>

      {lembretes
        ? <Lembretes diasPorSemana={diasPorSemana(onboarding as unknown as Record<string, unknown>)} apelido={profile?.nickname || profile?.full_name?.split(' ')[0] || null} />
        : <button type="button" onClick={() => setLembretes(true)} className="w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-left text-sm font-semibold text-foreground-800"><i className="ri-alarm-line mr-1 text-primary-500"></i>Lembretes de treino no celular <i className="ri-arrow-down-s-line float-right text-foreground-400"></i></button>}
    </div>
  );
}

// Ficha montada pelo coach: todos os treinos com séries, repetições, descanso, carga e observações.
function FichaDoCoach({ ficha, dia, onTreinar }: { ficha: FichaCoach; dia: number; onTreinar: () => void }) {
  return (
    <div className="space-y-3">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground-950">Ficha de treino</h1>
        <p className="text-sm text-foreground-600">
          <b>{ficha.nome}</b>, do seu coach{ficha.coach ? ` ${ficha.coach}` : ''}. Os treinos seguem em ciclo.
        </p>
        {ficha.obs && <p className="mt-2 rounded-lg bg-background-100 px-3 py-2 text-sm text-foreground-700">{ficha.obs}</p>}
      </header>
      <ExportarPlano ficha={ficha} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {ficha.dias.map((d, i) => {
          const proximo = i === dia;
          return (
            <div key={i} className={`relative rounded-2xl border px-3 py-2.5 ${proximo ? 'border-primary-300 bg-primary-100/50' : 'border-background-200 bg-background-50'}`}>
              {proximo && <span className="absolute right-3 top-3 rounded-full bg-primary-500 px-2 py-0.5 text-xs font-semibold text-background-50">Próximo</span>}
              <p className="pr-16 font-heading text-base font-semibold leading-snug text-foreground-950">{d.titulo}</p>
              <ul className="mt-1.5 space-y-1">
                {d.exercicios.map((x, j) => (
                  <li key={j} className="text-xs text-foreground-700">
                    <span className="font-medium">{x.nome}</span> · {x.series} × {x.reps}{x.carga ? ` · ${x.carga}` : ''}
                    {x.obs && <span className="block text-foreground-500">{x.obs}</span>}
                  </li>
                ))}
              </ul>
              {proximo && <button onClick={onTreinar} className="mt-2 w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600">Treinar agora</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
