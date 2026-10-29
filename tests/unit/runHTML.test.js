import runHTML from '../../cortex/src/utils/runHTML.js';

describe('runHTML', () => {
  beforeEach(() => {
    // Limpa qualquer iframe existente antes de cada teste
    const iframes = document.querySelectorAll('iframe[id^="runHTML-"]');
    iframes.forEach(iframe => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    });
  });

  test('deve capturar stdout de console.log e manter iframe invisível', async () => {
    const html = '<script>console.log("hi")</script>';
    
    // Executa o utilitário
    const result = await runHTML(html);
    
    // Verifica o resultado
    expect(result.stdout).toBe('hi');
    expect(result.error).toBe('');
    
    // Verifica que o iframe foi removido do DOM
    const iframes = document.querySelectorAll('iframe[id^="runHTML-"]');
    expect(iframes.length).toBe(0);
  });

  test('deve capturar mensagens de erro do console.error', async () => {
    const html = '<script>console.error("erro de teste")</script>';
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('');
    expect(result.error).toBe('erro de teste');
  });

  test('deve capturar stdout de console.warn e console.info', async () => {
    const html = '<script>console.warn("aviso"); console.info("informação")</script>';
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('aviso\ninformação');
    expect(result.error).toBe('');
  });

  test('fetch deve falhar no sandbox sem allow-same-origin', async () => {
    const html = '<script>try { fetch("/"); } catch (e) { console.error(e.message); }</script>';
    
    const result = await runHTML(html);
    
    // O fetch deve falhar e capturar o erro
    expect(result.stdout).toBe('');
    expect(result.error).toContain('Failed to fetch');
    expect(result.error).toContain('fetch');
  });

  test('deve lidar com múltiplas mensagens', async () => {
    const html = `
      <script>
        console.log("primeira");
        console.log("segunda");
        console.error("erro");
      </script>
    `;
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('primeira\nsegunda');
    expect(result.error).toBe('erro');
  });

  test('deve aplicar timeout após 10 segundos', async () => {
    // Cria um script que nunca termina
    const html = '<script>while(true) {}</script>';
    
    const startTime = Date.now();
    const result = await runHTML(html);
    const endTime = Date.now();
    
    // Verifica que o timeout foi aplicado (aproximadamente 10s)
    const duration = endTime - startTime;
    expect(duration).toBeGreaterThan(9000); // 9 segundos
    expect(duration).toBeLessThan(11000); // 11 segundos
    
    expect(result.stdout).toBe('');
    expect(result.error).toBe('timeout: iframe excedeu 10s');
  });

  test('deve injetar HTML complexo corretamente', async () => {
    const html = `
      <div>conteúdo HTML</div>
      <script>
        console.log("script executado");
        console.error("erro de teste");
      </script>
      <div>mais conteúdo</div>
    `;
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('script executado');
    expect(result.error).toBe('erro de teste');
  });
});