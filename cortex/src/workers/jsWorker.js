// Worker que executa código JavaScript em sandbox isolado.
// Recebe: { code: string, timeout?: number }
// Responde: { stdout: string } ou { error: string }

self.onmessage = function (event) {
  const data = event.data || {};
  const code = data.code;
  const timeoutMs = data.timeout && data.timeout > 0 ? data.timeout : 10000;

  if (typeof code !== 'string' || code.trim() === '') {
    self.postMessage({ error: 'Código não fornecido' });
    return;
  }

  let stdout = '';
  let timer = null;

  // Sandbox: expõe apenas console, sem acesso a window, document, localStorage, etc.
  const sandboxConsole = {
    log: function () {
      const parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += parts.join(' ') + '\n';
    },
    error: function () {
      const parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'ERROR: ' + parts.join(' ') + '\n';
    },
    warn: function () {
      const parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'WARN: ' + parts.join(' ') + '\n';
    },
    info: function () {
      const parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'INFO: ' + parts.join(' ') + '\n';
    },
    debug: function () {
      const parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'DEBUG: ' + parts.join(' ') + '\n';
    },
    assert: function (condition, ...args) {
      if (!condition) {
        const message = args.length > 0 ? args.map(String).join(' ') : 'Assertion failed';
        stdout += 'ASSERTION FAILED: ' + message + '\n';
      }
    }
  };

  // Timer de interrupção (equivalente a worker.terminate() do lado de fora)
  timer = setTimeout(function () {
    self.postMessage({ error: 'Tempo esgotado (timeout de ' + timeoutMs + 'ms)' });
    try { self.close(); } catch (e) { /* ignora */ }
  }, timeoutMs);

  try {
    // Função anônima com o código do usuário; apenas 'console' é injetado
    // O código roda em um ambiente restrito sem acesso a globais
    var fn = new Function('console', '
      "use strict";
      try {
        ' + code + '
      } catch (e) {
        console.error(e.message || String(e));
        throw e;
      }
    ');
    
    fn(sandboxConsole);

    clearTimeout(timer);
    self.postMessage({ stdout: stdout.replace(/\n$/, '') });
  } catch (err) {
    clearTimeout(timer);
    // Captura erros de referência a objetos não permitidos
    let errorMessage = err.message || String(err);
    if (errorMessage.includes('is not defined') || 
        errorMessage.includes('ReferenceError') ||
        errorMessage.includes('window') ||
        errorMessage.includes('document') ||
        errorMessage.includes('localStorage')) {
      errorMessage = 'Acesso não permitido a objeto global: ' + errorMessage;
    }
    self.postMessage({ error: errorMessage });
    try { self.close(); } catch (e) { /* ignora */ }
  }
};
