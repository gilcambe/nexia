/**
 * Executes HTML in a sandboxed iframe and captures console output.
 * @param {string} html - The HTML content to be executed.
 * @returns {Promise<{stdout: string, stderr: string}>} - A promise that resolves with the captured output.
 */
export async function runHTML(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';

    let stdout = '';
    let stderr = '';

    const handleMessage = (event) => {
      if (event.data.type === 'console') {
        if (event.data.level === 'log') {
          stdout += event.data.message + '\n';
        } else if (event.data.level === 'error') {
          stderr += event.data.message + '\n';
        }
      }
    };

    window.addEventListener('message', handleMessage);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      document.body.removeChild(iframe);
      resolve({ stdout, stderr });
    };

    const timeout = setTimeout(cleanup, 10000);

    iframe.onload = () => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <script>
              const originalConsole = console;
              console = {
                log: (...args) => {
                  window.parent.postMessage({ type: 'console', level: 'log', message: args.join(' ') }, '*');
                  originalConsole.log(...args);
                },
                error: (...args) => {
                  window.parent.postMessage({ type: 'console', level: 'error', message: args.join(' ') }, '*');
                  originalConsole.error(...args);
                }
              };
            </script>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      doc.close();
    };

    document.body.appendChild(iframe);
  });
}
