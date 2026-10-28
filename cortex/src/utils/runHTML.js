const TIMEOUT_MS = 10000;

/**
 * Executa um HTML dentro de um <iframe sandbox="allow-scripts">,
 * captura mensagens postMessage como stdout/erro, aplica timeout de 10s
 * e remove o iframe ao terminar.
 *
 * @param {string} html - Código HTML a ser injetado no iframe.
 * @returns {Promise<{stdout: string, error: string}>}
 */
export default function runHTML(html) {
  return new Promise((resolve) => {
    let stdout = '';
    let error = '';
    let resolved = false;
    let iframe = null;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch (_) {
        // ignora erro na remoção
      }
      try {
        window.removeEventListener('message', handleMessage);
      } catch (_) {
        // ignora erro ao remover listener
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ stdout, error: 'timeout: iframe excedeu 10s' });
    }, TIMEOUT_MS);

    const handleMessage = (event) => {
      try {
        // Verifica se a mensagem vem do iframe atual
        if (event.origin !== window.location.origin && event.origin !== 'null') {
          return;
        }
        
        const data = event.data;
        if (data && typeof data === 'object') {
          if (data.stdout !== undefined) {
            stdout += data.stdout + '\n';
          }
          if (data.error !== undefined) {
            error += data.error + '\n';
          }
          if (data.done) {
            finish({ stdout: stdout.trim(), error: error.trim() });
          }
        } else if (typeof data === 'string') {
          stdout += data + '\n';
        }
      } catch (_) {
        // ignora mensagem inválida
      }
    };

    window.addEventListener('message', handleMessage);

    try {
      iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-scripts';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head><meta charset="utf-8"><title>runHTML</title></head>' +
        '<body>' +
        '<script>' +
        '// Intercepta console.log, console.error, etc e envia para o parent' +
        '(function() {' +
        '  const originalLog = console.log;' +
        '  const originalError = console.error;' +
        '  const originalWarn = console.warn;' +
        '  const originalInfo = console.info;' +
        '  ' +
        '  console.log = function(...args) {' +
        '    originalLog.apply(console, args);' +
        '    window.parent.postMessage({ stdout: Array.isArray(args) ? args.join(" ") : String(args) }, "*");' +
        '  };' +
        '  ' +
        '  console.error = function(...args) {' +
        '    originalError.apply(console, args);' +
        '    window.parent.postMessage({ error: Array.isArray(args) ? args.join(" ") : String(args) }, "*");' +
        '  };' +
        '  ' +
        '  console.warn = function(...args) {' +
        '    originalWarn.apply(console, args);' +
        '    window.parent.postMessage({ stdout: Array.isArray(args) ? args.join(" ") : String(args) }, "*");' +
        '  };' +
        '  ' +
        '  console.info = function(...args) {' +
        '    originalInfo.apply(console, args);' +
        '    window.parent.postMessage({ stdout: Array.isArray(args) ? args.join(" ") : String(args) }, "*");' +
        '  };' +
        '})();' +
        'try {' +
        html +
        '} catch (e) {' +
        '  window.parent.postMessage({ error: e.message }, "*");' +
        '}' +
        '// Sinaliza que terminou' +
        'window.parent.postMessage({ done: true }, "*");' +
        '</script>' +
        '</body>' +
        '</html>'
      );
      doc.close();
    } catch (err) {
      finish({ stdout, error: error || err.message || 'erro ao criar iframe' });
      return;
    }
  });
}
