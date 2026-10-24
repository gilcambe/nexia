import { useEffect, useState } from 'react';
import Card, { CardHeader } from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { faseDoCiclo, sexoDe, type Ciclo } from '@/lib/dayPlan';

const NOME_FASE = { menstrual: 'menstrual', folicular: 'folicular', ovulacao: 'ovulação', lutea: 'lútea', pre: 'pré-menstrual' } as const;

// Opcional e desligado por padrão: só a aluna decide ligar (profile/main.onboarding.ciclo).
export default function CicloCard() {
  const { user, profile, refreshProfile } = useAuth();
  const ob = (profile?.onboarding ?? {}) as Record<string, unknown>;
  const salvo = (ob.ciclo ?? {}) as Ciclo;
  const [ligado, setLigado] = useState(!!salvo.ligado);
  const [inicio, setInicio] = useState(salvo.inicio ?? '');
  const [duracao, setDuracao] = useState(String(salvo.duracao ?? 28));
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setLigado(!!salvo.ligado); setInicio(salvo.inicio ?? ''); setDuracao(String(salvo.duracao ?? 28)); }, [salvo.ligado, salvo.inicio, salvo.duracao]);

  if (sexoDe({ ...ob, gender: profile?.gender }) !== 'F') return null;

  const guardar = async (c: Ciclo) => {
    if (!user?.id) return;
    try {
      // Grava o questionário inteiro (a cópia do aparelho junta só o primeiro nível).
      await setUserDoc(user.id, 'profile', 'main', { onboarding: { ...ob, ciclo: c } }, true);
      refreshProfile();
      setMsg(c.ligado ? 'Pronto: o treino passa a considerar o seu ciclo.' : 'Desligado. O treino não usa mais o ciclo.');
    } catch { setMsg('Não consegui salvar agora. Tente de novo.'); }
  };
  const agora = faseDoCiclo({ ligado, inicio, duracao: Number(duracao) });

  return (
    <Card padding="p-5">
      <CardHeader title="Treino e ciclo menstrual" icon="ri-drop-line" />
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground-700">Ajustar o treino ao meu ciclo (opcional)</span>
        <input type="checkbox" role="switch" checked={ligado} data-testid="ciclo-ligar" className="h-6 w-6 accent-primary-500"
          onChange={(e) => { setLigado(e.target.checked); if (!e.target.checked) void guardar({ ligado: false, inicio, duracao: Number(duracao) }); }} />
      </label>
      {ligado && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm text-foreground-600">Começo da última menstruação
            <input type="date" value={inicio} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-2 py-2.5 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-foreground-600">Dias do ciclo
            <input type="number" inputMode="numeric" min={21} max={45} value={duracao} onChange={(e) => setDuracao(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-2 py-2.5 text-base" />
          </label>
          <button type="button" disabled={!inicio} onClick={() => void guardar({ ligado: true, inicio, duracao: Number(duracao) || 28 })} className="col-span-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-40">Salvar</button>
          {agora && <p className="col-span-2 text-xs text-foreground-500">Hoje: dia {agora.dia}, fase {NOME_FASE[agora.fase]}.</p>}
        </div>
      )}
      <p className="mt-2 text-xs text-foreground-400">O app só sugere: o efeito do ciclo muda de mulher para mulher, então vale o que você sentir.</p>
      {msg && <p className="mt-2 text-sm text-primary-700">{msg}</p>}
    </Card>
  );
}
