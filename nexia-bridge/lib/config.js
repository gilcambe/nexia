'use strict';
// Configuração do Bridge (arquivo JSON local, apontado por NEXIA_BRIDGE_CONFIG).
// {
//   "stateDir": "C:/Users/gil/.nexia-bridge",          // log e aprovações (fora dos workspaces)
//   "projects": [{
//     "project_id": "prj_…",                            // id do projeto no Vault
//     "name": "NEXIA OS",
//     "roots": ["D:/Projetos/nexia"],                   // raízes autorizadas
//     "mode": "write-confirm",                          // read-only | write-confirm | autonomous
//     "commands": { "allow": [], "deny": [] },          // listas extras por executável
//     "passEnv": []                                     // variáveis com cara de secret liberadas aos comandos
//   }]
// }
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BridgeError } = require('./errors');
const { isInside } = require('./paths');

const MODES = ['read-only', 'write-confirm', 'autonomous'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function loadConfig(file) {
  if (!file) throw new BridgeError('CONFIG', 'Defina NEXIA_BRIDGE_CONFIG com o caminho do arquivo de configuração.');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new BridgeError('CONFIG', `Configuração ilegível: ${e.code || 'JSON inválido'}.`); }
  return validateConfig(raw);
}

function validateConfig(raw) {
  const problems = [];
  if (!raw || !Array.isArray(raw.projects) || !raw.projects.length) problems.push('projects: informe ao menos um projeto');
  const projects = (raw && raw.projects || []).map((p, i) => {
    const at = `projects[${i}]`;
    if (!ID_RE.test(String(p.project_id || ''))) problems.push(`${at}.project_id inválido`);
    if (!MODES.includes(p.mode || 'read-only')) problems.push(`${at}.mode deve ser ${MODES.join(' | ')}`);
    const roots = Array.isArray(p.roots) ? p.roots : [];
    if (!roots.length) problems.push(`${at}.roots: informe ao menos uma raiz`);
    for (const r of roots) {
      if (typeof r !== 'string' || !path.isAbsolute(r)) { problems.push(`${at}.roots: "${r}" não é absoluto`); continue; }
      if (path.parse(path.resolve(r)).root === path.resolve(r)) problems.push(`${at}.roots: a raiz do disco (${r}) não pode ser um workspace`);
      if (path.resolve(r) === os.homedir() || isInside(path.resolve(r), os.homedir())) problems.push(`${at}.roots: "${r}" contém a pasta do usuário inteira`);
      if (!fs.existsSync(r)) problems.push(`${at}.roots: "${r}" não existe`);
    }
    return {
      project_id: String(p.project_id || ''), name: String(p.name || p.project_id || ''), roots,
      mode: p.mode || 'read-only',
      commands: { allow: (p.commands && p.commands.allow) || [], deny: (p.commands && p.commands.deny) || [] },
      passEnv: Array.isArray(p.passEnv) ? p.passEnv.map(String) : [],
    };
  });
  const ids = projects.map(p => p.project_id);
  if (new Set(ids).size !== ids.length) problems.push('project_id repetido');
  if (problems.length) throw new BridgeError('CONFIG', `Configuração inválida: ${problems.join('; ')}.`, { problems });
  const stateDir = path.resolve(raw.stateDir || path.join(os.homedir(), '.nexia-bridge'));
  for (const p of projects) {
    if (p.roots.some(r => isInside(path.resolve(r), stateDir))) {
      throw new BridgeError('CONFIG', 'stateDir (log e aprovações) não pode ficar dentro de um workspace.');
    }
  }
  return { stateDir, projects };
}

module.exports = { loadConfig, validateConfig, MODES };
