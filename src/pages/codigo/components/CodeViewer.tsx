import { useState, useCallback } from "react";
import type { SourceFile } from "../data/sourceFiles";

export default function CodeViewer({ file }: { file: SourceFile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyFile = useCallback(() => {
    navigator.clipboard.writeText(`// ===== ${file.path} =====\n${file.content}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [file]);

  const lines = file.content.split("\n").length;

  const extColors: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-nexia-cyan", js: "text-yellow-400", json: "text-orange-400", css: "text-pink-400",
  };
  const ext = file.path.split(".").pop() || "ts";
  const extColor = extColors[ext] || "text-nexia-muted";

  return (
    <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden hover:border-nexia-cyan/15 transition-all">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-surface2 border border-nexia-border flex-shrink-0">
          <i className={`ri-file-code-line ${extColor} text-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white truncate">{file.path}</p>
          <p className="text-xs text-nexia-muted truncate">{file.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] text-nexia-muted bg-nexia-surface2 px-2 py-0.5 rounded-full border border-nexia-border">{lines} linhas</span>
          <button onClick={(e) => { e.stopPropagation(); copyFile(); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-nexia-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap">
            <i className={copied ? "ri-check-line text-emerald-400" : "ri-file-copy-line"} />
            {copied ? "Copiado" : "Copiar"}
          </button>
          <i className={`${open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-nexia-muted`} />
        </div>
      </div>
      {open && (
        <div className="border-t border-nexia-border">
          <pre className="p-4 font-mono text-[11px] text-nexia-muted leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto">
            <code>{file.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
