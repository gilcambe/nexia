// Executor isolado Web Worker / Pyodide / Sandbox HTML para o app Cortex
// Implementa Pilar 3: escrever e rodar código no navegador com segurança e Pyodide (Python), JS e HTML.

export type TipoLinguagem = 'python' | 'js' | 'javascript' | 'html' | 'css';

export interface ExecucaoResultado {
  sucesso: boolean;
  saida: string;
  erro?: string;
  imagemUrl?: string;
  tempoMs: number;
}

// Singleton / Gerenciador do Pyodide no Web Worker
let pyodideWorker: Worker | null = null;
let pyodidePronto = false;
let pyodideCarregando = false;
const callbacksPyodide = new Map<string, (res: { sucesso: boolean; saida: string; erro?: string; imagemUrl?: string }) => void>();

function iniciarPyodideWorker(): Worker {
  if (pyodideWorker) return pyodideWorker;

  // Criamos um Worker via Blob contendo o código de inicialização do Pyodide do CDN jsDelivr
  const workerCode = `
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

    let pyodide = null;

    async function carregar() {
      try {
        pyodide = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
        });
        await pyodide.loadPackage(["micropip", "numpy", "pandas", "matplotlib"]);
        postMessage({ tipo: 'pronto' });
      } catch (err) {
        postMessage({ tipo: 'erro_init', erro: err.message || String(err) });
      }
    }

    carregar();

    onmessage = async (e) => {
      const { id, codigo, arquivoDados, nomeArquivo } = e.data;
      if (!pyodide) {
        postMessage({ id, sucesso: false, erro: 'Pyodide ainda está carregando...' });
        return;
      }

      // Redireciona stdout e stderr
      let saidaBuffer = '';
      pyodide.setStdout({ batched: (msg) => { saidaBuffer += msg + '\\n'; } });
      pyodide.setStderr({ batched: (msg) => { saidaBuffer += msg + '\\n'; } });

      try {
        // Se houver arquivo anexado (CSV/XLSX), grava no FS virtual do Pyodide
        if (arquivoDados && nomeArquivo) {
          try {
            pyodide.FS.writeFile(nomeArquivo, arquivoDados);
            saidaBuffer += \`[Pyodide] Arquivo '\${nomeArquivo}' carregado no ambiente.\\n\`;
          } catch (ex) {
            saidaBuffer += \`[Pyodide] Aviso: não foi possível gravar arquivo: \${ex.message}\\n\`;
          }
        }

        // Executa o código Python e captura eventuais gráficos matplotlib
        let imagemUrl = null;
        
        // Injeta helper para capturar plt se matplotlib foi usado
        const codigoCompleto = \`
import sys
import io
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

\${codigo}

if plt and plt.get_fignums():
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    import base64
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    print("__NEXIA_IMG__:" + img_b64)
    plt.close('all')
\`;

        await pyodide.runPythonAsync(codigoCompleto);

        // Extrai imagem se houver no buffer de saída
        let saidaLimpa = '';
        for (const linha of saidaBuffer.split('\\n')) {
          if (linha.startsWith('__NEXIA_IMG__:')) {
            imagemUrl = 'data:image/png;base64,' + linha.replace('__NEXIA_IMG__:', '');
          } else {
            saidaLimpa += linha + '\\n';
          }
        }

        postMessage({ id, sucesso: true, saida: saidaLimpa.trim(), imagemUrl });
      } catch (err) {
        postMessage({ 
          id, 
          sucesso: false, 
          saida: saidaBuffer.trim(), 
          erro: err.message || String(err) 
        });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  pyodideWorker = new Worker(URL.createObjectURL(blob));

  pyodideWorker.onmessage = (e) => {
    const { id, tipo, sucesso, saida, erro, imagemUrl } = e.data;
    if (tipo === 'pronto') {
      pyodidePronto = true;
      pyodideCarregando = false;
      return;
    }
    if (tipo === 'erro_init') {
      pyodideCarregando = false;
      return;
    }
    if (id && callbacksPyodide.has(id)) {
      const cb = callbacksPyodide.get(id);
      if (cb) {
        cb({ sucesso, saida, erro, imagemUrl });
        callbacksPyodide.delete(id);
      }
    }
  };

  pyodideCarregando = true;
  return pyodideWorker;
}

export async function rodarPython(codigo: string, arquivoDados?: Uint8Array | ArrayBuffer, nomeArquivo?: string, timeoutMs = 10000): Promise<ExecucaoResultado> {
  const inicio = Date.now();
  const worker = iniciarPyodideWorker();
  const id = 'py_' + Math.random().toString(36).slice(2);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      callbacksPyodide.delete(id);
      // Mata e recria worker se estourar prazo
      if (worker) worker.terminate();
      pyodideWorker = null;
      pyodidePronto = false;
      resolve({
        sucesso: false,
        saida: '',
        erro: 'Tempo limite esgotado (10s) — execução interrompida.',
        tempoMs: Date.now() - inicio
      });
    }, timeoutMs);

    callbacksPyodide.set(id, (res) => {
      clearTimeout(timer);
      resolve({
        sucesso: res.sucesso,
        saida: res.saida,
        erro: res.erro,
        imagemUrl: res.imagemUrl,
        tempoMs: Date.now() - inicio
      });
    });

    worker.postMessage({ id, codigo, arquivoDados, nomeArquivo });
  });
}

// Executor de JavaScript isolado em Worker sem acesso a window/localStorage
export async function rodarJS(codigo: string, timeoutMs = 10000): Promise<ExecucaoResultado> {
  const inicio = Date.now();
  const workerCode = `
    onmessage = function(e) {
      const { codigo } = e.data;
      let saida = [];
      
      // Substitui console.log para capturar saída
      const consoleFake = {
        log: (...args) => saida.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => saida.push('[ERRO] ' + args.join(' ')),
        warn: (...args) => saida.push('[AVISO] ' + args.join(' ')),
      };

      try {
        // Isola completamente removendo window, document, localStorage
        const fn = new Function('console', 'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest', \`
          'use strict';
          \${codigo}
        \`);

        fn(consoleFake, undefined, undefined, undefined, undefined, undefined, undefined);
        postMessage({ sucesso: true, saida: saida.join('\\n') });
      } catch (err) {
        postMessage({ sucesso: false, saida: saida.join('\\n'), erro: err.message || String(err) });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({
        sucesso: false,
        saida: '',
        erro: 'Tempo limite esgotado (10s) — loop infinito ou execução longa interrompida.',
        tempoMs: Date.now() - inicio
      });
    }, timeoutMs);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({
        sucesso: e.data.sucesso,
        saida: e.data.saida || '(executado sem saída no console)',
        erro: e.data.erro,
        tempoMs: Date.now() - inicio
      });
    };

    worker.postMessage({ codigo });
  });
}
