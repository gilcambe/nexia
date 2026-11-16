#!/usr/bin/env node
'use strict';
// Régua do Cortex (melhoria 15, 16/11/2026; plano "ensinar uma IA", Fase 0): um conjunto FIXO de tarefas, medido
// sempre do mesmo jeito, para saber se cada mudança no Cortex melhora ou piora.
// Cada tarefa (nexia-ai/contrato/regua/tarefas/<id>/) tem: pedido.md (contrato), os arquivos iniciais, o teste
// VISÍVEL (o que a IA vê) e o teste OCULTO (oculto/, só roda depois; mede se a IA generalizou ou pegou atalho).
// Uso:
//   node scripts/cortex-regua.js --modelos kilo:auto:1,kilo:auto:2 [--sem-memoria] [--tarefas a,b] [--por-modelo 2] [--saida r.json]
//   node scripts/cortex-regua.js --solucao <pasta>   (confere que cada tarefa TEM solução: visível falha sem ela; visível e oculto passam com ela)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { lerContrato, executar, nota } = require('../nexia-ai/contrato/executor');

const arg = (n, padrao) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? padrao : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
// --pasta: outra pasta de tarefas (ex.: uma régua SECRETA fora do repositório, que nunca serviu para ajustar o Cortex).
const PASTA = path.resolve(String(arg('pasta', '') || path.join(__dirname, '..', 'nexia-ai', 'contrato', 'regua', 'tarefas')));

function copiar(de, para, pular = new Set()) {
  fs.mkdirSync(para, { recursive: true });
  for (const n of fs.readdirSync(de)) {
    if (pular.has(n)) continue;
    const a = path.join(de, n), b = path.join(para, n);
    if (fs.statSync(a).isDirectory()) copiar(a, b); else fs.copyFileSync(a, b);
  }
}
function rodar(cmd, cwd) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  try { const s = execFileSync(process.execPath, cmd.split(' ').slice(1), { cwd, stdio: 'pipe', timeout: 120000, env, encoding: 'utf8' }); return { ok: true, saida: s.slice(-6000), completo: s }; }
  catch (e) { const s = String(e.stdout || '') + String(e.stderr || ''); return { ok: false, saida: s.slice(-6000), completo: s }; }
}
const resumo = s => { const p = (String(s).match(/ℹ pass (\d+)/) || [])[1] || '0', f = (String(s).match(/ℹ fail (\d+)/) || [])[1] || '?'; return `${p}/${Number(p) + Number(f)}`; };

function tarefas() {
  const so = arg('tarefas', '');
  return fs.readdirSync(PASTA).filter(n => fs.existsSync(path.join(PASTA, n, 'pedido.md'))).filter(n => !so || String(so).split(',').includes(n)).sort();
}
function preparar(id) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `regua-${id}-`));
  copiar(path.join(PASTA, id), tmp, new Set(['oculto', 'pedido.md']));
  return { tmp, c: lerContrato(fs.readFileSync(path.join(PASTA, id, 'pedido.md'), 'utf8')) };
}
function oculto(id, tmp) {
  copiar(path.join(PASTA, id, 'oculto'), path.join(tmp, 'oculto'));
  const testes = fs.readdirSync(path.join(tmp, 'oculto')).filter(n => n.endsWith('.test.js')).map(n => `oculto/${n}`);
  return rodar(`node --test ${testes.join(' ')}`, tmp);
}

async function conferirSolucao(dir) {
  let ruim = 0;
  for (const id of tarefas()) {
    const { tmp, c } = preparar(id);
    const antes = rodar(c.teste, tmp);
    for (const n of fs.existsSync(path.join(dir, id)) ? fs.readdirSync(path.join(dir, id)) : []) {
      const dest = path.join(tmp, n.split('__').join('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(dir, id, n), dest);
    }
    const vis = rodar(c.teste, tmp), oc = oculto(id, tmp);
    const ok = c.ok && !antes.ok && vis.ok && oc.ok;
    if (!ok) ruim++;
    console.log(`${ok ? 'OK ' : 'RUIM'} ${id}: contrato ${c.ok ? 'válido' : c.erros.join('; ')} | sem solução o visível ${antes.ok ? 'PASSA (não prova nada)' : 'falha'} | com solução: visível ${resumo(vis.completo)}, oculto ${resumo(oc.completo)}`);
    if (!oc.ok) console.log(oc.saida.slice(-1500));
  }
  process.exitCode = ruim ? 1 : 0;
}

async function medir() {
  const lista = String(arg('modelos', '') || '').split(',').filter(Boolean).map(s => { const i = s.indexOf(':'); return { provider: s.slice(0, i), model: s.slice(i + 1) }; });
  if (!lista.length) { console.error('informe --modelos provedor:modelo,...'); process.exit(2); }
  const { getRouter } = require('../nexia-ai/model-router');
  const router = getRouter();
  const comMemoria = !arg('sem-memoria', false);
  const linhas = [];
  for (const id of tarefas()) {
    const { tmp, c } = preparar(id);
    const t0 = Date.now();
    const r = await executar({ contrato: c, raiz: tmp, router, modelos: lista.map(m => ({ ...m })), porModelo: Number(arg('por-modelo', 2)), esperar429Ms: 20000,
      memoria: comMemoria ? {} : false, revisor: !!arg('revisor', false), rodarTeste: cmd => Promise.resolve(rodar(cmd, tmp)), log: s => console.log(`  [${id}] ${s}`) });
    const oc = r.ok ? oculto(id, tmp) : null;
    const l = { tarefa: id, contrato: r.ok, oculto: oc ? resumo(oc.completo) : '-', ocultoOk: !!(oc && oc.ok), notaOculto: oc ? nota(oc.completo).falhas : null,
      modelo: r.modelo || '-', tentativas: r.tentativas, segundos: Math.round((Date.now() - t0) / 1000), motivo: r.ok ? '' : r.motivo };
    linhas.push(l);
    console.log(`${id}: contrato ${l.contrato ? 'PASSOU' : 'falhou'} | oculto ${l.oculto} | ${l.modelo} | ${l.tentativas} tent. | ${l.segundos} s`);
  }
  const total = linhas.length, cont = linhas.filter(l => l.contrato).length, gen = linhas.filter(l => l.ocultoOk).length;
  console.log(`\nRÉGUA (${comMemoria ? 'COM' : 'SEM'} memória; ${lista.map(m => `${m.provider}:${m.model}`).join(', ')}): contrato ${cont}/${total}, oculto completo ${gen}/${total}, tentativas ${linhas.reduce((a, l) => a + l.tentativas, 0)}`);
  const saida = arg('saida', '');
  if (saida) fs.writeFileSync(saida, JSON.stringify({ data: new Date().toISOString(), memoria: comMemoria, modelos: lista, linhas }, null, 1));
}

(arg('solucao', '') ? conferirSolucao(arg('solucao')) : medir()).catch(e => { console.error(e); process.exitCode = 1; });
