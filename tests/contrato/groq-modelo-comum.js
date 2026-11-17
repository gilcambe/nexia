'use strict';
// Contrato #3797 refeito (17/11/2026): "llama-3.3-70b-versatile" dá 404 no Groq desde 13/11 e ainda está fixo em
// funções que o Worker serve (cloudflare/functions.js). A 1ª tentativa travou: o planejador mandou caminho errado
// (agents/dev_agent.js em vez de netlify/functions/agents/dev_agent.js) e o "pronto" não era teste.
// Regra: quem chama o Groq usa lib/groq-modelo.js — `await modeloGroq(chave)` quando dá para esperar (dentro de função
// async, perto do fetch), ou `RESERVA` (modelo vivo de reserva) em configuração fixa (objeto no topo do arquivo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = function conferir(arquivos) {
  for (const rel of arquivos) {
    const f = path.join(__dirname, '../..', rel);
    test(`${rel}: sem o modelo morto, usando lib/groq-modelo.js, e o arquivo continua válido`, () => {
      const s = fs.readFileSync(f, 'utf8');
      assert.doesNotMatch(s, /llama-3\.3-70b-versatile/, `${rel}: troque o nome fixo "llama-3.3-70b-versatile" (404 no Groq)`);
      assert.match(s, /require\([^)]*groq-modelo['"]\)/, `${rel}: use require('<caminho relativo>/lib/groq-modelo') (modeloGroq ou RESERVA)`);
      const rr = /require\((['"])([^'"]*groq-modelo)\1\)/.exec(s);
      assert.ok(rr && fs.existsSync(path.resolve(path.dirname(f), rr[2] + '.js')), `${rel}: o caminho do require ("${rr && rr[2]}") precisa apontar para lib/groq-modelo.js de verdade`);
      const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${rel}: erro de sintaxe: ${r.stderr}`);
    });
  }
};
