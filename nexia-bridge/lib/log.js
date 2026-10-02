'use strict';
// Registro local de cada operação (spec §8: "Registrar comando, diretório, resultado e
// agente"). JSON Lines em <stateDir>/bridge-log.jsonl. Nunca guarda conteúdo de arquivo
// nem saída de comando: só metadados (e o comando já redigido).
const fs = require('fs');
const path = require('path');

function createLog(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const file = path.join(stateDir, 'bridge-log.jsonl');
  return {
    file,
    write(entry) {
      const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
      fs.appendFileSync(file, line + '\n', { mode: 0o600 });
    },
    read() {
      if (!fs.existsSync(file)) return [];
      return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    },
  };
}

module.exports = { createLog };
