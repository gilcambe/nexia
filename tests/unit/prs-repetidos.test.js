import { decidir, rodar } from '../../scripts/prs-repetidos';

// Mock do @octokit/rest
const octokitMock = {
  pulls: {
    list: jest.fn(),
    update: jest.fn(),
  },
  issues: {
    createComment: jest.fn(),
  },
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => octokitMock),
}));

// Mock da função de issue fechada
const mockIssueFechada = jest.fn();
jest.mock('../../scripts/prs-repetidos', () => ({
  ...jest.requireActual('../../scripts/prs-repetidos'),
  issueFechada: mockIssueFechada,
}));

const AGORA = Date.parse('2026-10-25T18:00:00Z');

const pr = (number, title, createdAt, ciStatus, labels = []) => ({
  number,
  title,
  createdAt,
  ciStatus,
  labels: labels.map(name => ({ name }))
});

describe('decidir: PRs repetidos da mesma issue', () => {
  beforeEach(() => {
    // Resetar mocks
    octokitMock.pulls.list.mockClear();
    octokitMock.pulls.update.mockClear();
    octokitMock.issues.createComment.mockClear();
    mockIssueFechada.mockClear();
  });

  test('PR1. 6 PRs da issue #2248 com rótulos diversos fecha 5 mantendo o mais novo com CI verde', () => {
    const prs = [
      pr(101, 'correção #2248', '2026-10-20T10:00:00Z', 'failure', ['bug', 'urgent']),
      pr(102, 'correção #2248', '2026-10-21T10:00:00Z', 'failure', ['enhancement']),
      pr(103, 'correção #2248', '2026-10-22T10:00:00Z', 'pending', ['documentation']),
      pr(104, 'correção #2248', '2026-10-23T10:00:00Z', 'failure', ['bug']),
      pr(105, 'correção #2248', '2026-10-24T10:00:00Z', 'success', ['stable']), // mais novo + CI verde = mantido
      pr(106, 'correção #2248', '2026-10-19T10:00:00Z', 'success', ['bug', 'stable']), // CI verde mas mais velho
    ];

    const fechar = decidir(prs, AGORA);

    expect(fechar.length).toBe(5);
    const numeros = fechar.map(p => p.number).sort((a, b) => a - b);
    expect(numeros).toEqual([101, 102, 103, 104, 106]);
    expect(fechar.some(p => p.number === 105)).toBe(false);
  });

  test('PR2. PR com CI vermelho >48h entra no fechamento quando há outro PR da mesma issue', () => {
    const haCinquentaHoras = new Date(AGORA - 50 * 60 * 60 * 1000).toISOString();

    const prs = [
      pr(201, 'tarefa #2248', haCinquentaHoras, 'failure'), // CI vermelho >48h
      pr(202, 'tarefa #2248', '2026-10-25T17:00:00Z', 'success'), // mais novo, mantido
    ];

    const fechar = decidir(prs, AGORA);

    expect(fechar.length).toBe(1);
    expect(fechar[0].number).toBe(201);
  });

  test('PR3. PR com CI vermelho >48h e issue fechada entra no fechamento', () => {
    const haCinquentaHoras = new Date(AGORA - 50 * 60 * 60 * 1000).toISOString();

    const prs = [
      pr(301, 'tarefa #2248', haCinquentaHoras, 'failure', ['bug']), // CI vermelho >48h e issue fechada
      pr(302, 'tarefa #2248', '2026-10-25T17:00:00Z', 'success', ['stable']), // mais novo, mantido
    ];

    const fechar = decidir(prs, AGORA);

    expect(fechar.length).toBe(1);
    expect(fechar[0].number).toBe(301);
  });
});

describe('rodar: execução completa com mocks da API GitHub', () => {
  beforeEach(() => {
    // Resetar mocks
    octokitMock.pulls.list.mockClear();
    octokitMock.pulls.update.mockClear();
    octokitMock.issues.createComment.mockClear();
    mockIssueFechada.mockClear();
  });

  test('PR4. rodar: chama fechamentos esperados (update closed + createComment) com data injetada', async () => {
    // Configurar mock da lista de PRs
    octokitMock.pulls.list.mockResolvedValue({
      data: [
        {
          number: 401,
          title: 'correção #2248',
          created_at: '2026-10-20T10:00:00Z',
          mergeable_state: 'failure',
          labels: [{ name: 'bug' }],
        },
        {
          number: 402,
          title: 'correção #2248',
          created_at: '2026-10-24T10:00:00Z',
          mergeable_state: 'success',
          labels: [{ name: 'stable' }],
        },
        {
          number: 403,
          title: 'outra coisa #999',
          created_at: '2026-10-24T10:00:00Z',
          mergeable_state: 'success',
          labels: [{ name: 'enhancement' }],
        },
      ],
    });

    // Configurar mock da issue fechada
    mockIssueFechada.mockResolvedValue({ data: { state: 'closed' } });

    const fechados = await rodar();

    expect(fechados).toBe(1);
    expect(octokitMock.pulls.update).toHaveBeenCalledTimes(1);
    expect(octokitMock.issues.createComment).toHaveBeenCalledTimes(1);

    const upd = octokitMock.pulls.update.mock.calls[0][0];
    expect(upd.state).toBe('closed');
    expect(upd.pull_number).toBe(401);

    const cmt = octokitMock.issues.createComment.mock.calls[0][0];
    expect(cmt.issue_number).toBe(401);
    expect(cmt.body).toContain('fechado automaticamente');
  });
});
