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

  const btn = "px-3 py-1.5 text-xs rounded-lg border border-nexia-border bg-nexia-surface text-nexia-muted hover:text-white hover:border-nexia-cyan/30 transition-colors cursor-pointer disabled:opacity-40";
  const btnActive = "px-3 py-1.5 text-xs rounded-lg border border-nexia-cyan/40 bg-nexia-cyan/20 text-nexia-cyan transition-colors cursor-pointer";

  return (
    <div className="flex flex-col h-full bg-nexia-surface border border-nexia-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-2 bg-[#252932] border-b border-nexia-border">
        <div className="flex space-x-1">
          <button
            onClick={showCode}
            className={viewMode === "code" ? btnActive : btn}
            title="Ver código fonte"
          >
            Ver Código
          </button>
          {originalCode && (
            <button
              onClick={showDiff}
              className={viewMode === "diff" ? btnActive : btn}
              title="Comparar com original"
            >
              Ver Diff
            </button>
          )}
          <button onClick={downloadZip} className={btn} title="Baixar como ZIP">
            ZIP
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-nexia-muted font-mono">{fileName}</span>
          <span className="w-1 h-1 rounded-full bg-nexia-cyan" />
          <span className="text-xs font-medium text-nexia-muted uppercase tracking-wider">Preview</span>
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
        <div className="flex items-center space-x-2">
          <button onClick={downloadCode} className={btn} title="Baixar código">
            Baixar
          </button>
          <button onClick={copyCode} className={btn} title="Copiar código">
            Copiar
          </button>
          <span className="font-mono">{language}</span>
        </div>
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
