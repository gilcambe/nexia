import { useState, type FormEvent } from 'react';
import Card from '@/components/base/Card';
import {
  checkSubstance,
  sampleSupplements,
  wadaCategories,
  type CheckResult,
  type Verdict,
} from './components/wadaData';

const verdictMeta: Record<Verdict, { label: string; icon: string; box: string; badge: string }> = {
  proibido: { label: 'PROIBIDO', icon: 'ri-close-circle-line', box: 'bg-primary-100/70 border-primary-200', badge: 'bg-primary-500 text-background-50' },
  cuidado: { label: 'CUIDADO', icon: 'ri-alert-line', box: 'bg-secondary-100/70 border-secondary-200', badge: 'bg-secondary-500 text-background-50' },
  permitido: { label: 'PERMITIDO', icon: 'ri-checkbox-circle-line', box: 'bg-accent-100/70 border-accent-200', badge: 'bg-accent-500 text-background-50' },
  desconhecido: { label: 'VERIFICAR', icon: 'ri-question-line', box: 'bg-background-100 border-background-200', badge: 'bg-foreground-600 text-background-50' },
};

export default function AntiDoping() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);

  const run = (value: string) => {
    setInput(value);
    setResult(checkSubstance(value));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-600">
          <i className="ri-shield-check-line"></i>
          Conformidade esportiva
        </div>
        <h1 className="mt-2 font-heading text-2xl font-bold text-foreground-950">Anti-Doping (lista WADA)</h1>
        <p className="mt-1 max-w-3xl text-sm text-foreground-600">
          Digite um suplemento, produto ou os ingredientes da rotulagem. O app cruza por regras com as
          categorias proibidas da WADA e diz se é <strong>proibido</strong>, <strong>cuidado</strong> ou{' '}
          <strong>permitido</strong> — com o motivo e a categoria.
        </p>
      </header>

      <Card padding="p-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2.5 focus-within:border-primary-300">
            <i className="ri-search-line text-foreground-400"></i>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: pré-treino, anastrozol, creatina, whey..."
              className="w-full bg-transparent text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-6 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
          >
            <i className="ri-shield-check-line"></i>
            Verificar
          </button>
        </form>

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Testar exemplos rápidos</p>
          <div className="flex flex-wrap gap-2">
            {sampleSupplements.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                className="whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs text-foreground-600 transition hover:bg-background-100"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {result && (
        <div className={`rounded-lg border p-5 ${verdictMeta[result.status].box}`}>
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${verdictMeta[result.status].badge}`}>
              <i className={`${verdictMeta[result.status].icon} text-xl`}></i>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${verdictMeta[result.status].badge}`}>
                  {verdictMeta[result.status].label}
                </span>
                {result.category && (
                  <span className="rounded-full bg-background-50/70 px-2.5 py-0.5 text-xs font-medium text-foreground-600">
                    {result.category}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground-800">{result.advice}</p>
              {result.matched.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.matched.map((m) => (
                    <span key={m} className="rounded-full bg-background-50/70 px-2 py-0.5 text-[11px] text-foreground-600">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Card padding="p-5">
        <div className="mb-3 flex items-center gap-2">
          <i className="ri-book-2-line text-lg text-secondary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Referência — classes WADA</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {wadaCategories.map((c) => (
            <div key={c.code} className="rounded-lg border border-background-200 bg-background-50 p-3">
              <p className="text-sm font-semibold text-foreground-900">
                <span className="font-mono text-primary-700">{c.code}</span> · {c.name}
              </p>
              <p className="mt-1 text-[11px] text-foreground-500">{c.examples.join(' · ')}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="rounded-lg bg-accent-100/50 p-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-information-line mr-1 text-accent-700"></i>
        Esta é uma triagem por palavras-chave para <strong>orientação de performance</strong>. Não substitui a
        verificação oficial (WADA / Global DRO) nem a avaliação do médico do esporte e do farmacêutico anti-doping.
      </p>
    </div>
  );
}