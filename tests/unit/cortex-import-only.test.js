'use strict';
// PRs #243/#244: o Cortex abriu PRs que só acrescentavam um import sem uso. Agora o PR não abre.
const test = require('node:test');
const assert = require('node:assert');
const { createGithubAdapter, isImportOnlyDiff } = require('../../nexia-ai/github-adapter');
const { createFakeGithub } = require('../fake-github');

const REPO = { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' };

test('IO1. isImportOnlyDiff reconhece diff só de imports', () => {
  const imp = { deletions: 0, patch: "@@ -1,2 +1,3 @@\n import a from 'a';\n+import { b } from '@/lib/b';\n " };
  assert.strictEqual(isImportOnlyDiff([imp]), true);
  assert.strictEqual(isImportOnlyDiff([imp, { deletions: 0, patch: '+const x = b();' }]), false);
  assert.strictEqual(isImportOnlyDiff([{ deletions: 1, patch: "+import a from 'a';\n-old" }]), false);
  assert.strictEqual(isImportOnlyDiff([{ deletions: 0 }]), false);
  assert.strictEqual(isImportOnlyDiff([]), false);
});

test('IO2. createPull recusa branch que só acrescenta import (nenhum POST /pulls)', async () => {
  const gh = createFakeGithub();
  const a = createGithubAdapter({ repo: REPO, env: gh.env, fetchImpl: gh.fetchImpl });
  await a.createBranch({ branch: 'nexia/so-import' });
  await a.commitFiles({ branch: 'nexia/so-import', message: 'import', files: [{ path: 'src/x.tsx', content: "import { b } from './b';" }] });
  await assert.rejects(a.createPull({ head: 'nexia/so-import', title: 'só import' }), e => e.code === 'IMPORT_ONLY_DIFF');
  assert.ok(!gh.calls.some(c => c.method === 'POST' && /\/pulls$/.test(c.path)));
  await a.commitFiles({ branch: 'nexia/so-import', message: 'usa', files: [{ path: 'src/y.tsx', content: 'export const y = b();' }] });
  const pr = await a.createPull({ head: 'nexia/so-import', title: 'agora usa' });
  assert.ok(pr.number >= 1);
});
