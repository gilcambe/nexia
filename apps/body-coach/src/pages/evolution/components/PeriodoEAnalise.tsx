import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import type { ProgressEntry } from '@/hooks/useProgressData';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { perguntar } from '@/lib/coachAI';

type Periodo = 'diario' | 'semanal' | 'quinzenal' | 'mensal';

const PERIODOS: { id: Periodo; label: string; dias: number }[] = [
  { id: 'diario', label: 'Todo dia', dias: 1 },
  { id: 'semanal', label: 'Toda semana', dias: 7 },
  { id: 'quinzenal', label: 'A cada 15 dias', dias: 15 },
  { id: 'mensal', label: 'Todo mês', dias: 30 },
];

interface Props {
  entries: ProgressEntry[];
}

export default function PeriodoEAnalise({ entries }: Props) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('semanal');
  const [analise, setAnalise] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ evolucao_periodo?: Periodo }>(user.id, 'profile', 'main').then((p) => {
      if (p?.evolucao_periodo) setPeriodo(p.evolucao_periodo);
    });
  }, [user?.id]);

  const escolher = (p: Periodo) => {
    setPeriodo(p);
    if (user?.id) void setUserDoc(user.id, 'profile', 'main', { evolucao_periodo: p }, true);
  };

  const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? 7;
  const ultima = entries.length ? entries[entries.length - 1] : null;
  const diasDesde = ultima ? Math.floor((Date.now() - new Date(ultima.taken_at).getTime()) / 86_400_000) : null;
  const hora = diasDesde === null || diasDesde >= dias;

  const pedirAnalise = async () => {
    if (!ultima) return;
    setLoading(true);
    setErro(null);
    try {
      const perfil = user?.id ? await getUserDoc<{ onboarding?: Record<string, unknown> }>(user.id, 'profile', 'main') : null;
      const anterior = entries.length > 1 ? entries[entries.length - 2] : null;
      const foto = ultima.image_url && ultima.image_url.startsWith('data:image/') ? ultima.image_url : undefined;
      const pergunta =
        'Faça minha avaliação de evolução como uma consulta de coach de fisiculturismo. ' +
        'Diga com realismo o que melhorou, o que falta, onde focar no treino, ajustes de alimentação e se vale suplementar algo. ' +
        'Se houver foto, descreva o que vê (proporções, pontos fracos).';
      const r = await perguntar('coach', pergunta, {
        atual: { peso: ultima.weight_kg, gordura: ultima.body_fat_pct, medidas: ultima.measurements, data: ultima.taken_at },
        anterior: anterior
          ? { peso: anterior.weight_kg, gordura: anterior.body_fat_pct, medidas: anterior.measurements, data: anterior.taken_at }
          : null,
        onboarding: perfil?.onboarding ?? null,
      }, foto);
      setAnalise(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui analisar agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="p-5">
      <div className="mb-3 flex items-center gap-2">
        <i className="ri-calendar-check-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Seu ritmo de avaliação</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => escolher(p.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              periodo === p.id ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className={`mt-3 text-sm ${hora ? 'font-semibold text-primary-700' : 'text-foreground-500'}`}>
        {diasDesde === null
          ? 'Hora de registrar sua primeira foto e medidas.'
          : hora
            ? 'Está na hora de registrar sua foto e medidas.'
            : `Seu último registro foi há ${diasDesde} dia(s). Próximo em ${dias - diasDesde} dia(s).`}
      </p>
      <button
        onClick={pedirAnalise}
        disabled={!ultima || loading}
        className="mt-4 w-full rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-50"
      >
        {loading ? 'O coach está analisando...' : 'Pedir análise ao coach'}
      </button>
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      {analise && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-background-100 p-4 text-sm text-foreground-800">{analise}</p>}
    </Card>
  );
}
