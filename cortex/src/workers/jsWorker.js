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

  // Sandbox: expõe apenas console, sem window/document/localStorage
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
    }
  };

  // Timer de interrupção (equivalente a worker.terminate() do lado de fora)
  timer = setTimeout(function () {
    self.postMessage({ error: 'Tempo esgotado (timeout de ' + timeoutMs + 'ms)' });
    try { self.close(); } catch (e) { /* ignora */ }
  }, timeoutMs);

  try {
    // Função anônima com o código do usuário; apenas 'console' é injetado
    var fn = new Function('console', code);
    fn(sandboxConsole);

    clearTimeout(timer);
    self.postMessage({ stdout: stdout.replace(/\n$/, '') });
  } catch (err) {
    clearTimeout(timer);
    self.postMessage({ error: err.message || String(err) });
    try { self.close(); } catch (e) { /* ignora */ }
  }
};
