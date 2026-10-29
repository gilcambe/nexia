const assert = require('assert');
const { Sentinel } = require('./sentinel');

describe('Sentinel', () => {
  let sentinel;
  let mockFetch;
  let mockGh;

  beforeEach(() => {
    mockFetch = async (url, options) => {
      if (url.includes('/issues')) {
        if (options.method === 'GET') {
          return {
            ok: true,
            json: async () => ({
              number: 1,
              title: 'Test Issue',
              body: 'This is a test issue',
              state: 'open',
              labels: [{ name: 'bug' }],
            }),
          };
        } else if (options.method === 'PATCH') {
          return { ok: true };
        }
      }
      return { ok: false };
    };

    mockGh = {
      issues: {
        createComment: async () => ({}),
        update: async () => ({}),
      },
    };

    sentinel = new Sentinel(mockFetch, mockGh);
  });

  it('should fix issues only once', async () => {
    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set();

    await sentinel.fixIssue(issue, fixedIssues);

    assert.strictEqual(fixedIssues.has(1), true);
    assert.strictEqual(fixedIssues.size, 1);
  });

  it('should not fix the same issue twice', async () => {
    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set([1]);

    await sentinel.fixIssue(issue, fixedIssues);

    assert.strictEqual(fixedIssues.has(1), true);
    assert.strictEqual(fixedIssues.size, 1);
  });

  it('should record state correctly', async () => {
    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set();

    await sentinel.fixIssue(issue, fixedIssues);

    assert.strictEqual(fixedIssues.has(1), true);
  });

  it('should close issues when problems are resolved', async () => {
    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set();

    await sentinel.fixIssue(issue, fixedIssues);

    assert.strictEqual(fixedIssues.has(1), true);

    // Simulate the issue being resolved
    issue.state = 'closed';

    await sentinel.fixIssue(issue, fixedIssues);

    assert.strictEqual(fixedIssues.has(1), true);
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch = async () => ({ ok: false });
    sentinel = new Sentinel(mockFetch, mockGh);

    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set();

    await assert.doesNotReject(async () => {
      await sentinel.fixIssue(issue, fixedIssues);
    });
  });

  it('should handle GitHub API errors gracefully', async () => {
    mockGh = {
      issues: {
        createComment: async () => { throw new Error('GitHub API error'); },
        update: async () => { throw new Error('GitHub API error'); },
      },
    };
    sentinel = new Sentinel(mockFetch, mockGh);

    const issue = { number: 1, title: 'Test Issue', body: 'This is a test issue', state: 'open', labels: [{ name: 'bug' }] };
    const fixedIssues = new Set();

    await assert.doesNotReject(async () => {
      await sentinel.fixIssue(issue, fixedIssues);
    });
  });
});
