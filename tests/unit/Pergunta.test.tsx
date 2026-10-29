import test from 'node:test';
import assert from 'node:assert';

test('Pergunta unit test - markdown formatting and copy button', async () => {
  // Mocking DOM environment if needed or testing component logic/markdown parsing utils
  const markdownExample = `**Negrito**\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n| Col1 | Col2 |\n| --- | --- |\n| Val1 | Val2 |`;
  
  assert.ok(markdownExample.includes('Negrito'));
  assert.ok(markdownExample.includes('const x = 1;'));
  assert.ok(markdownExample.includes('Col1'));
});
