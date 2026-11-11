'use strict';
// Último degrau com o plano Claude Pro do dono: só com a chave, desligável e com teto diário.
const test = require('node:test');
const assert = require('node:assert/strict');
const { regraClaude } = require('../../nexia-ai/contrato/claude-pro');

test('CP1. sem chave não usa; com chave usa até o teto do dia (padrão 5); dá para desligar', () => {
  assert.equal(regraClaude({}, 0).usar, false);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x' }, 0).usar, true);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x' }, 4).usar, true);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x' }, 5).usar, false);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x', CONTRATO_CLAUDE_DIA: '2' }, 2).usar, false);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x', CONTRATO_CLAUDE_PRO: '0' }, 0).usar, false);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x', CONTRATO_CLAUDE_DIA: '999' }, 49).usar, true);
  assert.equal(regraClaude({ CLAUDE_CODE_OAUTH_TOKEN: 'x', CONTRATO_CLAUDE_DIA: '999' }, 50).usar, false);
});
