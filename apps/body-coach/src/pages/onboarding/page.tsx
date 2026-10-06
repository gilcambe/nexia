import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';

const steps = [
  { key: 'identity', title: 'Quem é você?', icon: 'ri-user-3-line' },
  { key: 'goal', title: 'Qual é o objetivo?', icon: 'ri-trophy-line' },
  { key: 'modality', title: 'Modalidades', icon: 'ri-fire-line' },
  { key: 'experience', title: 'Experiência', icon: 'ri-briefcase-line' },
  { key: 'availability', title: 'Disponibilidade', icon: 'ri-calendar-line' },
  { key: 'context', title: 'Contexto', icon: 'ri-focus-3-line' },
  { key: 'health', title: 'Saúde & segurança', icon: 'ri-heart-pulse-line' },
];

const goals = ['Saúde', 'Condicionamento', 'Estética', 'Hipertrofia', 'Força', 'Perda de gordura', 'Recomposição', 'Performance', 'Competição', 'Recuperação'];
const modalities = ['Musculação', 'Hipertrofia', 'Powerlifting', 'Lifting Olímpico', 'Corrida', 'Ciclismo', 'Natação', 'Triathlon', 'Futebol', 'Lutas', 'Cross Training', 'Basquete'];
const levels = ['Iniciante', 'Intermediário', 'Avançado', 'Alto desempenho'];
const days = [3, 4, 5, 6];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const setVal = (key: string, v: string | string[]) => setForm((f) => ({ ...f, [key]: v }));

  const toggleMulti = (key: string, v: string) => {
    const cur = (form[key] as string[]) ?? [];
    setVal(key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

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
      } catch {
        // Sem conexão ou sem permissão: o aluno segue e pode completar o perfil depois.
      }
    }
    setSaving(false);
    navigate('/');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      {/* progress */}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Etapa {step + 1} de {steps.length}</p>
            <h1 className="font-heading text-2xl font-bold text-foreground-950">{current.title}</h1>
          </div>
        </div>

        <div className="mt-6 flex-1">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { k: 'name', label: 'Nome', type: 'text', ph: 'Rafael' },
                { k: 'age', label: 'Idade', type: 'number', ph: '29' },
                { k: 'height', label: 'Altura (cm)', type: 'number', ph: '178' },
                { k: 'weight', label: 'Peso (kg)', type: 'number', ph: '82' },
              ].map((f) => (
                <label key={f.k} className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground-600">{f.label}</span>
                  <input
                    type={f.type}
                    placeholder={f.ph}
                    value={(form[f.k] as string) ?? ''}
                    onChange={(e) => setVal(f.k, e.target.value)}
                    className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300"
                  />
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <button
                  key={g}
                  onClick={() => setVal('goal', g)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    form.goal === g ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-wrap gap-2">
              {modalities.map((m) => {
                const sel = ((form.modality as string[]) ?? []).includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMulti('modality', m)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      sel ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
              <p className="w-full text-xs text-foreground-400">Escolha uma ou mais modalidades.</p>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {levels.map((l) => (
                <button
                  key={l}
                  onClick={() => setVal('level', l)}
                  className={`rounded-xl border px-3 py-4 text-sm font-medium transition ${
                    form.level === l ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground-600">Dias por semana</p>
                <div className="flex gap-2">
                  {days.map((d) => (
                    <button
                      key={d}
                      onClick={() => setVal('days', String(d))}
                      className={`h-11 w-11 rounded-xl border text-sm font-semibold transition ${
                        form.days === String(d) ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground-600">Duração por sessão (min)</span>
                <input type="number" placeholder="75" value={(form.minutes as string) ?? ''} onChange={(e) => setVal('minutes', e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              {[
                { k: 'schedule', label: 'Rotina de trabalho', ph: 'Ex.: 9h–18h, home office' },
                { k: 'sleep', label: 'Horário de sono', ph: 'Ex.: 23h–7h (ou trabalha por turnos?)' },
                { k: 'travel', label: 'Viagens frequentes', ph: 'Ex.: 1x por mês' },
              ].map((f) => (
                <label key={f.k} className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground-600">{f.label}</span>
                  <input type="text" placeholder={f.ph} value={(form[f.k] as string) ?? ''} onChange={(e) => setVal(f.k, e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />
                </label>
              ))}
              <p className="text-xs text-foreground-400">Entendemos que seu "dia" biológico pode não coincidir com o calendário.</p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-background-200 bg-background-100/60 p-4">
                <p className="text-sm font-semibold text-foreground-800">Histórico ≠ sintoma atual.</p>
                <p className="mt-1 text-sm text-foreground-600">"Bursite antiga" é diferente de "dor atual". Guardamos ambos com status e data.</p>
              </div>
              {[
                { k: 'history', label: 'Histórico médico / condições' },
                { k: 'injuries', label: 'Lesões anteriores' },
                { k: 'symptoms', label: 'Sintomas atuais' },
              ].map((f) => (
                <label key={f.k} className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground-600">{f.label}</span>
                  <input type="text" placeholder="Ex.: bursite (estável, 2023)" value={(form[f.k] as string) ?? ''} onChange={(e) => setVal(f.k, e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />
                </label>
              ))}
              <p className="text-xs text-foreground-400">Isso não é diagnóstico. Você pode completar depois.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 py-6">
          <button
            onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
            className="rounded-xl border border-background-200 bg-background-50 px-5 py-2.5 text-sm font-medium text-foreground-700 transition hover:bg-background-100"
          >
            Voltar
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
          >
            {isLast ? (saving ? 'Salvando...' : 'Começar') : 'Continuar'}
            {!isLast && <i className="ri-arrow-right-line"></i>}
          </button>
        </div>
      </div>
    </div>
  );
}