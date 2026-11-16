#!/usr/bin/env node
'use strict';
// Semeia a memória EPISÓDICA do Cortex (melhoria 15) com contratos já entregues E JUNTADOS (revisados por pessoa).
// Para cada PR "Contrato #N" juntado: lê o contrato da issue #N e o diff do PR (só os arquivos do contrato) e grava
// nexia-ai/contrato/memoria/exemplos/<N>.json. Precisa do gh logado. Uso:
//   node scripts/cortex-memoria-semear.js <dono/repo> [limite=60]
const { execFileSync } = require('node:child_process');
const { lerContrato } = require('../nexia-ai/contrato/executor');
const memoria = require('../nexia-ai/contrato/memoria');

const [repo, limite = '60'] = process.argv.slice(2);
if (!repo) { console.error('uso: node scripts/cortex-memoria-semear.js <dono/repo> [limite]'); process.exit(2); }
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });

/** Do diff inteiro do PR, só os blocos dos arquivos permitidos do contrato. */
function diffDos(diff, arquivos) {
  return String(diff).split(/^(?=diff --git )/m).filter(b => arquivos.some(a => b.startsWith(`diff --git a/${a} `))).join('');
}

const prs = JSON.parse(gh('pr', 'list', '-R', repo, '--state', 'merged', '--search', 'Contrato in:title', '--limit', String(limite), '--json', 'number,title'));
let gravados = 0;
for (const p of prs) {
  const n = (/^Contrato #(\d+)/.exec(p.title) || [])[1];
  if (!n) continue;
  try {
    const issue = JSON.parse(gh('api', `repos/${repo}/issues/${n}`));
    let c = lerContrato(`${issue.title}\n\n${issue.body || ''}`);
    const diffPr = gh('pr', 'diff', String(p.number), '-R', repo);
    if (!c.ok) {
      // Pedido sem "Arquivos:" (o próprio Cortex gerou o teste): os arquivos saem do PR (código = não-teste).
      const mudados = [...diffPr.matchAll(/^diff --git a\/(\S+) /gm)].map(m => m[1]);
      const testes = mudados.filter(f => /\.test\.[cm]?js$/.test(f)), codigo = mudados.filter(f => !testes.includes(f) && !/memoria\/exemplos\//.test(f));
      if (!codigo.length || !testes.length || codigo.length > 6) { console.log(`#${n}: sem contrato e sem teste no PR, pulando`); continue; }
      c = { ok: true, arquivos: codigo, testes, teste: `node --test ${testes.join(' ')}`, pedido: `${issue.title}\n\n${issue.body || ''}`.slice(0, 6000) };
    }
    const diff = diffDos(diffPr, c.arquivos);
    const f = memoria.gravarExemplo({ numero: n, contrato: c, modelo: `PR #${p.number}`, tentativas: null, diff });
    if (f) { gravados++; console.log(`#${n}: exemplo gravado (${c.arquivos.join(', ')})`); } else console.log(`#${n}: diff vazio ou recusado`);
  } catch (e) { console.log(`#${n}: erro (${String(e.message).slice(0, 120)})`); }
}
console.log(`${gravados} exemplo(s) gravado(s) em ${memoria.pasta()}/exemplos`);
