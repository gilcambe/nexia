import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import { setUserDoc } from '@/lib/userData';
import { sugerirAjuste } from '@/lib/metas';

// Dieta adaptativa: a balança da semana decide se as calorias sobem, descem ou ficam.
export default function AjusteSemanal() {
  const { user, profile, refreshProfile } = useAuth();
  const { entries } = useProgressData();
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState('');
  const goal = (profile as unknown as { onboarding?: { goal?: string } } | null)?.onboarding?.goal;
  const atual = Number(profile?.ajuste_kcal) || 0;
  const recente = Date.now() - new Date((profile as unknown as { ajuste_em?: string } | null)?.ajuste_em ?? 0).getTime() < 7 * 86_400_000;
  const s = useMemo(() => sugerirAjuste(entries.filter((e) => e.weight_kg != null).map((e) => ({ data: e.taken_at, kg: e.weight_kg as number })), goal), [entries, goal]);
  if (!s) {
    return (
      <Card padding="p-5">
        <div className="flex items-center gap-2"><i className="ri-scales-3-line text-lg text-primary-500"></i><h2 className="font-heading text-base font-semibold text-foreground-950">Ajuste semanal da dieta</h2></div>
        <p className="mt-2 text-sm text-foreground-600">Registre o seu peso pelo menos uma vez nesta semana e uma vez na semana passada (aba Evolução). Aí eu ajusto as suas calorias pelo resultado da balança.</p>
      </Card>
    );
  }
  const aplicar = async () => {
    if (!user || salvando) return;
    setSalvando(true);
    try {
      await setUserDoc(user.id, 'profile', 'main', { ajuste_kcal: atual + s.deltaKcal, ajuste_em: new Date().toISOString() }, true);
      refreshProfile();
      setFeito('Pronto! As suas metas já mudaram.');
    } catch { setFeito('Não consegui salvar agora. Tente de novo.'); }
    finally { setSalvando(false); }
  };
  return (
    <Card padding="p-5">
      <div className="flex items-center gap-2"><i className="ri-scales-3-line text-lg text-primary-500"></i><h2 className="font-heading text-base font-semibold text-foreground-950">Ajuste semanal da dieta</h2></div>
      <p className="mt-2 text-sm text-foreground-700">{s.texto}</p>
      {s.deltaKcal !== 0 && !feito && recente && <p className="mt-2 text-xs text-foreground-500">Você já ajustou as calorias nesta semana. Reavalio na próxima.</p>}
      {s.deltaKcal !== 0 && !feito && !recente && (
        <button onClick={() => void aplicar()} disabled={salvando} className="mt-3 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 disabled:opacity-60">{salvando ? 'Salvando…' : `Aplicar ${s.deltaKcal > 0 ? '+' : ''}${s.deltaKcal} kcal por dia`}</button>
      )}
      {feito && <p role="status" className="mt-2 text-sm font-medium text-primary-700">{feito}</p>}
    </Card>
  );
}
