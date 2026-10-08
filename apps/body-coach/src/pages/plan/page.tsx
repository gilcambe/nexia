import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Answers } from '@/lib/trainingPlan';
import { DIVISOES, montarTreinoDoDia, type Divisao } from '@/lib/dayPlan';
import { fichaDoPerfil, type Ficha } from '@/lib/ficha';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import Lembretes from './components/Lembretes';
import Card from '@/components/base/Card';

export default function Plan() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [onboarding, setOnboarding] = useState<Answers | null>(null);
  const [fichaSalva, setFichaSalva] = useState<Partial<Ficha> | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ onboarding?: Answers; ficha?: Partial<Ficha>; mobility?: string[] }>(user.id, 'profile', 'main')
      .then((res) => { setOnboarding(res?.onboarding ? { ...res.onboarding, mobility: res.mobility ?? [] } as unknown as Answers : null); setFichaSalva(res?.ficha); })
      .catch(() => setOnboarding(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const ficha = fichaDoPerfil({ ficha: fichaSalva, onboarding: onboarding as unknown as Record<string, unknown> | undefined });
  const dias = DIVISOES[ficha.divisao].dias;
  const previa = (i: number): string[] => {
    try {
      const t = montarTreinoDoDia({
        respostas: onboarding as unknown as Record<string, unknown>, divisao: ficha.divisao, diaDaDivisao: i, enfase: [],
        estado: { sono: 'bom', alimentacao: 'comi_bem', energia: 4, tempoMin: 60, dores: '', indisponiveis: [] }, variacao: 0,
      });
      return t.sessao.exercises.map((e) => e.name);
    } catch { return []; }
  };
  const escolher = (d: Divisao) => {
    const nova = { divisao: d, proximoDia: 0 };
    setFichaSalva(nova);
    if (user?.id) void setUserDoc(user.id, 'profile', 'main', { ficha: nova }, true).catch(() => {});
  };

  if (loading) return <p className="text-sm text-foreground-500">Carregando...</p>;

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

      <Lembretes diasPorSemana={Number((onboarding as unknown as Record<string, unknown>).daysPerWeek ?? 4)} apelido={profile?.nickname || profile?.full_name?.split(' ')[0] || null} />
    </div>
  );
}
