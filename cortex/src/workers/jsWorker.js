// Worker que executa código JavaScript em sandbox isolado.
// Recebe: { code: string, timeout?: number }
// Responde: { stdout: string } ou { error: string }

self.onmessage = function (event) {
  var data = event.data || {};
  var code = data.code;
  var timeoutMs = data.timeout && data.timeout > 0 ? data.timeout : 10000;

  if (typeof code !== 'string' || code.trim() === '') {
    self.postMessage({ error: 'Código não fornecido' });
    return;
  }

  var stdout = '';
  var timer = null;

  // Sandbox: expõe apenas console, sem acesso a window, document, localStorage, etc.
  var sandboxConsole = {
    log: function () {
      var parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += parts.join(' ') + '\n';
    },
    error: function () {
      var parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'ERROR: ' + parts.join(' ') + '\n';
    },
    warn: function () {
      var parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'WARN: ' + parts.join(' ') + '\n';
    },
    info: function () {
      var parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'INFO: ' + parts.join(' ') + '\n';
    },
    debug: function () {
      var parts = Array.prototype.map.call(arguments, function (a) {
        return String(a);
      });
      stdout += 'DEBUG: ' + parts.join(' ') + '\n';
    },
    assert: function (condition) {
      if (!condition) {
        var message = Array.prototype.slice.call(arguments, 1).map(String).join(' ');
        if (message === '') {
          message = 'Assertion failed';
        }
        stdout += 'ASSERTION FAILED: ' + message + '\n';
      }
    }
  };

  // Timer de interrupção (equivalente a worker.terminate() do lado de fora)
  timer = setTimeout(function () {
    self.postMessage({ error: 'Tempo esgotado (timeout de ' + timeoutMs + 'ms)' });
    try {
      self.close();
    } catch (e) {
      /* ignora */
    }
  }, timeoutMs);

  try {
    // Função anônima com o código do usuário; apenas 'console' é injetado.
    // O código roda em ambiente restrito sem acesso a globais (window, document, localStorage).
    var fn = new Function('console', '\n      "use strict";\n      try {\n        ' + code + '\n      } catch (e) {\n        console.error(e.message || String(e));\n        throw e;\n      }\n    ');

    fn(sandboxConsole);

    clearTimeout(timer);
    self.postMessage({ stdout: stdout.replace(/\n$/, '') });
  } catch (err) {
    clearTimeout(timer);
    // Captura erros de referência a objetos não permitidos
    var errorMessage = err.message || String(err);
    if (errorMessage.indexOf('is not defined') !== -1 ||
        errorMessage.indexOf('ReferenceError') !== -1 ||
        errorMessage.indexOf('window') !== -1 ||
        errorMessage.indexOf('document') !== -1 ||
        errorMessage.indexOf('localStorage') !== -1) {
      errorMessage = 'Acesso não permitido a objeto global: ' + errorMessage;
    }
    self.postMessage({ error: errorMessage });
    try {
      self.close();
    } catch (e) {
      /* ignora */
    }
  }
};
