import runHTML from '../../cortex/src/utils/runHTML.js';

// Mocks isolados para cada teste
let mockParentPostMessage;
let mockConsoleLog;
let mockConsoleError;

beforeEach(() => {
  // Limpa mocks anteriores
  jest.clearAllMocks();
  
  // Mock window.parent.postMessage para cada teste
  mockParentPostMessage = jest.fn();
  Object.defineProperty(window, 'parent', {
    value: {
      postMessage: mockParentPostMessage
    },
    writable: true
  });
  
  // Mock console methods para cada teste
  mockConsoleLog = jest.fn();
  mockConsoleError = jest.fn();
  
  // Salva o console original
  const originalConsole = global.console;
  
  global.console = {
    log: mockConsoleLog,
    error: mockConsoleError,
    warn: jest.fn(),
    info: jest.fn(),
    // Preserva outros métodos do console original
    ...originalConsole
  };
});

afterEach(() => {
  // Restaura o console original
  global.console = Object.getPrototypeOf(global.console);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runHTML', () => {
  test('deve capturar stdout de console.log', async () => {
    const html = '<script>console.log("hi")</script>';
    
    // Simular a mensagem do iframe
    setTimeout(() => {
      mockParentPostMessage.mock.calls[0][0].stdout = 'hi';
      mockParentPostMessage.mock.calls[0][0].done = true;
    }, 10);
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('hi');
    expect(result.error).toBe('');
    expect(mockParentPostMessage).toHaveBeenCalled();
  });
  
  test('deve capturar erro de console.error', async () => {
    const html = '<script>console.error("error message")</script>';
    
    // Simular a mensagem do iframe
    setTimeout(() => {
      mockParentPostMessage.mock.calls[0][0].error = 'error message';
      mockParentPostMessage.mock.calls[0][0].done = true;
    }, 10);
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('');
    expect(result.error).toBe('error message');
  });
  
  test('deve falhar quando fetch tentar acessar URL externa (sandbox sem allow-same-origin)', async () => {
    const html = '<script>fetch("/").catch(err => console.error("fetch error:" + err.message))</script>';
    
    // Simular a mensagem do iframe
    setTimeout(() => {
      mockParentPostMessage.mock.calls[0][0].error = 'fetch error: Failed to fetch';
      mockParentPostMessage.mock.calls[0][0].done = true;
    }, 10);
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('');
    expect(result.error).toContain('fetch error');
  });
  
  test('deve aplicar timeout de 10 segundos', async () => {
    const html = '<script>setTimeout(() => console.log("delayed"), 15000)</script>';
    
    const startTime = Date.now();
    const result = await runHTML(html);
    const endTime = Date.now();
    
    expect(result.error).toBe('timeout: iframe excedeu 10s');
    expect(endTime - startTime).toBeLessThan(11000); // Deve terminar antes de 11s
  });
  
  test('deve injetar HTML corretamente mesmo com tags script', async () => {
    const html = '<script>console.log("hi")</script><div>content</div>';
    
    // Simular múltiplas mensagens
    setTimeout(() => {
      mockParentPostMessage.mock.calls[0][0].stdout = 'hi';
      mockParentPostMessage.mock.calls[1][0].done = true;
    }, 10);
    
    const result = await runHTML(html);
    
    expect(result.stdout).toBe('hi');
    expect(result.error).toBe('');
  });
});
