import type { ReactNode } from 'react';
import Card from '@/components/base/Card';
import {
  paletteRoles,
  typography,
  layoutScale,
  stack,
  dataModel,
} from './specData';

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center gap-2">
        <i className={`${icon} text-lg text-primary-500`}></i>
        <h3 className="font-heading text-base font-semibold text-foreground-950">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

export default function SpecPanel() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Paleta de cores (5 papéis)" icon="ri-palette-line">
        <div className="space-y-3">
          {paletteRoles.map((r) => (
            <div key={r.role} className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-50 p-3">
              <span
                className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-background-300"
                style={{ backgroundColor: `oklch(${r.swatch})` }}
              ></span>
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground-900">{r.role}</p>
                <p className="mt-0.5 text-xs text-foreground-600">{r.usage}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.anchors.map((a) => (
                    <span key={a} className="rounded-full bg-background-100 px-2 py-0.5 text-[11px] text-foreground-600">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-accent-100/60 p-2.5 text-[11px] text-foreground-600">
          Formato OKLCH: variáveis guardam os canais (ex.: <span className="font-mono">0.64 0.17 42</span>) e o Tailwind aplica com{' '}
          <span className="font-mono">oklch(var(--token) / alpha)</span>.
        </p>
      </Section>

      <Section title="Tipografia" icon="ri-font-family">
        <div className="space-y-2">
          {typography.map((t) => (
            <div key={t.alias} className="flex items-center justify-between rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground-900" style={{ fontFamily: t.cssVar }}>
                  {t.font}
                </p>
                <p className="text-[11px] text-foreground-500">{t.alias}</p>
              </div>
              <span className="font-mono text-[11px] text-foreground-400">{t.cssVar}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Layout & Raios" icon="ri-layout-2-line">
        <ul className="space-y-2">
          {layoutScale.map((l) => (
            <li key={l.token} className="flex items-center justify-between rounded-lg bg-background-100/60 px-3 py-2">
              <span className="font-mono text-xs text-foreground-800">{l.token}</span>
              <span className="text-[11px] text-foreground-500">{l.usage}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Stack & Linguagem" icon="ri-code-box-line">
        <div className="grid grid-cols-2 gap-2">
          {stack.map((s) => (
            <div key={s.name} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2">
              <p className="text-sm font-semibold text-foreground-900">{s.name}</p>
              <p className="font-mono text-[11px] text-foreground-500">{s.version}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground-600">
          Linguagem: <strong>TypeScript</strong> + <strong>React SPA</strong> + <strong>TailwindCSS</strong>.
          Ícones via Remix Icon (CDN). Gráficos com recharts. Backend: Firebase (Auth + Firestore em bodycoach_users/{'{uid}'}/…), servido pelo Worker do Cloudflare em /body-coach/.
        </p>
      </Section>

      <Section title="Modelo de dados (coleções do Firestore)" icon="ri-database-2-line">
        <div className="space-y-2">
          {dataModel.map((t) => (
            <div key={t.table} className="rounded-lg border border-background-200 bg-background-50 p-3">
              <p className="font-mono text-xs font-semibold text-primary-700">{t.table}</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-foreground-600">{t.columns}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Arquivos de configuração" icon="ri-settings-3-line">
        <ul className="space-y-2 text-sm text-foreground-700">
          {[
            { f: 'package.json', d: 'Dependências e scripts (deps apenas).' },
            { f: 'tailwind.config.ts', d: 'Tokens de cor (5 papéis) e famílias de fonte.' },
            { f: 'vite.config.ts', d: 'Alias @ → src, define __BASE_PATH__, AutoImport.' },
            { f: 'tsconfig*.json', d: 'Configuração do TypeScript.' },
            { f: 'index.html', d: 'SEO, fontes e CDNs de ícones.' },
            { f: 'src/index.css', d: 'Variáveis OKLCH, dark mode e utilitários.' },
          ].map((x) => (
            <li key={x.f} className="flex items-start gap-2 rounded-lg bg-background-100/60 px-3 py-2">
              <i className="ri-file-copy-2-line mt-0.5 text-foreground-400"></i>
              <span>
                <span className="font-mono text-xs font-semibold text-foreground-900">{x.f}</span>
                <span className="block text-[11px] text-foreground-500">{x.d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-foreground-500">
          O conteúdo completo de cada arquivo está na aba <strong>“Arquivos”</strong>, grupo <strong>config raiz</strong>.
        </p>
      </Section>
    </div>
  );
}