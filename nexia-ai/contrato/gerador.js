'use strict';
// Gerador de CONTRATO (11/11/2026): transforma um pedido em linguagem natural em "arquivos + teste de aceitação",
// para o executor de contrato resolver. Gargalo medido: o executor acerta 6/6, mas só pega tarefa que já traz teste.
// Uma IA escreve SÓ o teste (não a solução). Portões antes de o teste valer:
//   1. caminho do teste em tests/unit/contrato-*.test.js (fica no CI para sempre como teste de regressão);
//   2. arquivos da solução: até 4, caminhos seguros, fora de tests/, .github/, scripts de deploy e segredos;
//   3. o teste só pode importar node:test, node:assert e os arquivos da solução (nada de fs, rede, processo, env);
//   4. no mínimo 3 asserções;
//   5. sintaxe válida;
//   6. o teste FALHA no código atual (senão não prova nada);
//   7. a solução mexe em pelo menos 1 arquivo que o produto já tem, ou o pedido nomeia o arquivo novo (entrega não fica solta);
//   8. uma 2ª IA confere se o teste cobre o que o pedido exige (opcional; sem resposta, não trava o fluxo).
// Pedido que não dá para testar assim (tela, texto, configuração) volta "nao_testavel" e segue o caminho antigo.
const fs = require('node:fs');
const path = require('node:path');
const { safePath } = require('../orchestrator/edit-blocks');

const PROIBIDO = /^(tests\/|\.github\/|node_modules\/|dist\/|build\/)|(^|\/)\.env|wrangler\.toml$|package(-lock)?\.json$|(^|\/)(deploy|publicar)[^/]*$/i;
const MODULOS_OK = new Set(['node:test', 'node:assert', 'node:assert/strict', 'assert', 'assert/strict']);

const SISTEMA = [
  'Você escreve TESTES DE ACEITAÇÃO para outra IA implementar depois. Você NÃO escreve a solução.',
  'Responda SÓ com um JSON: {"testavel": true|false, "motivo": "...", "arquivos": ["lib/x.js"], "teste": "tests/unit/contrato-x.test.js", "codigo": "conteúdo do teste"}.',
  'Regras do teste: CommonJS; use só require("node:test"), require("node:assert/strict") e require("../../<arquivo da solução>");',
  'nada de fs, rede, child_process, process.env, timers ou dados aleatórios; no mínimo 3 asserções com valores concretos e corretos;',
  'cubra o caso comum, um caso de borda e uma entrada inválida. Os arquivos da solução são módulos novos ou existentes fora de tests/.',
  'Se o pedido for de tela, texto, configuração, deploy ou algo que não dá para provar com função pura, responda {"testavel": false, "motivo": "..."}.',
].join('\n');

function extrairJson(texto) {
  const t = String(texto || '');
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) || t.match(/(\{[\s\S]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** Portões puros (sem rodar nada). Devolve lista de problemas. */
function conferir(p) {
  const erros = [];
  const teste = safePath(p && p.teste);
  if (!teste || !/^tests\/unit\/contrato-[a-z0-9-]+\.test\.js$/.test(teste)) erros.push('teste deve ficar em tests/unit/contrato-<nome>.test.js');
  const arquivos = Array.isArray(p && p.arquivos) ? p.arquivos.map(safePath) : [];
  if (!arquivos.length || arquivos.length > 4) erros.push('de 1 a 4 arquivos da solução');
  if (arquivos.some(a => !a || PROIBIDO.test(a) || !/\.(c|m)?js$/.test(a))) erros.push('arquivo da solução inválido ou proibido (só .js fora de tests/, .github/, deploy e configuração)');
  const codigo = String((p && p.codigo) || '');
  if (codigo.length < 80 || codigo.length > 20000) erros.push('teste vazio ou grande demais');
  const reqs = [...codigo.matchAll(/require\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
  const daSolucao = r => r.startsWith('../../') && arquivos.some(a => a && (r.slice(6) === a || r.slice(6) + '.js' === a));
  const ruins = reqs.filter(r => !MODULOS_OK.has(r) && !daSolucao(r));
  if (ruins.length) erros.push(`o teste importa o que não pode: ${ruins.join(', ')}`);
  if (!reqs.some(daSolucao)) erros.push('o teste não importa nenhum arquivo da solução');
  if (/\bimport\s|process\.|child_process|globalThis|eval\(|Function\(|fetch\(|setTimeout|setInterval|Math\.random|Date\.now\(\)|new Date\(\)/.test(codigo)) erros.push('o teste usa recurso proibido (processo, rede, tempo atual, aleatório ou eval)');
  const assercoes = (codigo.match(/\bassert\s*\.\s*\w+\s*\(|\bassert\s*\(/g) || []).length;
  if (assercoes < 3) erros.push(`poucas asserções (${assercoes}; mínimo 3)`);
  return { ok: !erros.length, erros, arquivos: arquivos.filter(Boolean), teste, codigo };
}

/**
 * @param {object} o { pedido, raiz, router, modelos, rodarTeste, checarSintaxe?: (arquivo) => boolean, log }
 * @returns {Promise<{ ok, nao_testavel?, motivo?, contrato?, testeArquivo?, testeCodigo?, modelo?, tentativas }>}
 */
async function gerar(o) {
  const log = o.log || (() => {});
  let tentativas = 0, ultimo = '', responderam = 0;
  for (const m of o.modelos) {
    for (let k = 0; k < 2; k++) {
      tentativas++;
      let out;
      try {
        out = await o.router.chat(m, { system: SISTEMA, messages: [{ role: 'user', content: `PEDIDO:\n${String(o.pedido).slice(0, 6000)}${ultimo ? `\n\nA TENTATIVA ANTERIOR FOI RECUSADA: ${ultimo}` : ''}` }], maxTokens: 4000 });
      } catch (e) { log(`${m.provider}/${m.model}: sem resposta`); break; }
      responderam++;
      const p = extrairJson(out && out.text);
      if (!p) { ultimo = 'responda só com o JSON pedido'; continue; }
      if (p.testavel === false) return { ok: false, nao_testavel: true, motivo: String(p.motivo || 'sem motivo').slice(0, 300), tentativas, modelo: `${m.provider}/${m.model}` };
      const c = conferir(p);
      if (!c.ok) { ultimo = c.erros.join('; '); log(`${m.provider}/${m.model}: recusado (${ultimo})`); continue; }
      const pedido = String(o.pedido);
      if (!c.arquivos.some(a => fs.existsSync(path.join(o.raiz, a)) || pedido.includes(a))) {
        ultimo = `a solução precisa mexer em pelo menos 1 arquivo que o produto já usa (nenhum de ${c.arquivos.join(', ')} existe nem é citado no pedido)`;
        log(`${m.provider}/${m.model}: recusado (${ultimo})`);
        continue;
      }
      const abs = path.join(o.raiz, c.teste);
      if (fs.existsSync(abs)) { ultimo = `o teste ${c.teste} já existe; escolha outro nome`; continue; }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, c.codigo);
      if (o.checarSintaxe && !o.checarSintaxe(abs)) { fs.unlinkSync(abs); ultimo = 'o teste tem erro de sintaxe'; continue; }
      const cmd = `node --test ${c.teste}`;
      const r = await o.rodarTeste(cmd);
      if (r.ok) { fs.unlinkSync(abs); ultimo = 'o teste já passa no código atual: ele precisa falhar até a solução existir'; continue; }
      if (o.revisar) {
        const rev = await o.revisar({ pedido, codigo: c.codigo, modelo: m }).catch(() => null);
        if (rev && rev.cobre === false) {
          fs.unlinkSync(abs);
          ultimo = `o teste não cobre o pedido: ${String(rev.falta || 'sem detalhe').slice(0, 300)}`;
          log(`${m.provider}/${m.model}: recusado pelo revisor (${ultimo})`);
          continue;
        }
        if (!rev) log('revisor de cobertura sem resposta: segue sem ele');
      }
      log(`${m.provider}/${m.model}: contrato aceito (${c.arquivos.join(', ')} | ${cmd})`);
      return {
        ok: true, tentativas, modelo: `${m.provider}/${m.model}`, testeArquivo: c.teste, testeCodigo: c.codigo,
        contrato: { ok: true, erros: [], arquivos: c.arquivos, teste: cmd, testes: [c.teste], pedido: String(o.pedido).slice(0, 6000) },
      };
    }
  }
  if (!responderam) return { ok: false, sem_cota: true, motivo: 'nenhuma IA respondeu (sem cota agora)', tentativas };
  return { ok: false, motivo: `nenhuma IA gerou um teste válido (${ultimo})`, tentativas };
}

const REVISOR = [
  'Você confere TESTES DE ACEITAÇÃO. Recebe um PEDIDO e um TESTE. Não escreva código.',
  'O teste cobre o pedido se verifica cada regra concreta que o pedido exige (valores, casos citados, exceções, limites).',
  'Responda SÓ com JSON: {"cobre": true} ou {"cobre": false, "falta": "regra do pedido que o teste não verifica"}.',
].join('\n');

/** Portão 8: uma IA (de preferência outra, não a que escreveu o teste) diz se o teste cobre o pedido. null = sem resposta. */
async function revisarCobertura(router, modelos, pedido, codigo) {
  for (const m of modelos || []) {
    let out;
    try { out = await router.chat(m, { system: REVISOR, messages: [{ role: 'user', content: `PEDIDO:\n${String(pedido).slice(0, 6000)}\n\nTESTE:\n${String(codigo).slice(0, 12000)}` }], maxTokens: 600 }); }
    catch { continue; }
    const j = extrairJson(out && out.text);
    if (j && typeof j.cobre === 'boolean') return j.cobre ? { cobre: true } : { cobre: false, falta: String(j.falta || '') };
  }
  return null;
}

module.exports = { gerar, conferir, extrairJson, revisarCobertura, SISTEMA, REVISOR };
