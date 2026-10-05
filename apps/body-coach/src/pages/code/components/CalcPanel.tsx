import Card from '@/components/base/Card';
import { calculations } from './specData';

export default function CalcPanel() {
  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <div className="flex items-start gap-3">
          <i className="ri-calculator-line mt-0.5 text-lg text-accent-600"></i>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground-950">
              Como os cálculos funcionam (auditoria)
            </h3>
            <p className="mt-1 text-sm text-foreground-600">
              Cada fórmula abaixo é a que roda no app em tempo real. O código-fonte exato de cada
              motor está indicado em <span className="font-mono text-xs">source</span> e pode ser lido
              por completo na aba “Arquivos”.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {calculations.map((c) => (
          <Card key={c.title} padding="p-5">
            <div className="flex items-center gap-2">
              <i className="ri-function-line text-lg text-primary-500"></i>
              <h4 className="font-heading text-sm font-semibold text-foreground-950">{c.title}</h4>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-background-200 bg-background-100/50 p-3">
              <code className="whitespace-pre font-mono text-[12px] text-primary-700">{c.formula}</code>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground-700">{c.description}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground-400">
              <i className="ri-file-code-line"></i>
              <span className="font-mono">{c.source}</span>
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}