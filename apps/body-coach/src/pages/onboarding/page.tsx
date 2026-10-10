import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { calcularMetas } from '@/lib/metas';
import { montarCardapio } from '@/lib/dietPlan';
import { DIVISOES } from '@/lib/dayPlan';
import { fichaDoPerfil, treinoDaFicha, type Ficha } from '@/lib/ficha';

// Primeiro acesso guiado (~1 minuto): 4 telas curtas e o aluno sai com treino e dieta prontos.
// Grava as mesmas respostas de antes (profile/main.onboarding), que a ficha, o treino e a dieta já usam.
const steps = [
  { key: 'voce', title: 'Sobre você', icon: 'ri-user-3-line' },
  { key: 'objetivo', title: 'Qual é o seu objetivo?', icon: 'ri-trophy-line' },
  { key: 'treino', title: 'Como você treina?', icon: 'ri-run-line' },
  { key: 'comida', title: 'Comida e saúde', icon: 'ri-restaurant-line' },
];

const goals = [
  { v: 'Perda de gordura', icon: 'ri-fire-line' },
  { v: 'Hipertrofia', icon: 'ri-boxing-line' },
  { v: 'Recomposição', icon: 'ri-scales-3-line' },
  { v: 'Condicionamento', icon: 'ri-heart-pulse-line' },
  { v: 'Saúde', icon: 'ri-leaf-line' },
  { v: 'Força', icon: 'ri-weight-line' },
  { v: 'Estética', icon: 'ri-star-smile-line' },
  { v: 'Performance', icon: 'ri-speed-up-line' },
];
const modalities = ['Musculação', 'Corrida', 'Ciclismo', 'Natação', 'Cross Training', 'Lutas', 'Futebol', 'Powerlifting'];
const levels = ['Iniciante', 'Intermediário', 'Avançado'];
const days = ['2', '3', '4', '5', '6'];
const minutes = ['30', '45', '60', '75', '90'];
const meals = ['3', '4', '5', '6'];
const restricoesOpcoes = ['Sem lactose', 'Sem glúten', 'Vegetariano', 'Vegano', 'Sem ovo', 'Sem amendoim', 'Sem peixe'];

type Form = Record<string, string | string[]>;

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${
        ativo ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
      }`}
    >
      {children}
    </button>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground-600">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ modality: ['Musculação'], level: 'Iniciante', days: '3', minutes: '60', meals: '4' });
  const [preenchido, setPreenchido] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Refazendo o questionário: começa com as respostas que já existem.
  useEffect(() => {
    if (preenchido || !profile) return;
    setPreenchido(true);
    const ob = (profile.onboarding ?? {}) as Form;
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(Object.entries(ob).filter(([, v]) => v !== undefined && v !== '')),
      ...(!ob.name && profile.full_name ? { name: profile.full_name } : {}),
    }));
  }, [profile, preenchido]);

  const setVal = (key: string, v: string | string[]) => setForm((f) => ({ ...f, [key]: v }));
  const lista = (key: string) => (Array.isArray(form[key]) ? (form[key] as string[]) : form[key] ? [String(form[key])] : []);
  const toggleMulti = (key: string, v: string) => {
    const cur = lista(key);
    setVal(key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  const peso = Number(form.weight);
  const podeAvancar = [
    String(form.name ?? '').trim().length > 0 && peso > 25 && peso < 350,
    !!form.goal,
    !!form.level && !!form.days && lista('modality').length > 0,
    true,
  ][step];

  const finish = async () => {
    setSaving(true);
    if (user) {
      const name = String(form.name ?? '').trim();
      const height = Number(form.height);
      try {
        await setUserDoc(user.id, 'profile', 'main', {
          ...(name ? { full_name: name } : {}),
          ...(height > 0 ? { height_cm: height } : {}),
          onboarding: form,
          onboarding_done: true,
        }, true);
        refreshProfile();
      } catch {
        // Sem conexão ou sem permissão: o aluno segue e pode completar o perfil depois.
      }
    }
    setSaving(false);
    setPronto(true);
  };

  // Resumo do que ficou pronto: o mesmo treino e a mesma dieta que as telas do app vão mostrar.
  const resumo = useMemo(() => {
    if (!pronto) return null;
    const respostas = form as Record<string, unknown>;
    let treino: { titulo: string; min: number; n: number; nomes: string[] } | null = null;
    try {
      const ficha = fichaDoPerfil({ onboarding: respostas, ficha: (profile as { ficha?: Partial<Ficha> } | null)?.ficha });
      const t = treinoDaFicha({ ...respostas, mobility: profile?.mobility ?? [] }, ficha.divisao, ficha.proximoDia);
      treino = {
        titulo: DIVISOES[ficha.divisao].dias[ficha.proximoDia].titulo,
        min: t.sessao.estimatedMinutes,
        n: t.sessao.exercises.length,
        nomes: t.sessao.exercises.slice(0, 3).map((e) => e.name),
      };
    } catch { treino = null; }
    const m = peso > 0 ? calcularMetas(peso, String(form.goal ?? '')) : null;
    let refeicao: { nome: string; itens: string } | null = null;
    if (m) {
      try {
        const c = montarCardapio(respostas, { kcal: m.calories, proteina: m.protein, carbo: m.carbs, gordura: m.fat });
        if (c[0]) refeicao = { nome: c[0].nome, itens: c[0].itens.map((i) => i.nome).join(', ') };
      } catch { refeicao = null; }
    }
    return { treino, metas: m, agua: peso > 0 ? Math.round(peso * 0.035 * 10) / 10 : null, refeicao };
  }, [pronto, form, peso, profile]);

  if (pronto && resumo) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-background-50">
          <i className="ri-check-line text-3xl"></i>
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold text-foreground-950">Seu plano está pronto!</h1>
        <p className="mt-1 text-sm text-foreground-600">Treino e dieta montados para o seu objetivo. Você pode ajustar tudo depois.</p>

        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-background-200 bg-background-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600"><i className="ri-play-circle-line"></i> Seu primeiro treino</p>
            {resumo.treino ? (
              <>
                <p className="mt-1 font-heading text-lg font-bold text-foreground-950">{resumo.treino.titulo}</p>
                <p className="text-sm text-foreground-600">{resumo.treino.n} exercícios · cerca de {resumo.treino.min} min</p>
                {resumo.treino.nomes.length > 0 && <p className="mt-1 text-xs text-foreground-500">{resumo.treino.nomes.join(' · ')}…</p>}
              </>
            ) : (
              <p className="mt-1 text-sm text-foreground-600">Pronto na tela Treino.</p>
            )}
          </div>

          <div className="rounded-2xl border border-background-200 bg-background-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-600"><i className="ri-restaurant-line"></i> Sua dieta do dia</p>
            {resumo.metas ? (
              <>
                <p className="mt-1 font-heading text-lg font-bold text-foreground-950">{resumo.metas.calories.toLocaleString('pt-BR')} kcal</p>
                <p className="text-sm text-foreground-600">
                  Proteína {resumo.metas.protein} g · Carbo {resumo.metas.carbs} g · Gordura {resumo.metas.fat} g
                </p>
                {resumo.refeicao && <p className="mt-1 text-xs text-foreground-500">{resumo.refeicao.nome}: {resumo.refeicao.itens}</p>}
              </>
            ) : (
              <p className="mt-1 text-sm text-foreground-600">Pronta na tela Nutrição.</p>
            )}
          </div>

          {resumo.agua && (
            <div className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-4">
              <i className="ri-drop-line text-2xl text-accent-600"></i>
              <p className="text-sm text-foreground-700">Meta de água: <strong className="text-foreground-950">{resumo.agua.toLocaleString('pt-BR')} L</strong> por dia</p>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-8">
          <button onClick={() => navigate('/workout', { replace: true })} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600">
            <i className="ri-play-fill text-lg"></i>Começar o primeiro treino
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/nutrition', { replace: true })} className="rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-medium text-foreground-700">Ver dieta</button>
            <button onClick={() => navigate('/', { replace: true })} className="rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-medium text-foreground-700">Ir para Hoje</button>
          </div>
        </div>
      </div>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4">
      <div className="flex items-center gap-2 py-6">
        {steps.map((s, i) => (
          <div key={s.key} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-background-200'}`} />
        ))}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
            <i className={`${current.icon} text-2xl`}></i>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Passo {step + 1} de {steps.length} · leva 1 minuto</p>
            <h1 className="font-heading text-2xl font-bold text-foreground-950">{current.title}</h1>
          </div>
        </div>

        <div className="mt-6 flex-1 space-y-5">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'name', label: 'Nome', type: 'text', ph: 'Seu nome', full: true, mode: 'text' },
                { k: 'weight', label: 'Peso (kg)', type: 'number', ph: '75', mode: 'decimal' },
                { k: 'height', label: 'Altura (cm)', type: 'number', ph: '170', mode: 'numeric' },
                { k: 'age', label: 'Idade', type: 'number', ph: '30', mode: 'numeric' },
              ].map((f) => (
                <label key={f.k} className={`flex flex-col gap-1 ${f.full ? 'col-span-2' : ''}`}>
                  <span className="text-sm font-medium text-foreground-600">{f.label}</span>
                  <input
                    type={f.type}
                    inputMode={f.mode as 'text' | 'decimal' | 'numeric'}
                    placeholder={f.ph}
                    value={(form[f.k] as string) ?? ''}
                    onChange={(e) => setVal(f.k, e.target.value)}
                    className="rounded-lg border border-background-200 bg-background-50 px-3 py-3 text-base outline-none focus:border-primary-300"
                  />
                </label>
              ))}
              <p className="col-span-2 text-xs text-foreground-400">O peso define as calorias e a água do dia.</p>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {goals.map((g) => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setVal('goal', g.v)}
                  aria-pressed={form.goal === g.v}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3.5 text-left text-sm font-medium transition active:scale-95 ${
                    form.goal === g.v ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
                  }`}
                >
                  <i className={`${g.icon} text-lg`}></i>{g.v}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <Grupo titulo="Seu nível">
                {levels.map((l) => <Chip key={l} ativo={form.level === l} onClick={() => setVal('level', l)}>{l}</Chip>)}
              </Grupo>
              <Grupo titulo="Dias por semana">
                {days.map((d) => <Chip key={d} ativo={form.days === d} onClick={() => setVal('days', d)}>{d} dias</Chip>)}
              </Grupo>
              <Grupo titulo="Tempo por treino">
                {minutes.map((m) => <Chip key={m} ativo={form.minutes === m} onClick={() => setVal('minutes', m)}>{m} min</Chip>)}
              </Grupo>
              <Grupo titulo="O que você pratica (pode marcar vários)">
                {modalities.map((m) => <Chip key={m} ativo={lista('modality').includes(m)} onClick={() => toggleMulti('modality', m)}>{m}</Chip>)}
              </Grupo>
            </>
          )}

          {step === 3 && (
            <>
              <Grupo titulo="Refeições por dia">
                {meals.map((m) => <Chip key={m} ativo={form.meals === m} onClick={() => setVal('meals', m)}>{m}</Chip>)}
              </Grupo>
              <Grupo titulo="Restrições na comida (se tiver)">
                {restricoesOpcoes.map((r) => <Chip key={r} ativo={lista('restrictions').includes(r)} onClick={() => toggleMulti('restrictions', r)}>{r}</Chip>)}
              </Grupo>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground-600">Alguma lesão ou dor? (opcional)</span>
                <input
                  type="text"
                  placeholder="Ex.: dor no joelho direito"
                  value={(form.injuries as string) ?? ''}
                  onChange={(e) => setVal('injuries', e.target.value)}
                  className="rounded-lg border border-background-200 bg-background-50 px-3 py-3 text-base outline-none focus:border-primary-300"
                />
              </label>
              <p className="text-xs text-foreground-400">Isso não é diagnóstico. O treino evita o que pode piorar a dor.</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 py-6">
          <button
            type="button"
            onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
            className="rounded-xl border border-background-200 bg-background-50 px-5 py-3 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
          >
            {step === 0 ? 'Agora não' : 'Voltar'}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? void finish() : setStep((s) => s + 1))}
            disabled={saving || !podeAvancar}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-50"
          >
            {isLast ? (saving ? 'Montando…' : 'Montar meu plano') : 'Continuar'}
            {!isLast && <i className="ri-arrow-right-line"></i>}
          </button>
        </div>
      </div>
    </div>
  );
}
