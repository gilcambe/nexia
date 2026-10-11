import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Answers } from '@/lib/trainingPlan';
import { DIVISOES, type Divisao } from '@/lib/dayPlan';
import { fichaDoPerfil, treinoDaFicha, diasPorSemana, type Ficha } from '@/lib/ficha';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import Lembretes from './components/Lembretes';
import Card from '@/components/base/Card';
import { diaDaFichaCoach, temFichaCoach, type FichaCoach } from '@/lib/coach/fichaCoach';

export default function Plan() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [onboarding, setOnboarding] = useState<Answers | null>(null);
  const [fichaSalva, setFichaSalva] = useState<Partial<Ficha> | undefined>(undefined);
  const [fichaCoach, setFichaCoach] = useState<{ ficha: FichaCoach; dia: number } | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Ficha de treino</h1>
        <p className="mt-1 text-sm text-foreground-600">
          Escolha como o seu treino é dividido. O app segue esse ciclo, um dia depois do outro, e ajusta cada treino ao seu dia.
        </p>
      </header>

      <Card padding="p-5">
        <h2 className="font-heading text-base font-semibold text-foreground-950">Divisão do treino</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(DIVISOES) as Divisao[]).map((d) => (
            <button
              key={d}
              onClick={() => escolher(d)}
              className={`rounded-xl border p-3.5 text-left transition ${ficha.divisao === d ? 'border-primary-400 bg-primary-100/60 ring-2 ring-primary-200' : 'border-background-200 bg-background-50 hover:border-background-300'}`}
            >
              <span className="block text-sm font-semibold text-foreground-950">{DIVISOES[d].nome}</span>
              <span className="block text-xs text-foreground-500">{DIVISOES[d].dias.length} {DIVISOES[d].dias.length === 1 ? 'dia' : 'dias'} por ciclo</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dias.map((d, i) => {
          const proximo = i === ficha.proximoDia;
          const lista = previa(i);
          return (
            <div key={d.titulo} className={`relative rounded-2xl border p-4 ${proximo ? 'border-primary-300 bg-primary-100/50' : 'border-background-200 bg-background-50'}`}>
              {proximo && <span className="absolute right-3 top-3 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-background-50">Próximo</span>}
              <p className="pr-16 font-heading text-base font-semibold leading-snug text-foreground-950">{d.titulo}</p>
              <ul className="mt-3 space-y-1">
                {lista.map((n) => <li key={n} className="truncate text-xs text-foreground-600"><i className="ri-checkbox-circle-line mr-1 text-accent-600"></i>{n}</li>)}
              </ul>
              {proximo && (
                <button onClick={() => navigate('/workout')} className="mt-4 w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600">Treinar agora</button>
              )}
            </div>
          );
        })}
      </div>

      <Lembretes diasPorSemana={diasPorSemana(onboarding as unknown as Record<string, unknown>)} apelido={profile?.nickname || profile?.full_name?.split(' ')[0] || null} />
    </div>
  );
}

// Ficha montada pelo coach: todos os treinos com séries, repetições, descanso, carga e observações.
function FichaDoCoach({ ficha, dia, onTreinar }: { ficha: FichaCoach; dia: number; onTreinar: () => void }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Ficha de treino</h1>
        <p className="mt-1 text-sm text-foreground-600">
          Montada pelo seu coach{ficha.coach ? ` ${ficha.coach}` : ''}: <b>{ficha.nome}</b>. Os treinos seguem em ciclo, um depois do outro. Quando o coach mudar, aparece aqui.
        </p>
        {ficha.obs && <p className="mt-2 rounded-lg bg-background-100 px-3 py-2 text-sm text-foreground-700">{ficha.obs}</p>}
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ficha.dias.map((d, i) => {
          const proximo = i === dia;
          return (
            <div key={i} className={`relative rounded-2xl border p-4 ${proximo ? 'border-primary-300 bg-primary-100/50' : 'border-background-200 bg-background-50'}`}>
              {proximo && <span className="absolute right-3 top-3 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-background-50">Próximo</span>}
              <p className="pr-16 font-heading text-base font-semibold leading-snug text-foreground-950">{d.titulo}</p>
              <ul className="mt-3 space-y-1.5">
                {d.exercicios.map((x, j) => (
                  <li key={j} className="text-xs text-foreground-700">
                    <span className="font-medium">{x.nome}</span> · {x.series} × {x.reps}{x.carga ? ` · ${x.carga}` : ''}
                    {x.obs && <span className="block text-foreground-500">{x.obs}</span>}
                  </li>
                ))}
              </ul>
              {proximo && <button onClick={onTreinar} className="mt-4 w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600">Treinar agora</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
