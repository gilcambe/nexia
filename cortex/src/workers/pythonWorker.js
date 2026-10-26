// Carregar Pyodide com Subresource Integrity (SRI)
const pyodideUrl = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const pyodideIntegrity = 'sha384-...'; // SHA-256 hash do pyodide.js v0.26.4

// Função para carregar script com SRI
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

// Carregar Pyodide com SRI
await loadScriptWithSRI(pyodideUrl, pyodideIntegrity);

let pyodide = null;
let timeoutId = null;
let isInitialized = false;

// Lista branca de imports permitidos
const ALLOWED_IMPORTS = [
  'pandas',
  'matplotlib',
  'numpy',
  'json',
  'sys',
  'io',
  'base64',
  'datetime',
  'math',
  'random',
  'collections',
  'itertools'
];

// Função para validar imports no código
function validateImports(code) {
  const importPattern = /\bimport\s+(\w+)|\bfrom\s+(\w+)\s+import/g;
  const matches = code.match(importPattern) || [];
  
  for (const match of matches) {
    const importName = match.match(/\b(\w+)\b/)?.[1];
    if (importName && !ALLOWED_IMPORTS.includes(importName)) {
      throw new Error(`Import não permitido: ${importName}`);
    }
  }
}

// Função para inicializar o Pyodide
async function initializePyodide() {
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      fullStdLib: false,
      jsglobals: self,
    });
    
    // Instalar pacotes necessários
    await pyodide.loadPackage(['pandas', 'matplotlib']);
    
    isInitialized = true;
    console.log('Pyodide initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Pyodide:', error);
    throw error;
  }
}

// Limite de tamanho para código e arquivos (em bytes)
const MAX_CODE_SIZE = 1024 * 1024; // 1MB
const MAX_FILE_SIZE = 1024 * 1024; // 1MB por arquivo
const MAX_TOTAL_FILES_SIZE = 10 * 1024 * 1024; // 10MB total

// Função para validar caminho de arquivo (prevenir path traversal)
function validateFilePath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Caminho de arquivo inválido');
  }
  
  // Verificar por tentativas de path traversal
  if (path.includes('../') || path.includes('..\\') || path.startsWith('/') || path.startsWith('\\')) {
    throw new Error('Caminho de arquivo contém caracteres inválidos');
  }
  
  // Limitar extensões permitidas
  const allowedExtensions = ['.py', '.txt', '.csv', '.json', '.png', '.jpg', '.jpeg', '.svg'];
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Extensão de arquivo não permitida: ${ext}`);
  }
  
  return true;
}

// Função para escrever arquivos no sistema de arquivos virtual
async function writeFilesToFS(files) {
  if (!pyodide || !isInitialized) {
    throw new Error('Pyodide not initialized');
  }
  
  if (!files || files.length === 0) {
    return;
  }
  
  // Validar e calcular tamanho total
  let totalSize = 0;
  for (const file of files) {
    if (!file.path || !file.content) {
      throw new Error('Arquivo inválido: path e content são obrigatórios');
    }
    
    validateFilePath(file.path);
    
    const fileSize = new Blob([file.content]).size;
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(`Arquivo muito grande: ${file.path} (${fileSize} bytes, máximo: ${MAX_FILE_SIZE} bytes)`);
    }
    
    totalSize += fileSize;
    if (totalSize > MAX_TOTAL_FILES_SIZE) {
      throw new Error('Tamanho total dos arquivos excede o limite permitido');
    }
  }
  
  for (const file of files) {
    try {
      // Criar diretório se não existir
      const dir = file.path.substring(0, file.path.lastIndexOf('/'));
      if (dir) {
        pyodide.FS.mkdirTree(dir);
      }
      
      // Escrever arquivo
      pyodide.FS.writeFile(file.path, new TextEncoder().encode(file.content));
    } catch (error) {
      console.error(`Failed to write file ${file.path}:`, error);
      throw error;
    }
  }
}

// Função para capturar stdout
function captureStdout() {
  const originalWrite = pyodide.runPython('import sys; sys.__stdout__.write');
  
  let capturedOutput = '';
  
  pyodide.runPython(`
import sys
import io
from contextlib import redirect_stdout

class Capture:
    def __init__(self):
        self.buffer = io.StringIO()
    
    def write(self, text):
        self.buffer.write(text)
        # Chama o original também para manter o comportamento normal
        sys.__stdout__.write(text)
    
    def getvalue(self):
        return self.buffer.getvalue()

capture = Capture()
sys.stdout = capture
`);
  
  return () => {
    const output = pyodide.runPython('capture.getvalue()');
    // Restaurar stdout original
    pyodide.runPython('sys.stdout = sys.__stdout__');
    return output;
  };
}

// Função para capturar stderr
function captureStderr() {
  const originalWrite = pyodide.runPython('import sys; sys.__stderr__.write');
  
  let capturedError = '';
  
  pyodide.runPython(`
import sys
import io
from contextlib import redirect_stderr

class Capture:
    def __init__(self):
        self.buffer = io.StringIO()
    
    def write(self, text):
        self.buffer.write(text)
        # Chama o original também para manter o comportamento normal
        sys.__stderr__.write(text)
    
    def getvalue(self):
        return self.buffer.getvalue()

capture = Capture()
sys.stderr = capture
`);
  
  return () => {
    const error = pyodide.runPython('capture.getvalue()');
    // Restaurar stderr original
    pyodide.runPython('sys.stderr = sys.__stderr__');
    return error;
  };
}

// Função para capturar imagens geradas pelo matplotlib
function captureMatplotlibImages() {
  const images = [];
  
  // Hook no matplotlib.pyplot.savefig
  pyodide.runPython(`
import matplotlib.pyplot as plt
import base64
from io import BytesIO

original_savefig = plt.savefig

def savefig_hook(*args, **kwargs):
    buf = BytesIO()
    plt.savefig(buf, format='png', **kwargs)
    buf.seek(0)
    img_data = base64.b64encode(buf.getvalue()).decode()
    # Armazenar globalmente para ser capturado depois
    if not hasattr(globals(), '_captured_images'):
        globals()['_captured_images'] = []
    globals()['_captured_images'].append(img_data)
    buf.close()
    return original_savefig(*args, **kwargs)

plt.savefig = savefig_hook
`);
  
  return () => {
    try {
      const capturedImages = pyodide.runPython('globals().get("_captured_images", [])');
      return capturedImages;
    } catch (error) {
      console.log('No images captured:', error);
      return [];
    }
  };
}

// Função para executar código Python em um worker separado (para timeout real)
function executePythonInWorker(code, timeout) {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = function(event) {
        const { code } = event.data;
        try {
          // Executar código
          const result = pyodide.runPython(code);
          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message || String(error) });
        }
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    let timeoutId;
    
    worker.onmessage = function(event) {
      clearTimeout(timeoutId);
      worker.terminate();
      resolve(event.data);
    };
    
    worker.onerror = function(error) {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(error);
    };
    
    // Enviar código para o worker
    worker.postMessage({ code });
    
    // Configurar timeout
    timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error('Execution timeout'));
    }, timeout);
  });
}

// Função para executar o código Python
async function executePythonCode(code, timeout = 10000) {
  if (!pyodide || !isInitialized) {
    throw new Error('Pyodide not initialized');
  }
  
  // Validar tamanho do código
  if (code.length > MAX_CODE_SIZE) {
    throw new Error(`Código muito grande: ${code.length} bytes, máximo: ${MAX_CODE_SIZE} bytes`);
  }
  
  // Validar imports
  validateImports(code);
  
  const getStdout = captureStdout();
  const getStderr = captureStderr();
  const getImages = captureMatplotlibImages();
  
  try {
    // Limpar imagens anteriores
    pyodide.runPython('globals()["_captured_images"] = []');
    
    // Executar código com timeout usando worker
    const workerResult = await executePythonInWorker(code, timeout);
    
    const stdout = getStdout();
    const stderr = getStderr();
    const images = getImages();
    
    return {
      stdout,
      stderr,
      images,
      error: workerResult.error || null
    };
  } catch (error) {
    // Capturar stdout/stderr mesmo em caso de timeout
    const stdout = getStdout();
    const stderr = getStderr();
    const images = getImages();
    
    return {
      stdout,
      stderr,
      images,
      error: error.message || String(error)
    };
  }
}

// Função para limpar recursos
function cleanup() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

// Listener para mensagens do worker
self.onmessage = async function(event) {
  const { code, files, timeout = 10000 } = event.data;
  
  try {
    // Validar parâmetros
    if (typeof code !== 'string') {
      throw new Error('Código deve ser uma string');
    }
    
    if (timeout && (typeof timeout !== 'number' || timeout <= 0)) {
      throw new Error('Timeout deve ser um número positivo');
    }
    
    // Inicializar se necessário
    if (!isInitialized) {
      await initializePyodide();
    }
    
    // Escrever arquivos no sistema de arquivos virtual
    if (files && files.length > 0) {
      await writeFilesToFS(files);
    }
    
    // Executar código Python
    const result = await executePythonCode(code, timeout);
    
    // Enviar resultado
    self.postMessage({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      success: false,
      error: error.message || String(error)
    });
  } finally {
    cleanup();
  }
};

// Listener para erro do worker
self.onerror = function(error) {
  console.error('Worker error:', error);
  cleanup();
};

// Listener para fechar do worker
self.onclose = function() {
  cleanup();
};
