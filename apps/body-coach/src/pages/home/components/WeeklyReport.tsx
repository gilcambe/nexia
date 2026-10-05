import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useReadiness } from '@/components/feature/ReadinessContext';
import { useProgressData } from '@/hooks/useProgressData';

const DAY = 86400000;

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function deltaLabel(delta: number, unit: string): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta > 0) return { text: `+${delta}${unit}`, tone: 'up' };
  if (delta < 0) return { text: `${delta}${unit}`, tone: 'down' };
  return { text: `estável`, tone: 'flat' };
}

export default function WeeklyReport() {
  const { user } = useAuth();
  const { entries, streak } = useReadiness();
  const { entries: progress } = useProgressData(user?.id);
  const [speaking, setSpeaking] = useState(false);

  const report = useMemo(() => {
    const now = Date.now();

    const readinessThis = entries
      .filter((e) => now - new Date(e.check_in_date).getTime() <= 7 * DAY)
      .filter((e) => e.readiness_score != null)
      .map((e) => e.readiness_score as number);
    const readinessPrev = entries
      .filter((e) => {
        const t = now - new Date(e.check_in_date).getTime();
        return t > 7 * DAY && t <= 14 * DAY;
      })
      .filter((e) => e.readiness_score != null)
      .map((e) => e.readiness_score as number);

    const checkIns = entries.filter((e) => now - new Date(e.check_in_date).getTime() <= 7 * DAY).length;

    const avgThis = avg(readinessThis);
    const avgPrev = avg(readinessPrev);
    const readinessDelta = avgThis != null && avgPrev != null ? avgThis - avgPrev : null;

    const weights = progress
      .filter((p) => p.weight_kg != null)
      .slice()
      .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());

    const weekWeights = weights.filter((p) => now - new Date(p.taken_at).getTime() <= 7 * DAY);
    const weightDelta =
      weekWeights.length >= 2
        ? Number((weekWeights[weekWeights.length - 1].weight_kg! - weekWeights[0].weight_kg!).toFixed(1))
        : weights.length >= 2
          ? Number((weights[weights.length - 1].weight_kg! - weights[weights.length - 2].weight_kg!).toFixed(1))
          : null;

    const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;

    const lines: string[] = [];
    if (checkIns === 0 && avgThis == null && latestWeight == null) {
      return { lines: [], hasData: false, avgThis, avgPrev, readinessDelta, weightDelta, latestWeight, checkIns };
    }

    lines.push(
      checkIns > 0
        ? `Você fez ${checkIns} de 7 check-ins esta semana${streak > 1 ? `, com ${streak} dias seguidos` : ''}.`
        : 'Esta semana ainda não houve check-in diário.',
    );

    if (avgThis != null) {
      if (readinessDelta != null) {
        const d = deltaLabel(readinessDelta, ' pts');
        lines.push(
          `Seu Readiness médio foi ${avgThis} (${d.tone === 'up' ? 'subiu' : d.tone === 'down' ? 'caiu' : 'ficou estável'} ${d.text.replace('+', '')} vs a semana passada).`,
        );
      } else {
        lines.push(`Seu Readiness médio foi ${avgThis}.`);
      }
    }

    if (latestWeight != null) {
      if (weightDelta != null) {
        const d = deltaLabel(weightDelta, ' kg');
        lines.push(
          `Seu peso está em ${latestWeight.toFixed(1).replace('.', ',')} kg, ${d.text} na semana.`,
        );
      } else {
        lines.push(`Seu peso mais recente é ${latestWeight.toFixed(1).replace('.', ',')} kg.`);
      }
    }

    // recomendação por regras
    let advice = 'Mantenha o ritmo: consistência vence intensidade isolada.';
    if (avgThis != null) {
      if (avgThis < 60) advice = 'Sua recuperação está baixa — priorize sono e reduza o volume na próxima semana.';
      else if (avgThis < 78) advice = 'Recuperação intermediária — ajuste o volume e evite a falha total.';
      else advice = 'Recuperação ótima — bom momento para progredir carga com técnica.';
    }
    lines.push(advice);

    return { lines, hasData: true, avgThis, avgPrev, readinessDelta, weightDelta, latestWeight, checkIns, advice };
  }, [entries, progress, streak]);

  const fullText = report.lines.join(' ');

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(fullText);
    u.lang = 'pt-BR';
    u.rate = 1.02;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-article-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Relatório semanal</h2>
        </div>
        {report.hasData && (
          <button
            onClick={speaking ? stop : speak}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              speaking
                ? 'bg-accent-500 text-background-50 hover:bg-accent-600'
                : 'bg-primary-500 text-background-50 hover:bg-primary-600'
            }`}
          >
            <i className={speaking ? 'ri-stop-circle-line' : 'ri-volume-up-line'}></i>
            {speaking ? 'Parar' : 'Ouvir relatório'}
          </button>
        )}
      </div>

      {!report.hasData ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <i className="ri-article-line text-2xl"></i>
          </div>
          <p className="max-w-sm text-sm text-foreground-600">
            Ainda não há dados desta semana. Faça seu check-in diário e registre o peso para eu montar
            o relatório automático no próximo ciclo.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Check-ins</p>
              <p className="font-heading text-lg font-bold text-foreground-950">{report.checkIns}/7</p>
            </div>
            <div className="rounded-lg bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Readiness médio</p>
              <p className="font-heading text-lg font-bold text-foreground-950">{report.avgThis ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Var. Readiness</p>
              <p className={`font-heading text-lg font-bold ${report.readinessDelta == null ? 'text-foreground-950' : report.readinessDelta >= 0 ? 'text-accent-600' : 'text-primary-600'}`}>
                {report.readinessDelta == null ? '—' : `${report.readinessDelta > 0 ? '+' : ''}${report.readinessDelta}`}
              </p>
            </div>
            <div className="rounded-lg bg-background-100/70 p-3">
              <p className="text-[11px] text-foreground-500">Var. peso</p>
              <p className={`font-heading text-lg font-bold ${report.weightDelta == null ? 'text-foreground-950' : 'text-foreground-950'}`}>
                {report.weightDelta == null ? '—' : `${report.weightDelta > 0 ? '+' : ''}${report.weightDelta} kg`}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {report.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-background-100/50 px-3 py-2 text-sm text-foreground-700">
                <i className="ri-checkbox-blank-circle-fill mt-1.5 text-[6px] text-primary-500"></i>
                <span>{l}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-foreground-400">
            Relatório gerado por regras a partir dos seus dados reais de check-in e evolução.
          </p>
        </>
      )}
    </Card>
  );
}