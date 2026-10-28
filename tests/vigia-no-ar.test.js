'use strict';
// Teste unitário: scripts/vigia-no-ar.js
// Valida: 1 falha não dispara rollback nem issue; 2 falhas consecutivas disparam rollback + issue; volta ao normal fecha a issue.

process.env.GITHUB_TOKEN = 'token-teste';
process.env.GITHUB_REPO = 'gilcambe/nexia';

describe('vigia-no-ar', () => {
  let vigia;
  let fetchMock;
  let rollbackMock;
  let criarIssueMock;
  let fecharIssueMock;
  let listarIssuesMock;

  beforeEach(() => {
    jest.resetModules();
    vigia = require('../scripts/vigia-no-ar.js');

    fetchMock = jest.fn();
    rollbackMock = jest.fn().mockResolvedValue({ sucesso: true });
    criarIssueMock = jest.fn().mockResolvedValue({ numero: 1 });
    fecharIssueMock = jest.fn().mockResolvedValue({ fechada: true });
    listarIssuesMock = jest.fn().mockResolvedValue([]);

    vigia.setInjetaveis({
      fetch: fetchMock,
      rollback: rollbackMock,
      abrirIssue: criarIssueMock,
      fecharIssue: fecharIssueMock,
      listarIssues: listarIssuesMock,
    });

    vigia.resetarEstado();
  });

  test('1 falha não dispara rollback nem issue', async () => {
    fetchMock.mockRejectedValueOnce(new Error('falha simulada'));

    const resultado = await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });

    expect(rollbackMock).not.toHaveBeenCalled();
    expect(criarIssueMock).not.toHaveBeenCalled();
    expect(vigia.falhasConsecutivas['produto-falha']).toBe(1);
    expect(resultado.status).toBe('falha');
  });

  test('2 falhas consecutivas disparam rollback e issue', async () => {
    fetchMock.mockRejectedValue(new Error('falha simulada'));

    await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });
    await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });

    expect(rollbackMock).toHaveBeenCalledTimes(1);
    expect(criarIssueMock).toHaveBeenCalledTimes(1);
    expect(criarIssueMock).toHaveBeenCalledWith('cortex-alerta', expect.any(String));
    expect(vigia.falhasConsecutivas['produto-falha']).toBe(2);
  });

  test('quando volta ao normal, issue é fechada e contador zera', async () => {
    // 2 falhas seguidas
    fetchMock.mockRejectedValue(new Error('falha simulada'));
    await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });
    await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });
    expect(criarIssueMock).toHaveBeenCalledTimes(1);
    expect(vigia.falhasConsecutivas['produto-falha']).toBe(2);

    // volta ao normal
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await vigia.verificarSite({
      id: 'produto-falha',
      site: 'https://produto-falha.pages.dev/',
    });

    expect(fecharIssueMock).toHaveBeenCalledTimes(1);
    expect(vigia.falhasConsecutivas['produto-falha']).toBe(0);
  });
});
