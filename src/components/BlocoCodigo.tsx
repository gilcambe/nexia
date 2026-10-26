import React, { useState, useEffect, useRef } from 'react';
import { executarCodigo, type TipoLinguagem } from '@/lib/executor';

interface BlocoCodigoProps {
  linguagem: string;
  codigo: string;
  onCorrigir?: (codigo: string, erro: string) => void;
  arquivoAnexado?: { nome: string; conteudo: string };
}

export default function BlocoCodigo({ linguagem, codigo, onCorrigir, arquivoAnexado }: BlocoCodigoProps) {
  const [rodando, setRodando] = useState(false);
  const [saida, setSaida] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [tempoRestante, setTempoRestante] = useState<number>(10);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const langLower = linguagem.toLowerCase().trim();
  const ehSuportado = ['python', 'py', 'js', 'javascript', 'html'].includes(langLower);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const parar = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRodando(false);
    setRodando(false);
    setErro('Execução interrompida pelo usuário ou limite de 10s atingido.');
  };

  const rodar = async () => {
    if (!ehSuportado) return;
    setRodando(true);
    setSaida(null);
    setErro(null);
    setImagemUrl(null);
    setTempoRestante(10);

    // Timer de 10s
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const decorrido = Math.floor((Date.now() - startTime) / 1000);
      const restante = 10 - decorrido;
      if (restante <= 0) {
        parar();
      } else {
        setTempoRestante(restante);
      }
    }, 1000);

    try {
      let tipo: TipoLinguagem = 'js';
      if (langLower === 'python' || langLower === 'py') tipo = 'python';
      else if (langLower === 'html') tipo = 'html';

      const res = await executarCodigo(tipo, codigo, arquivoAnexado ? [arquivoAnexado] : undefined);
      
      if (timerRef.current) clearInterval(timerRef.current);
      setRodando(false);

      if (res.erro) {
        setErro(res.erro);
      } else {
        setSaida(res.saida || 'Executado com sucesso (sem saída impressa).');
        if (res.imagem) {
          setImagemUrl(res.imagem);
        }
      }
    } catch (e: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRodando(false);
      const msg = e instanceof Error ? e.message : 'Erro desconhecido na execução';
      setErro(msg);
    }
  };

  if (!ehSuportado) {
    return (
      <div className="my-4 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] overflow-hidden">
        <div className="px-4 py-2 bg-[var(--cx-hover)] text-xs font-mono text-[var(--cx-mut)] flex justify-between items-center">
          <span>{linguagem || 'código'}</span>
        </div>
        <pre className="p-4 text-sm font-mono overflow-x-auto text-[var(--cx-txt)]"><code>{codigo}</code></pre>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] overflow-hidden shadow-sm" data-testid="bloco-codigo">
      <div className="px-4 py-2.5 bg-[var(--cx-hover)] text-xs font-mono text-[var(--cx-mut)] flex justify-between items-center border-b border-[var(--cx-line)]">
        <span className="font-semibold uppercase tracking-wider">{linguagem}</span>
        <div className="flex items-center gap-2">
          {rodando ? (
            <div className="flex items-center gap-2">
              <span className="text-[var(--cx-ac)] animate-pulse font-mono">Rodando ({tempoRestante}s)...</span>
              <button
                onClick={parar}
                className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-sans transition-colors"
                data-testid="botao-parar"
              >
                Parar
              </button>
            </div>
          ) : (
            <button
              onClick={rodar}
              className="px-3 py-1.5 bg-[var(--cx-ac)] text-black hover:opacity-90 rounded-lg text-xs font-sans font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              data-testid="botao-rodar"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Rodar
            </button>
          )}
        </div>
      </div>

      <pre className="p-4 text-sm font-mono overflow-x-auto text-[var(--cx-txt)] bg-black/20"><code>{codigo}</code></pre>

      {(saida || erro || imagemUrl || langLower === 'html') && (
        <div className="border-t border-[var(--cx-line)] p-4 bg-black/40 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-mut)] flex items-center justify-between">
            <span>Saída da Execução</span>
            {rodando && <span className="animate-spin w-3 h-3 border-2 border-[var(--cx-ac)] border-t-transparent rounded-full" />}
          </div>

          {saida && (
            <pre className="p-3 rounded-lg bg-black/60 text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-60" data-testid="saida-codigo">
              {saida}
            </pre>
          )}

          {imagemUrl && (
            <div className="mt-2 p-2 bg-white rounded-lg inline-block shadow-md">
              <img src={imagemUrl} alt="Gráfico gerado pelo Pyodide" className="max-w-full h-auto rounded" data-testid="grafico-gerado" />
            </div>
          )}

          {langLower === 'html' && !rodando && (
            <div className="mt-2 border border-[var(--cx-line)] rounded-lg overflow-hidden bg-white">
              <div className="px-3 py-1 bg-gray-100 text-xs text-gray-500 border-b">Visualização em Iframe (Isolado)</div>
              <iframe
                ref={iframeRef}
                srcDoc={codigo}
                sandbox="allow-scripts"
                className="w-full h-64 border-0"
                title="Visualização HTML Isolada"
                data-testid="iframe-html"
              />
            </div>
          )}

          {erro && (
            <div className="space-y-2" data-testid="bloco-erro">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-300 whitespace-pre-wrap overflow-x-auto">
                {erro}
              </div>
              {onCorrigir && (
                <button
                  onClick={() => onCorrigir(codigo, erro)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  data-testid="botao-corrigir"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                  Corrigir com o Cortex
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
