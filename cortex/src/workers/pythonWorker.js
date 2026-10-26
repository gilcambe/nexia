importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;
let timeoutId = null;
let isInitialized = false;

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

// Função para escrever arquivos no sistema de arquivos virtual
async function writeFilesToFS(files) {
  if (!pyodide || !isInitialized) {
    throw new Error('Pyodide not initialized');
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

// Função para executar o código Python
async function executePythonCode(code, timeout = 10000) {
  if (!pyodide || !isInitialized) {
    throw new Error('Pyodide not initialized');
  }
  
  const getStdout = captureStdout();
  const getStderr = captureStderr();
  const getImages = captureMatplotlibImages();
  
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    try {
      // Limpar imagens anteriores
      pyodide.runPython('globals()["_captured_images"] = []');
      
      // Executar código com timeout
      timeoutId = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, timeout);
      
      try {
        pyodide.runPython(code);
        clearTimeout(timeoutId);
        
        const stdout = getStdout();
        const stderr = getStderr();
        const images = getImages();
        
        resolve({
          stdout,
          stderr,
          images,
          error: null
        });
      } catch (pythonError) {
        clearTimeout(timeoutId);
        
        const stdout = getStdout();
        const stderr = getStderr();
        const images = getImages();
        
        resolve({
          stdout,
          stderr,
          images,
          error: pythonError.message || String(pythonError)
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
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
