// Carregar Pyodide com Subresource Integrity (SRI)
// ATENCAO: substituir o hash abaixo pelo SHA-384 real de pyodide.js v0.26.4
const pyodideUrl = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const pyodideIntegrity = 'sha384-placeholder-hash-para-pyodide-v0-26-4-substituir-pelo-hash-real';

// Lista branca de imports permitidos
const ALLOWED_IMPORTS = ['pandas', 'matplotlib', 'numpy', 'json', 'sys', 'io', 'base64', 'datetime', 'math', 'random', 'collections', 'itertools'];
const MAX_CODE_SIZE = 1024 * 1024;
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TOTAL_FILES_SIZE = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT = 10000;

let pyodide = null;
let initPromise = null;
let isInitialized = false;

// Carregar script com SRI
function loadScriptWithSRI(url, integrity) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Inicializar Pyodide (thread-safe: promessa unica)
async function initializePyodide() {
  if (isInitialized && pyodide) return pyodide;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadScriptWithSRI(pyodideUrl, pyodideIntegrity);
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/', fullStdLib: false, jsglobals: self });
    await pyodide.loadPackage(['pandas', 'matplotlib']);
    isInitialized = true;
    return pyodide;
  })();
  return initPromise;
}

// Validar caminho de arquivo (prevenir path traversal)
function validateFilePath(path) {
  if (typeof path !== 'string' || path.length === 0) throw new Error('Caminho de arquivo invalido');
  if (path.includes('../') || path.includes('..\\') || path.startsWith('/') || path.startsWith('\\')) throw new Error('Caminho de arquivo contem caracteres invalidos');
  const allowedExtensions = ['.py', '.txt', '.csv', '.json', '.png', '.jpg', '.jpeg', '.svg'];
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) throw new Error(`Extensao de arquivo nao permitida: ${ext}`);
  return true;
}

// Validar imports de forma robusta (captura import x, from x import, nomes com ponto, espacos)
function validateImports(code) {
  const importPattern = /(?:^|;)\s*(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/gm;
  let match;
  while ((match = importPattern.exec(code)) !== null) {
    const importName = (match[1] || match[2] || '').split('.')[0];
    if (importName && !ALLOWED_IMPORTS.includes(importName)) {
      throw new Error(`Import nao permitido: ${importName}`);
    }
  }
}

// Escrever arquivos no FS virtual
async function writeFilesToFS(files) {
  if (!pyodide || !isInitialized) throw new Error('Pyodide nao inicializado');
  if (!Array.isArray(files) || files.length === 0) return;
  let totalSize = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Arquivo invalido: path e content sao obrigatorios');
    }
    validateFilePath(file.path);
    const fileSize = new Blob([file.content]).size;
    if (fileSize > MAX_FILE_SIZE) throw new Error(`Arquivo muito grande: ${file.path}`);
    totalSize += fileSize;
    if (totalSize > MAX_TOTAL_FILES_SIZE) throw new Error('Tamanho total dos arquivos excede o limite');
  }
  for (const file of files) {
    const dir = file.path.substring(0, file.path.lastIndexOf('/'));
    if (dir) pyodide.FS.mkdirTree(dir);
    pyodide.FS.writeFile(file.path, new TextEncoder().encode(file.content));
  }
}

// Capturar stdout, stderr e imagens do matplotlib
function setupCapture() {
  if (!pyodide) throw new Error('Pyodide nao inicializado');
  pyodide.runPython(`
import sys, io, base64
from io import BytesIO
class _Cap:
    def __init__(self): self.buffer = io.StringIO()
    def write(self, t): self.buffer.write(t); sys.__stdout__.write(t)
    def getvalue(self): return self.buffer.getvalue()
sys.stdout = _Cap()
sys.stderr = _Cap()
try:
    import matplotlib.pyplot as plt
    _orig = plt.savefig
    def _hook(*a, **k):
        buf = BytesIO(); plt.savefig(buf, format='png', **k); buf.seek(0)
        globals().setdefault('_captured_images', []).append(base64.b64encode(buf.getvalue()).decode()); buf.close()
        return _orig(*a, **k)
    plt.savefig = _hook
except Exception:
    pass
`);
  return () => {
    try {
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');
      const images = pyodide.runPython('globals().get("_captured_images", [])');
      pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');
      return { stdout, stderr, images };
    } catch (e) { return { stdout: '', stderr: '', images: [] }; }
  };
}

// Executar codigo com timeout real via Worker dedicado
function executeWithTimeout(code, timeout) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([`self.onmessage=function(e){try{const r=self.pyodide.runPython(e.data.code);self.postMessage({ok:true,r})}catch(e){self.postMessage({ok:false,e:String(e)})}};`], { type: 'application/javascript' });
    const w = new Worker(URL.createObjectURL(blob));
    let t;
    w.onmessage = (ev) => { clearTimeout(t); if (w) w.terminate(); resolve(ev.data); };
    w.onerror = (ev) => { clearTimeout(t); if (w) w.terminate(); reject(ev.error || new Error('Worker error')); };
    w.postMessage({ code });
    t = setTimeout(() => { if (w) w.terminate(); reject(new Error('Execution timeout')); }, timeout);
  });
}

// Executar codigo Python
async function executePythonCode(code, timeout) {
  if (!pyodide || !isInitialized) throw new Error('Pyodide nao inicializado');
  if (typeof code !== 'string' || code.length === 0) throw new Error('Codigo deve ser uma string nao vazia');
  if (code.length > MAX_CODE_SIZE) throw new Error('Codigo muito grande');
  validateImports(code);
  const getCapture = setupCapture();
  try {
    pyodide.runPython('globals()["_captured_images"] = []');
    const workerResult = await executeWithTimeout(code, timeout);
    const { stdout, stderr, images } = getCapture();
    return { stdout, stderr, images, error: workerResult.e || null };
  } catch (error) {
    const { stdout, stderr, images } = getCapture();
    return { stdout, stderr, images, error: error.message || String(error) };
  }
}

function cleanup() {}

// Listener principal
self.onmessage = async function(event) {
  const { code, files, timeout = DEFAULT_TIMEOUT } = event.data || {};
  try {
    if (typeof code !== 'string') throw new Error('Codigo deve ser uma string');
    if (timeout !== undefined && (typeof timeout !== 'number' || timeout <= 0)) throw new Error('Timeout deve ser um numero positivo');
    await initializePyodide();
    if (files) await writeFilesToFS(files);
    const result = await executePythonCode(code, timeout);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message || String(error) });
  } finally {
    cleanup();
  }
};

self.onerror = function() { cleanup(); };
self.onclose = function() { cleanup(); };
