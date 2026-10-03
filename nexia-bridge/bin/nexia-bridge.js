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
//   nexia-bridge sync                   envia ao Vault o log ainda não enviado (ADR-F12-04)
//
// Configuração: NEXIA_BRIDGE_CONFIG=/caminho/bridge.json (veja bridge.example.json).
const { loadConfig } = require('../lib/config');
const { createLog } = require('../lib/log');
const { createApprovals, approveFromCli } = require('../lib/approvals');
const { createTools } = require('../lib/tools');
const { createMcpServer } = require('../lib/mcp');
const { createSync } = require('../lib/sync');

const syncFor = (config, log) => config.vault
  ? createSync({ stateDir: config.stateDir, logFile: log.file, url: config.vault.url, token: process.env.NEXIA_BRIDGE_TOKEN })
  : null;

function main(argv) {
  const [cmd, ...rest] = argv;
  try {
    const config = loadConfig(process.env.NEXIA_BRIDGE_CONFIG);
    if (cmd === 'serve') {
      const log = createLog(config.stateDir);
      const approvals = createApprovals(config.stateDir);
      // ADR-F12-04: com vault configurado, envia o log 2 s depois de cada operação (e na partida)
      const sync = syncFor(config, log);
      let timer = null;
      const onLogged = sync ? () => { clearTimeout(timer); timer = setTimeout(() => sync.flush().then(r => { if (r.error) process.stderr.write(`[NEXIA Bridge] envio do log ao Vault falhou (${r.error}); tento de novo depois.\n`); }), 2000); timer.unref(); } : null;
      createMcpServer({ tools: extra => createTools({ config, log, approvals, onLogged, ...extra }) });
      if (onLogged) onLogged();
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
    if (cmd === 'sync') {
      const sync = syncFor(config, createLog(config.stateDir));
      if (!sync) { process.stderr.write('Configure "vault": { "url": ... } no bridge.json e a variável NEXIA_BRIDGE_TOKEN.\n'); process.exitCode = 2; return; }
      sync.flush().then(r => {
        if (r.skipped) { process.stderr.write('NEXIA_BRIDGE_TOKEN ausente ou inválido.\n'); process.exitCode = 2; return; }
        process.stdout.write(`Enviados: ${r.sent}${r.error ? ` (parou: ${r.error})` : ''}\n`);
        if (r.error) process.exitCode = 1;
      });
      return;
    }
    process.stderr.write('Uso: nexia-bridge serve | approve <id> <código> | check | log [n] | sync\n');
    process.exitCode = 2;
  } catch (e) {
    process.stderr.write(`[NEXIA Bridge] ${e.message}\n`);
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));
