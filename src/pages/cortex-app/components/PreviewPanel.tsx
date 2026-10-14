import { useState, useCallback } from "react";

interface PreviewPanelProps {
  code: string;
  originalCode?: string;
  fileName?: string;
  language?: string;
}

export default function PreviewPanel({ code, originalCode, fileName = "preview", language = "typescript" }: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code" | "diff">("preview");

  const showCode = useCallback(() => setViewMode("code"), []);
  const showDiff = useCallback(() => setViewMode("diff"), []);
  const showPreview = useCallback(() => setViewMode("preview"), []);

  const downloadZip = useCallback(() => {
    const zipContent = `
# ${fileName}

${code}
`;
    const blob = new Blob([zipContent], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, fileName]);

  const downloadCode = useCallback(() => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${language === "typescript" ? "ts" : language === "javascript" ? "js" : language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, fileName, language]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, [code]);

  const btnBase = "px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer disabled:opacity-40";
  const btnPrimary = `${btnBase} bg-nexia-cyan text-[#0a0a0f] hover:bg-nexia-cyan-dim`;
  const btnSecondary = `${btnBase} bg-nexia-surface border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/30`;
  const btnActive = `${btnBase} bg-nexia-cyan/20 border-nexia-cyan/40 text-nexia-cyan`;

  return (
    <div className="flex flex-col h-full bg-nexia-surface border border-nexia-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-2 bg-[#252932] border-b border-nexia-border">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-nexia-muted uppercase tracking-wider">Preview</span>
          <span className="w-1 h-1 rounded-full bg-nexia-cyan" />
          <span className="text-xs text-nexia-muted font-mono">{fileName}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={showPreview}
            className={viewMode === "preview" ? btnActive : btnSecondary}
            title="Visualizar resultado"
          >
            <i className="ri-layout-grid-line" /> Preview
          </button>
          <button
            onClick={showCode}
            className={viewMode === "code" ? btnActive : btnSecondary}
            title="Ver código fonte"
          >
            <i className="ri-code-line" /> Ver Código
          </button>
          {originalCode && (
            <button
              onClick={showDiff}
              className={viewMode === "diff" ? btnActive : btnSecondary}
              title="Comparar com original"
            >
              <i className="ri-git-commit-line" /> Ver Diff
            </button>
          )}
          <button onClick={downloadCode} className={btnSecondary} title="Baixar código">
            <i className="ri-download-line" /> Baixar
          </button>
          <button onClick={downloadZip} className={btnSecondary} title="Baixar como ZIP">
            <i className="ri-file-zip-line" /> ZIP
          </button>
          <button onClick={copyCode} className={btnSecondary} title="Copiar código">
            <i className="ri-file-copy-line" /> Copiar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === "preview" && (
          <div className="bg-[#0a0a0f] rounded-lg border border-nexia-border p-4 min-h-[200px] font-mono text-sm text-nexia-muted overflow-auto">
            <pre className="whitespace-pre-wrap break-words">{code}</pre>
          </div>
        )}

        {viewMode === "code" && (
          <div className="bg-[#0a0a0f] rounded-lg border border-nexia-border p-4 min-h-[200px] font-mono text-sm overflow-auto">
            <pre className="whitespace-pre-wrap break-words"><code>{code}</code></pre>
          </div>
        )}

        {viewMode === "diff" && originalCode && (
          <div className="bg-[#0a0a0f] rounded-lg border border-nexia-border p-4 min-h-[200px] font-mono text-sm overflow-auto">
            <DiffView original={originalCode} modified={code} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-[#252932] border-t border-nexia-border flex justify-between items-center text-xs text-nexia-muted">
        <span>{code.split("\n").length} linhas · {code.length} caracteres</span>
        <span className="font-mono">{language}</span>
      </div>
    </div>
  );
}

function DiffView({ original, modified }: { original: string; modified: string }) {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const maxLines = Math.max(origLines.length, modLines.length);

  return (
    <div className="grid grid-cols-[50%_50%] gap-0">
      <div className="border-r border-nexia-border p-2">
        <div className="text-xs text-nexia-muted mb-2 px-2">Original</div>
        <pre className="whitespace-pre-wrap break-words">
          {origLines.map((line, i) => (
            <div
              key={i}
              className={line !== modLines[i] ? "bg-red-500/10 text-red-300" : "text-nexia-muted"}
            >
              {line || <span className="text-nexia-border">∅</span>}
            </div>
          ))}
        </pre>
      </div>
      <div className="p-2">
        <div className="text-xs text-nexia-muted mb-2 px-2">Modificado</div>
        <pre className="whitespace-pre-wrap break-words">
          {modLines.map((line, i) => (
            <div
              key={i}
              className={line !== origLines[i] ? "bg-emerald-500/10 text-emerald-300" : "text-nexia-muted"}
            >
              {line || <span className="text-nexia-border">∅</span>}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
