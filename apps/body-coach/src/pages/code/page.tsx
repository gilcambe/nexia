import { useState } from 'react';
import CodeBrowser from './components/CodeBrowser';
import SpecPanel from './components/SpecPanel';
import CalcPanel from './components/CalcPanel';
import { sourceFiles, totalLines, GROUP_ORDER, type SourceFile } from './components/sourceFiles';

type Tab = 'files' | 'specs' | 'calc';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'files', label: 'Arquivos', icon: 'ri-code-s-slash-line' },
  { key: 'specs', label: 'Especificações', icon: 'ri-palette-line' },
  { key: 'calc', label: 'Cálculos', icon: 'ri-calculator-line' },
];

export default function CodePage() {
  const [tab, setTab] = useState<Tab>('files');

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-600">
          <i className="ri-code-s-slash-line"></i>
          Auditoria do projeto
        </div>
        <h1 className="mt-2 font-heading text-2xl font-bold text-foreground-950">Código & Especificações</h1>
        <p className="mt-1 max-w-3xl text-sm text-foreground-600">
          Aqui está a cópia fiel de todo o código-fonte e dos arquivos de configuração do projeto:
          cores, layout, tipografia, stack, parâmetros e as fórmulas dos cálculos usados no app —
          para você validar que tudo foi feito corretamente.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Arquivos mapeados', value: sourceFiles.length, icon: 'ri-folder-3-line' },
          { label: 'Linhas de código', value: totalLines.toLocaleString('pt-BR'), icon: 'ri-code-line' },
          { label: 'Grupos', value: GROUP_ORDER.length, icon: 'ri-node-tree' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
              <i className={`${s.icon} text-xl`}></i>
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-foreground-950">{s.value}</p>
              <p className="text-[11px] text-foreground-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* segmented control */}
      <div className="inline-flex rounded-full border border-background-200 bg-background-100/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-primary-500 text-background-50'
                : 'text-foreground-600 hover:text-foreground-900'
            }`}
          >
            <i className={`${t.icon} text-base`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'files' && <CodeBrowser files={sourceFiles as SourceFile[]} groupOrder={GROUP_ORDER} />}
      {tab === 'specs' && <SpecPanel />}
      {tab === 'calc' && <CalcPanel />}
    </div>
  );
}