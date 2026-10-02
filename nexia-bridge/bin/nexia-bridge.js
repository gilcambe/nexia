#!/usr/bin/env node
'use strict';
// NEXIA Bridge — servidor MCP local (Fase 7). Roda no computador do usuário e expõe o
// workspace de cada projeto ao Claude (Claude Code / Claude Desktop) com as proteções
// da spec §8. Só fala por stdio com o cliente MCP: não abre porta nem recebe conexão.
//
//   nexia-bridge serve                  inicia o servidor MCP (stdio)
//   nexia-bridge approve <id> <código>  aprova uma operação pendente
//   nexia-bridge check                  valida a configuração e mostra os projetos
//   nexia-bridge log [n]                últimas n linhas do log (padrão 20)
//
// Configuração: NEXIA_BRIDGE_CONFIG=/caminho/bridge.json (veja bridge.example.json).
const { loadConfig } = require('../lib/config');
const { createLog } = require('../lib/log');
const { createApprovals, approveFromCli } = require('../lib/approvals');
const { createTools } = require('../lib/tools');
const { createMcpServer } = require('../lib/mcp');

function main(argv) {
  const [cmd, ...rest] = argv;
  try {
    const config = loadConfig(process.env.NEXIA_BRIDGE_CONFIG);
    if (cmd === 'serve') {
      const log = createLog(config.stateDir);
      const approvals = createApprovals(config.stateDir);
      createMcpServer({ tools: extra => createTools({ config, log, approvals, ...extra }) });
      process.stderr.write(`[NEXIA Bridge] pronto: ${config.projects.map(p => `${p.name} (${p.mode})`).join(', ')}\n`);
      return;
    }
    if (cmd === 'approve') {
      approveFromCli(config.stateDir, rest[0], rest[1]);
      process.stdout.write(`Aprovado: ${rest[0]}. Peça ao Claude para repetir a operação.\n`);
      return;
    }
    if (cmd === 'check') {
      for (const p of config.projects) process.stdout.write(`${p.project_id}  ${p.name}  ${p.mode}  ${p.roots.join(', ')}\n`);
      process.stdout.write(`stateDir: ${config.stateDir}\n`);
      return;
    }
    if (cmd === 'log') {
      const lines = createLog(config.stateDir).read().slice(-(Number(rest[0]) || 20));
      for (const l of lines) process.stdout.write(`${JSON.stringify(l)}\n`);
      return;
    }
    process.stderr.write('Uso: nexia-bridge serve | approve <id> <código> | check | log [n]\n');
    process.exitCode = 2;
  } catch (e) {
    process.stderr.write(`[NEXIA Bridge] ${e.message}\n`);
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));
