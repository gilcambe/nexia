import React, { useState, useEffect, useRef } from 'react';

interface CodeBlockRunnerProps {
  language: string;
  code: string;
  onCorrigir?: (code: string, error: string) => void;
  attachedFile?: { name: string; content: string } | null;
}

export default function CodeBlockRunner({ language, code, onCorrigir, attachedFile }: CodeBlockRunnerProps) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(10);
  
  const workerRef = useRef<Worker | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const langLower = language.toLowerCase().trim();
  const isRunnable = ['python', 'py', 'javascript', 'js', 'html'].includes(langLower);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const parar = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
    setError((prev) => prev ? prev + '\n[Execução interrompida pelo usuário ou limite de 10s]' : '[Execução interrompida pelo usuário ou limite de 10s]');
  };

  const iniciarTimer = () => {
    setTimer(10);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          parar();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const rodarPython = async () => {
    setRunning(true);
    setOutput('');
    setError('');
    setImageUrl(null);
    iniciarTimer();

    // Web Worker blob para rodar Pyodide isolado
    const workerCode = `
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

      let pyodide = null;

      self.onmessage = async (e) => {
        const { code, fileData } = e.data;
        try {
          if (!pyodide) {
            postMessage({ type: 'stdout', data: 'Carregando Pyodide e pacotes (pandas, matplotlib)...\\n' });
            pyodide = await loadPyodide({
              indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
            });
            await pyodide.loadPackage(["micropip", "numpy", "pandas", "matplotlib"]);
          }

          // Se houver arquivo anexado, injetar no FS virtual do Pyodide
          if (fileData) {
            pyodide.FS.writeFile(fileData.name, fileData.content);
          }

          // Redirecionar stdout/stderr
          pyodide.runPython(\`
            import sys
            import io
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
          \`);

          let result = await pyodide.runPythonAsync(code);
          
          let stdout = pyodide.runPython("sys.stdout.getvalue()");
          let stderr = pyodide.runPython("sys.stderr.getvalue()");

          // Verificar se matplotlib gerou figura
          let figData = null;
          try {
            figData = pyodide.runPython(\`
              import matplotlib.pyplot as plt
              import io
              buf = io.BytesIO()
              if plt.get_fignums():
                plt.savefig(buf, format='png', bbox_inches='tight')
                buf.seek(0)
                import base64
                img_str = base64.b64encode(buf.read()).decode('utf-8')
                plt.close('all')
                img_str
              else:
                None
            \`);
          } catch (err) {
            // Ignora se matplotlib não foi usado ou deu erro na extração da figura
          }

          postMessage({ type: 'done', stdout, stderr, result: result !== undefined ? String(result) : null, image: figData });
        } catch (err) {
          postMessage({ type: 'error', data: err.message || String(err) });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data, stdout, stderr, result, image } = e.data;
      if (type === 'stdout') {
        setOutput((prev) => prev + data);
      } else if (type === 'done') {
        if (stdout) setOutput((prev) => prev + stdout);
        if (stderr) setError((prev) => prev + stderr);
        if (result && !output && !stdout) setOutput((prev) => prev + 'Resultado: ' + result + '\n');
        if (image) {
          setImageUrl(`data:image/png;base64,${image}`);
        }
        setRunning(false);
        if (timerRef.current) clearInterval(timerRef.current);
        worker.terminate();
        workerRef.current = null;
      } else if (type === 'error') {
        setError((prev) => prev + data);
        setRunning(false);
        if (timerRef.current) clearInterval(timerRef.current);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setError('Erro no Web Worker Python: ' + err.message);
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({
      code,
      fileData: attachedFile ? { name: attachedFile.name, content: attachedFile.content } : null,
    });
  };

  const rodarJS = async () => {
    setRunning(true);
    setOutput('');
    setError('');
    setImageUrl(null);
    iniciarTimer();

    // Web Worker isolado para JavaScript (sem acesso a window, document, localStorage)
    const workerCode = `
      self.onmessage = async (e) => {
        const { code } = e.data;
        let logs = [];
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;

        console.log = (...args) => {
          logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        };
        console.error = (...args) => {
          logs.push('[ERRO] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        };

        try {
          // Bloquear acesso a objetos globais sensíveis do browser propositalmente
          const restrictedAsyncFn = new Function('console', \`
            "use strict";
            // Bloqueios adicionais de segurança
            const window = undefined;
            const document = undefined;
            const localStorage = undefined;
            const sessionStorage = undefined;
            const fetch = undefined;
            
            return (async () => {
              try {
                return eval(\${JSON.stringify(code)});
              } catch (err) {
                throw err;
              }
            })();
          \`);

          const res = await restrictedAsyncFn(console);
          if (res !== undefined) {
            logs.push('Retorno: ' + (typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res)));
          }
          postMessage({ type: 'done', output: logs.join('\\n') });
        } catch (err) {
          postMessage({ type: 'error', output: logs.join('\\n'), error: err.message || String(err) });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, output, error } = e.data;
      if (type === 'done') {
        setOutput(output || 'Executado com sucesso (sem saída no console).');
      } else if (type === 'error') {
        if (output) setOutput(output);
        setError(error);
      }
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = (err) => {
      setError('Erro de execução JS: ' + err.message);
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ code });
  };

  const rodarHTML = () => {
    setRunning(true);
    setOutput('');
    setError('');
    setImageUrl(null);
    iniciarTimer();

    setTimeout(() => {
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(code);
          doc.close();
          setOutput('HTML renderizado no iframe sandbox com sucesso.');
        } else {
          setError('Não foi possível acessar o iframe.');
        }
      }
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }, 300);
  };

  const executar = () => {
    if (langLower === 'python' || langLower === 'py') {
      rodarPython();
    } else if (langLower === 'javascript' || langLower === 'js') {
      rodarJS();
    } else if (langLower === 'html') {
      rodarHTML();
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] overflow-hidden shadow-sm" data-testid="code-block-runner">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--cx-hover)] border-b border-[var(--cx-line)] text-xs font-mono">
        <span className="text-[var(--cx-mut)] uppercase tracking-wider">{language}</span>
        <div className="flex items-center gap-2">
          {running && (
            <span className="text-[var(--cx-ac)] animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--cx-ac)] animate-ping" />
              Rodando... ({timer}s)
            </span>
          )}
          {running ? (
            <button
              onClick={parar}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold transition-colors"
              data-testid="cx-parar-codigo"
            >
              Parar
            </button>
          ) : (
            <button
              onClick={executar}
              className="px-3 py-1 rounded-lg bg-[var(--cx-ac)] text-black font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
              data-testid="cx-rodar-codigo"
            >
              ▶ Rodar
            </button>
          )}
        </div>
      </div>

      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed bg-transparent text-[var(--cx-txt)]">
        <code>{code}</code>
      </pre>

      {(output || error || imageUrl || langLower === 'html') && (
        <div className="border-t border-[var(--cx-line)] p-4 bg-black/20 space-y-3" data-testid="cx-resultado-execucao">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-mut)]">Saída da Execução</span>
            {error && onCorrigir && (
              <button
                onClick={() => onCorrigir(code, error)}
                className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs font-semibold transition-colors"
                data-testid="cx-corrigir-cortex"
              >
                Corrigir com o Cortex
              </button>
            )}
          </div>

          {output && (
            <pre className="p-3 rounded-xl bg-black/40 text-xs font-mono text-emerald-300 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {output}
            </pre>
          )}

          {error && (
            <pre className="p-3 rounded-xl bg-red-500/10 text-xs font-mono text-red-400 whitespace-pre-wrap break-words max-h-60 overflow-y-auto" data-testid="cx-erro-execucao">
              {error}
            </pre>
          )}

          {imageUrl && (
            <div className="mt-2 space-y-1">
              <span className="text-xs text-[var(--cx-mut)]">Gráfico gerado (Matplotlib):</span>
              <div className="rounded-xl overflow-hidden border border-[var(--cx-line)] bg-white p-2">
                <img src={imageUrl} alt="Gráfico gerado pelo Python" className="max-w-full h-auto mx-auto" />
              </div>
            </div>
          )}

          {langLower === 'html' && (
            <div className="mt-2 space-y-1">
              <span className="text-xs text-[var(--cx-mut)]">Renderização HTML (sandbox sem allow-same-origin):</span>
              <div className="rounded-xl overflow-hidden border border-[var(--cx-line)] bg-white w-full h-64">
                <iframe
                  ref={iframeRef}
                  sandbox="allow-scripts"
                  className="w-full h-full border-0"
                  title="Renderização HTML isolada"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
