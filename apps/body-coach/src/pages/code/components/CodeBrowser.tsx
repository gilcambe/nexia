import { useMemo, useState } from 'react';
import type { SourceFile } from './sourceFiles';

function CodeView({ file }: { file: SourceFile }) {
  const lines = useMemo(() => file.code.split('\n'), [file.code]);
  return (
    <div className="overflow-auto rounded-lg border border-background-200 bg-background-100/40">
      <table className="w-full border-collapse font-mono text-[12px] leading-relaxed">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="align-top">
              <td className="w-10 shrink-0 select-none border-r border-background-200/70 px-2 py-0.5 text-right text-foreground-400">
                {i + 1}
              </td>
              <td className="whitespace-pre px-3 py-0.5 text-foreground-800">{line || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CodeBrowser({
  files,
  groupOrder,
}: {
  files: SourceFile[];
  groupOrder: string[];
}) {
  const [selected, setSelected] = useState(files[0]?.path ?? '');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupOrder.map((g) => [g, true])),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
    );
  }, [files, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SourceFile[]>();
    filtered.forEach((f) => {
      const arr = map.get(f.group) ?? [];
      arr.push(f);
      map.set(f.group, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const ia = groupOrder.indexOf(a[0]);
      const ib = groupOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }, [filtered, groupOrder]);

  const current = files.find((f) => f.path === selected) ?? filtered[0] ?? null;

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const copyAll = async () => {
    const header =
      '/* ============================================================\n' +
      '   NEXIA Body Coach AI - dump COMPLETO do projeto\n' +
      `   ${files.length} arquivos (código, config, json, env, etc.)\n` +
      '   ============================================================ */\n\n';
    const dump = files
      .map((f) => `/* ===================== ${f.path} ===================== */\n\n${f.code}`)
      .join('\n\n\n');
    try {
      await navigator.clipboard.writeText(header + dump);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setCopiedAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* file tree */}
      <aside className="w-full shrink-0 lg:w-72">
        <div className="rounded-lg border border-background-200 bg-background-50 p-3">
          <div className="mb-3 flex items-center gap-2 rounded-md border border-background-200 bg-background-100/60 px-2.5 py-2">
            <i className="ri-search-line text-sm text-foreground-400"></i>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar arquivo ou código..."
              className="w-full bg-transparent text-sm text-foreground-800 outline-none placeholder:text-foreground-400"
            />
          </div>

          <button
            onClick={copyAll}
            className="mb-3 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-200 bg-background-100/60 px-3 py-2 text-xs font-medium text-foreground-700 transition hover:bg-background-200"
          >
            <i className={copiedAll ? 'ri-check-line text-accent-600' : 'ri-file-copy-2-line'}></i>
            {copiedAll ? 'Tudo copiado!' : 'Copiar tudo (todos os arquivos)'}
          </button>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto lg:max-h-[70vh]">
            {grouped.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-foreground-400">Nenhum arquivo encontrado.</p>
            )}
            {grouped.map(([group, items]) => (
              <div key={group}>
                <button
                  onClick={() => setOpenGroups((s) => ({ ...s, [group]: !s[group] }))}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-400 hover:text-foreground-600"
                >
                  <span>{group}</span>
                  <i className={`${openGroups[group] ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'}`}></i>
                </button>
                {openGroups[group] && (
                  <div className="space-y-0.5">
                    {items.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => setSelected(f.path)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                          current?.path === f.path
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-foreground-600 hover:bg-background-100'
                        }`}
                      >
                        <i className="ri-file-code-line shrink-0 text-foreground-400"></i>
                        <span className="truncate">{f.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* viewer */}
      <div className="min-w-0 flex-1">
        {current ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-foreground-800">{current.path}</p>
                <p className="text-[11px] text-foreground-400">
                  {current.language} · {current.lines} linhas · {(current.bytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 bg-background-100/60 px-3 py-1.5 text-xs font-medium text-foreground-700 transition hover:bg-background-200"
              >
                <i className={copied ? 'ri-check-line text-accent-600' : 'ri-file-copy-line'}></i>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <CodeView file={current} />
          </div>
        ) : (
          <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center text-sm text-foreground-400">
            Selecione um arquivo para visualizar.
          </div>
        )}
      </div>
    </div>
  );
}