import { useState } from 'react';
import { useReadiness } from '@/components/feature/ReadinessContext';
import { statusMeta } from '@/lib/readinessEngine';
import ReadinessRing from '@/components/feature/ReadinessRing';
import Card from '@/components/base/Card';

export default function ReadinessCard() {
  const { result, streak, loading } = useReadiness();
  const [showWhy, setShowWhy] = useState(false);

  if (loading) {
    return (
      <Card padding="p-5">
        <div className="flex h-40 items-center justify-center text-sm text-foreground-400">
          Carregando prontidão...
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card padding="p-5">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-heart-pulse-line text-lg text-accent-600"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Prontidão para treinar</h2>
        </div>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-heart-pulse-line text-2xl"></i>
          </div>
          <p className="text-sm text-foreground-600">
            Faça seu primeiro check-in diário acima para calcular sua Prontidão (nota de 0 a 100 de quão pronto seu corpo está para treinar hoje).
          </p>
        </div>
      </Card>
    );
  }

  const meta = statusMeta[result.status];

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-heart-pulse-line text-lg text-accent-600"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Prontidão para treinar</h2>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700">
              <i className="ri-fire-line"></i>
              {streak} dias
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-background-100 px-3 py-1 text-xs font-semibold ${meta.text}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }}></span>
            {meta.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 justify-center">
          <ReadinessRing score={result.score} size={120} stroke={9} label="prontidão" statusColor={meta.color} />
        </div>
        <div className="flex-1 space-y-2">
          {result.metrics.slice(0, 4).map((m) => (
            <div key={m.key} className="flex items-center justify-between text-sm">
              <span className="text-foreground-600">{m.label}</span>
              <span className="font-medium text-foreground-900">{m.raw}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground-700">{result.summary}</p>

      <div className="mt-4 rounded-xl bg-primary-100/70 p-4">
        <div className="flex items-start gap-2">
          <i className="ri-robot-2-line mt-0.5 text-primary-600"></i>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Decisão do Coach</p>
            <p className="mt-1 text-sm text-foreground-800">{result.decision}</p>
            <button
              onClick={() => setShowWhy((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800"
            >
              <i className="ri-question-line"></i>
              Por quê?
              <i className={`ri-arrow-down-s-line transition ${showWhy ? 'rotate-180' : ''}`}></i>
            </button>
          </div>
        </div>
        {showWhy && (
          <div className="mt-3 rounded-lg bg-background-50/60 p-3 text-sm leading-relaxed text-foreground-700">
            {result.why}
          </div>
        )}
      </div>
    </Card>
  );
}