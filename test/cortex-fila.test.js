const { processPR } = require('../scripts/cortex-fila');
const fs = require('fs');
const { Octokit } = require('@octokit/rest');

jest.mock('fs');
jest.mock('@octokit/rest');

describe('processPR', () => {
  let mockOctokit;
  let mockFs;

  beforeEach(() => {
    mockOctokit = new Octokit();
    mockFs = fs;
    jest.clearAllMocks();
  });

  it('should apply label when PR is merged, files exist, and CI is OK', async () => {
    const pr = { number: 1, merged: true };
    const files = ['file1.js', 'file2.js'];
    const workflowStatus = 'success';

    mockFs.existsSync.mockReturnValue(true);
    mockOctokit.rest.issues.addLabels.mockResolvedValue({});
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    await processPR(pr, files, workflowStatus, mockOctokit, mockFs);

    expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: pr.number,
      labels: ['cortex-feito']
    });
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should reopen issue with comment when PR is merged but some files do not exist', async () => {
    const pr = { number: 1, merged: true };
    const files = ['file1.js', 'file2.js'];
    const workflowStatus = 'success';

    mockFs.existsSync.mockImplementation((file) => file === 'file1.js');
    mockOctokit.rest.issues.update.mockResolvedValue({});
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    await processPR(pr, files, workflowStatus, mockOctokit, mockFs);

    expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: pr.number,
      state: 'open'
    });
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: pr.number,
      body: 'arquivo file2.js não encontrado'
    });
  });

  it('should reopen issue with comment when PR is merged, files exist, but CI failed', async () => {
    const pr = { number: 1, merged: true };
    const files = ['file1.js', 'file2.js'];
    const workflowStatus = 'failure';

    mockFs.existsSync.mockReturnValue(true);
    mockOctokit.rest.issues.update.mockResolvedValue({});
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    await processPR(pr, files, workflowStatus, mockOctokit, mockFs);

    expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: pr.number,
      state: 'open'
    });
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: pr.number,
      body: 'CI falhou'
    });
  });
});
