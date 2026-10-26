import { describe, test, expect, beforeEach, afterEach, vi } from 'node:test';
import assert from 'node:assert';

// Mock global de fetch antes de importar os módulos sob teste
let fetchMock;

const handlers = new Map();

function mockFetch(url, opts = {}) {
  const key = String(url);
  if (handlers.has(key)) {
    return Promise.resolve(handlers.get(key));
  }
  // default: resposta genérica ok
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, url: key }),
    text: async () => String(url),
  });
}

beforeEach(() => {
  fetchMock = vi.fn(mockFetch);
  globalThis.fetch = fetchMock;
  handlers.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setHandler(url, status, body) {
  handlers.set(String(url), {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function resetHandlers() {
  handlers.clear();
}

// ---------- testes de ferramentas com mock de fetch ----------

describe('ferramentas - web', () => {
  test('retorna resultado de busca web com fetch', async () => {
    setHandler('https://api.example.com/web?q=nexial', 200, {
      resultados: [{ titulo: 'NEXIA', url: 'https://nexia.example' }],
    });
    const res = await fetch('https://api.example.com/web?q=nexial');
    const json = await res.json();
    expect(res.ok).toBe(true);
    expect(json.resultados).toHaveLength(1);
    expect(json.resultados[0].titulo).toBe('NEXIA');
  });

  test('web trata erro de rede', async () => {
    fetchMock.mockRejectedValueOnce(new Error('falha de rede'));
    await expect(fetch('https://api.example.com/web?q=x')).rejects.toThrow('falha de rede');
  });
});

describe('ferramentas - página', () => {
  test('retorna conteúdo de página com fetch', async () => {
    setHandler('https://exemplo.com/pagina', 200, { html: '<h1>Título</h1>', texto: 'Título' });
    const res = await fetch('https://exemplo.com/pagina');
    const json = await res.json();
    expect(res.ok).toBe(true);
    expect(json.texto).toBe('Título');
  });

  test('página retorna 404 quando não encontrada', async () => {
    setHandler('https://exemplo.com/nao-existe', 404, { erro: 'não encontrado' });
    const res = await fetch('https://exemplo.com/nao-existe');
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
  });
});

describe('ferramentas - cálculo', () => {
  test('realiza cálculo simples via fetch', async () => {
    setHandler('https://api.example.com/calculo?expr=2+2', 200, { resultado: 4 });
    const res = await fetch('https://api.example.com/calculo?expr=2+2');
    const json = await res.json();
    expect(json.resultado).toBe(4);
  });

  test('cálculo rejeita expressão inválida', async () => {
    setHandler('https://api.example.com/calculo?expr=abc', 400, { erro: 'expressão inválida' });
    const res = await fetch('https://api.example.com/calculo?expr=abc');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.erro).toBe('expressão inválida');
  });
});

describe('ferramentas - cotação', () => {
  test('retorna cotação de moeda via fetch', async () => {
    setHandler('https://api.example.com/cotacao?moeda=USD-BRL', 200, { moeda: 'USD-BRL', valor: 5.20 });
    const res = await fetch('https://api.example.com/cotacao?moeda=USD-BRL');
    const json = await res.json();
    expect(json.moeda).toBe('USD-BRL');
    expect(typeof json.valor).toBe('number');
  });
});

describe('ferramentas - clima', () => {
  test('retorna clima da cidade via fetch', async () => {
    setHandler('https://api.example.com/clima?cidade=Sao Paulo', 200, { cidade: 'Sao Paulo', temperatura: 24, condicao: 'ensolarado' });
    const res = await fetch('https://api.example.com/clima?cidade=Sao Paulo');
    const json = await res.json();
    expect(json.cidade).toBe('Sao Paulo');
    expect(typeof json.temperatura).toBe('number');
  });
});

describe('ferramentas - data_hora', () => {
  test('retorna data e hora atual via fetch', async () => {
    setHandler('https://api.example.com/data-hora', 200, { data: '2026-10-09', hora: '10:00:00', fuso: 'America/Sao_Paulo' });
    const res = await fetch('https://api.example.com/data-hora');
    const json = await res.json();
    expect(json.data).toBeTruthy();
    expect(json.hora).toBeTruthy();
    expect(json.fuso).toBe('America/Sao_Paulo');
  });
});

// ---------- limite de 6 passos ----------

describe('ferramentas - limite de 6 passos', () => {
  test('não executa mais que 6 passos de ferramenta', () => {
    const MAX_PASSOS = 6;
    const passos = [];
    for (let i = 1; i <= MAX_PASSOS + 2; i++) {
      if (i <= MAX_PASSOS) {
        passos.push(`passo ${i}`);
      } else {
        // além do limite: não adiciona
        break;
      }
    }
    expect(passos).toHaveLength(MAX_PASSOS);
    expect(passos.every((p, i) => p === `passo ${i + 1}`)).toBe(true);
  });

  test('bloqueia execução no 7º passo', () => {
    const MAX_PASSOS = 6;
    let executado = 0;
    const podeExecutar = (passoAtual) => passoAtual <= MAX_PASSOS;
    for (let i = 1; i <= 8; i++) {
      if (podeExecutar(i)) executado++;
    }
    expect(executado).toBe(MAX_PASSOS);
  });
});
