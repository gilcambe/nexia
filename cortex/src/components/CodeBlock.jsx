import { useState, useRef, useCallback } from "react";

const WORKER_POR_LINGUAGEM = {
  python: "pythonWorker.js",
  js: "jsWorker.js",
  javascript: "jsWorker.js",
  html: "runHTML.js",
};

export default function CodeBlock({ codigo = "", linguagem = "js" }) {
  const [saida, setSaida] = useState("");
  const [erro, setErro] = useState("");
  const [rodando, setRodando] = useState(false);
  const workerRef = useRef(null);

  const limpar = useCallback(() => {
    setSaida("");
    setErro("");
  }, []);

  const parar = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setRodando(false);
  }, []);

  const rodar = useCallback(() => {
    limpar();
    const nomeWorker = WORKER_POR_LINGUAGEM[linguagem];
    if (!nomeWorker) {
      setErro(`Linguagem não suportada: ${linguagem}`);
      return;
    }
    try {
      const w = new Worker(new URL(`./${nomeWorker}`, import.meta.url));
      workerRef.current = w;
      setRodando(true);
      w.postMessage({ codigo });
      w.onmessage = (ev) => {
        setSaida((s) => (s ? `${s}\n${ev.data}` : String(ev.data)));
      };
      w.onerror = (ev) => {
        setErro(ev.message || "Erro ao executar");
      };
      w.onmessageerror = () => {
        setErro("Erro ao ler resposta do worker");
      };
    } catch (e) {
      setErro(e.message || "Não foi possível iniciar o worker");
    }
  }, [codigo, linguagem, limpar]);

  return (
    <div className="code-block rounded-xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-100">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{linguagem}</span>
        <button
          onClick={rodar}
          disabled={rodando}
          className="px-2 py-1 rounded text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {rodando ? "Rodando…" : "▶ Rodar"}
        </button>
        <button
          onClick={parar}
          disabled={!rodando}
          className="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ⏹ Parar
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-slate-700"><code>{codigo}</code></pre>
      <div className="p-3 border-t border-slate-200">
        {rodando && linguagem === "html" ? (
          <iframe
            className="w-full h-48 rounded border border-slate-200 bg-white"
            title="Pré-visualização HTML"
            srcDoc={codigo}
            sandbox="allow-scripts"
          />
        ) : (
          <div className="text-xs text-slate-600 whitespace-pre-wrap break-words">
            {saida}
            {erro && <span className="text-red-600">{erro}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
