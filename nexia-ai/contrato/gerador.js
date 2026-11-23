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
//   8. uma 2ª IA confere se o teste cobre o que o pedido exige (opcional; sem resposta, não trava o fluxo);
//   9. (melhoria 22, opção referencia) a solução de REFERÊNCIA da própria IA passa no teste: o teste é possível.
//      Ela só prova isso e é descartada; outra IA implementa sem vê-la.
// Pedido que não dá para testar assim (tela, texto, configuração) volta "nao_testavel" e segue o caminho antigo.
const fs = require('node:fs');
const path = require('node:path');
const { safePath } = require('../orchestrator/edit-blocks');

const PROIBIDO = /^(tests\/|\.github\/|node_modules\/|dist\/|build\/)|(^|\/)\.env|wrangler\.toml$|package(-lock)?\.json$|(^|\/)(deploy|publicar)[^/]*$/i;
// B6 (12/11): fs/path/os liberados para LER o arquivo da solução e gravar só em pasta temporária (mkdtemp).
// 23/11/2026: 'typescript' e 'node:url' liberados: é assim que todo teste do Body Coach lê .ts/.tsx (#4199-#4206 eram recusados).
const MODULOS_OK = new Set(['typescript', 'node:url', 'url', 'node:test', 'node:assert', 'node:assert/strict', 'assert', 'assert/strict', 'node:fs', 'fs', 'node:path', 'path', 'node:os', 'os', 'node:vm', 'vm']); // vm: rodar tela do app num contexto falso (17/11)
const EXT_OK = /\.((c|m)?js|jsx|ts|tsx|html|css|json|md)$/i;
const GRAVA = /\b(writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|rmSync|rmdirSync|unlinkSync|renameSync|copyFileSync|cpSync)\b/;
const ABSOLUTO = /['"`]([A-Za-z]:\\|\/(home|etc|usr|var|tmp|Users|root)\/)/;

const SISTEMA = [
  'Você escreve TESTES DE ACEITAÇÃO para outra IA implementar depois. Você NÃO escreve a solução.',
  'Responda SÓ com um JSON: {"testavel": true|false, "motivo": "...", "arquivos": ["lib/x.js"], "teste": "tests/unit/contrato-x.test.js", "codigo": "conteúdo do teste"}.',
  'Regras do teste: CommonJS; pode usar require("node:test"), require("node:assert/strict"), require("node:fs"), require("node:path"), require("node:os"), require("node:vm") e require("../../<arquivo da solução>");',
  'nada de rede, child_process, process.env, timers, tempo atual ou dados aleatórios; gravar em disco só dentro de fs.mkdtempSync(path.join(os.tmpdir(), ...)); caminhos sempre relativos a __dirname;',
  'no mínimo 3 asserções com valores concretos e corretos; cubra o caso comum, um caso de borda e uma entrada inválida.',
  'Mudar um arquivo existente É testável (o teste falha hoje e passa depois da mudança):',
  '- lógica em arquivo existente: importe a função exportada e verifique o comportamento novo;',
  '- endpoint/rota: importe o handler e chame com um pedido falso (objeto com method, body, headers) e dependências falsas; verifique status e corpo;',
  '- texto, título, link ou configuração em .tsx/.html/.json/.md: leia o arquivo com fs.readFileSync(path.join(__dirname, "../../<arquivo>"), "utf8") e verifique o conteúdo novo e a ausência do antigo.',
  'Com "referencia" pedida: mande também "solucao": {"<arquivo da solução>": "conteúdo COMPLETO do arquivo depois da mudança"}: uma solução simples que PASSA no seu teste. Ela só prova que o teste é possível e é descartada (outra IA implementa sem vê-la).',
  // 17/11/2026: contratos gerados assim pediram gravar score em arquivo do servidor (#3979) e ações inventadas 'soma' (#3980).
  'Kernex Finance (netlify/functions/prumo*, prumo/): servidor = p.agir(uid, { acao, ... }) de netlify/functions/prumo.js com p.deps.db = banco falso; dado da pessoa vive em c.base.collection(...), NUNCA em arquivo. Não peça handler novo, rota de teste nem ação que o pedido não citou.',
  'Tela (prumo/<aba>.js): rode o arquivo num vm com window.MB falso (api, ui) e um elemento falso; chame MB.telas.<aba>(el), clique (chame o onclick) e verifique o MB.api chamado com o corpo certo. Respostas falsas no MESMO formato do servidor. Teste que só procura texto no código NÃO vale para tela.',
  'Não exija posição em lista nem trecho exato de código; verifique comportamento.',
  // 23/11/2026: sem este modelo nenhuma IA conseguia testar lógica em .ts (Body Coach), e o pedido caía no caminho sem teste.
  'Lógica em .ts/.tsx (ex.: apps/body-coach/src/lib/x.ts): NUNCA faça require do .ts. Transpile e importe assim: const ts = require("typescript"); const { pathToFileURL } = require("node:url"); const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c-")); const src = fs.readFileSync(path.join(__dirname, "../../apps/body-coach/src/lib/x.ts"), "utf8"); fs.writeFileSync(path.join(dir, "x.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); const m = await import(pathToFileURL(path.join(dir, "x.mjs")).href); (dentro de test(..., async () => {...})). Se o .ts importa VALOR de outro arquivo do app (ex.: import { idDoNome } from "./fichaCoach"), transpile esse também para a mesma pasta e troque o caminho no texto (ex.: "./fichaCoach" vira "./fichaCoach.mjs"). Import só de tipo (import type) some sozinho.',
  'Use EXATAMENTE os nomes de campo e tipos que o pedido e os arquivos citados usam (ex.: FichaCoach usa dias[].titulo e exercicios[].reps). Não invente campo.',
  'Só responda {"testavel": false, "motivo": "..."} se a mudança depender de serviço externo (painel da Cloudflare, Firebase, Play Store, DNS), de deploy ou de olhar humano (cor, layout).',
].join('\n');

function extrairJson(texto) {
  const t = String(texto || '');
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) || t.match(/(\{[\s\S]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/**
 * 13/11: a IA escrevia um teste bom mas no lugar errado (ex.: tests/painel.test.js) e o portão recusava tudo
 * (6 de 6 recusas da Cloudflare). Agora o nome e os require da solução são ajustados para o padrão
 * tests/unit/contrato-<nome>.test.js; o resto dos portões continua igual.
 */
function ajustarTeste(p) {
  if (!p || typeof p !== 'object') return p;
  const PADRAO = /^tests\/unit\/contrato-[a-z0-9-]+\.test\.js$/;
  const orig = safePath(p.teste) || '';
  if (PADRAO.test(orig)) return p;
  const arquivos = Array.isArray(p.arquivos) ? p.arquivos.map(safePath).filter(Boolean) : [];
  const nomeDe = x => String(x || '').split('/').pop().replace(/\.(test|spec)\.[cm]?[jt]s$/, '').replace(/\.[^.]+$/, '');
  const slug = (nomeDe(orig) || nomeDe(arquivos[0])).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^contrato-/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  if (!slug) return p;
  const pastaOrig = orig.includes('/') ? orig.slice(0, orig.lastIndexOf('/')) : 'tests/unit';
  const posix = require('path').posix;
  const codigo = String(p.codigo || '').replace(/require\(\s*(['"`])(\.{1,2}\/[^'"`]+)\1\s*\)/g, (todo, q, r) => {
    const alvo = posix.normalize(posix.join(pastaOrig, r));
    const achou = arquivos.find(a => a === alvo || a === alvo + '.js');
    return achou ? `require(${q}../../${achou}${q})` : todo;
  });
  return { ...p, teste: `tests/unit/contrato-${slug}.test.js`, codigo, ajustado: orig || '(sem nome)' };
}

/** Portões puros (sem rodar nada). Devolve lista de problemas. */
function conferir(p) {
  const erros = [];
  const teste = safePath(p && p.teste);
  if (!teste || !/^tests\/unit\/contrato-[a-z0-9-]+\.test\.js$/.test(teste)) erros.push('teste deve ficar em tests/unit/contrato-<nome>.test.js');
  const arquivos = Array.isArray(p && p.arquivos) ? p.arquivos.map(safePath) : [];
  if (!arquivos.length || arquivos.length > 4) erros.push('de 1 a 4 arquivos da solução');
  if (arquivos.some(a => !a || PROIBIDO.test(a) || !EXT_OK.test(a))) erros.push('arquivo da solução inválido ou proibido (código/texto fora de tests/, .github/, deploy, package e segredos)');
  const codigo = String((p && p.codigo) || '');
  if (codigo.length < 80 || codigo.length > 20000) erros.push('teste vazio ou grande demais');
  const reqs = [...codigo.matchAll(/require\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
  const daSolucao = r => r.startsWith('../../') && arquivos.some(a => a && (r.slice(6) === a || r.slice(6) + '.js' === a));
  const ruins = reqs.filter(r => !MODULOS_OK.has(r) && !daSolucao(r));
  if (reqs.some(r => /\.tsx?$/.test(r) || arquivos.some(x => /\.tsx?$/.test(x) && r.startsWith('../../') && x.startsWith(r.slice(6))))) erros.push('não faça require de arquivo .ts/.tsx: leia com fs, transpile com require("typescript").transpileModule e importe o .mjs da pasta temporária');
  if (ruins.length) erros.push(`o teste importa o que não pode: ${ruins.join(', ')}`);
  const leSolucao = arquivos.some(a => a && codigo.includes(a));
  if (!reqs.some(daSolucao) && !leSolucao) erros.push('o teste não importa nem lê nenhum arquivo da solução');
  if (GRAVA.test(codigo) && !/mkdtempSync\s*\(/.test(codigo)) erros.push('o teste só pode gravar em pasta temporária (fs.mkdtempSync em os.tmpdir())');
  if (ABSOLUTO.test(codigo)) erros.push('o teste usa caminho absoluto (use path.join(__dirname, ...))');
  if (/\bimport\s|process\.|child_process|globalThis|eval\(|Function\(|fetch\(|setTimeout|setInterval|Math\.random|Date\.now\(\)|new Date\(\)/.test(codigo)) erros.push('o teste usa recurso proibido (processo, rede, tempo atual, aleatório ou eval)');
  const assercoes = (codigo.match(/\bassert\s*\.\s*\w+\s*\(|\bassert\s*\(/g) || []).length;
  if (assercoes < 3) erros.push(`poucas asserções (${assercoes}; mínimo 3)`);
  return { ok: !erros.length, erros, arquivos: arquivos.filter(Boolean), teste, codigo };
}

/**
 * @param {object} o { pedido, raiz, router, modelos, rodarTeste, checarSintaxe?: (arquivo) => boolean, log }
 * @returns {Promise<{ ok, nao_testavel?, motivo?, contrato?, testeArquivo?, testeCodigo?, modelo?, tentativas }>}
 */
/** Motivo curto e sem segredo de uma IA que não respondeu (antes o log só dizia "sem resposta"). */
function motivoCurto(e) {
  const { redactSecrets } = require('../vault/secrets');
  const cod = e && (e.code || e.status) ? `${e.code || e.status}: ` : '';
  return redactSecrets(cod + String((e && e.message) || e)).replace(/\s+/g, ' ').slice(0, 160);
}

// 23/11/2026: pedido com "Arquivos:" mas SEM linha "Teste:" era marcado contrato-invalido e parava (#4145-#4157).
// Regra: só não gera quando JÁ existe uma linha "Teste:" (aí o erro é do contrato e precisa ser corrigido).
// As linhas "Arquivos:" viram dica no pedido; o gerador escolhe os arquivos e escreve o teste.
function precisaGerar(texto, contrato) {
  if (contrato && contrato.ok) return false;
  return !/^\s*(?:[-*]\s*)?\**Teste\**\s*:/im.test(String(texto || ''));
}

async function gerar(o) {
  const log = o.log || (() => {});
  let tentativas = 0, ultimo = '', responderam = 0, semCota = 0;
  const respondentes = new Set();
  for (const m of o.modelos) {
    for (let k = 0; k < 2; k++) {
      tentativas++;
      let out;
      try {
        out = await o.router.chat(m, { system: SISTEMA, messages: [{ role: 'user', content: `PEDIDO:\n${String(o.pedido).slice(0, 6000)}${o.referencia ? '\n\n(referencia pedida: inclua "solucao")' : ''}${ultimo ? `\n\nA TENTATIVA ANTERIOR FOI RECUSADA: ${ultimo}` : ''}` }], maxTokens: o.referencia ? 12000 : 4000 });
      } catch (e) { semCota++; log(`${m.provider}/${m.model}: sem resposta (${motivoCurto(e)})`); break; }
      responderam++;
      respondentes.add(`${m.provider}/${m.model}`);
      const p = ajustarTeste(extrairJson(out && out.text));
      if (p && p.ajustado) log(`${m.provider}/${m.model}: teste movido de ${p.ajustado} para ${p.teste}`);
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
      // Portão 9 (melhoria 22): o teste tem que ser POSSÍVEL. No ZeloMe, 5 testes escritos à mão eram impossíveis ou
      // contraditórios (ex.: exigir 3 letras e testar com 1); um deles gastou 16 tentativas. A referência pega isso antes.
      if (o.referencia) {
        const sol = p.solucao && typeof p.solucao === 'object' ? Object.entries(p.solucao).map(([a, v]) => [safePath(a), v]).filter(([a, v]) => a && c.arquivos.includes(a) && typeof v === 'string') : [];
        if (!sol.length) { fs.unlinkSync(abs); ultimo = 'faltou "solucao": mande a solução de referência (conteúdo completo dos arquivos da solução) que passa no seu teste'; log(`${m.provider}/${m.model}: recusado (sem solução de referência)`); continue; }
        const antes = sol.map(([a]) => { const p2 = path.join(o.raiz, a); return [p2, fs.existsSync(p2) ? fs.readFileSync(p2, 'utf8') : null]; });
        let rr;
        try {
          for (const [a, v] of sol) { const p2 = path.join(o.raiz, a); fs.mkdirSync(path.dirname(p2), { recursive: true }); fs.writeFileSync(p2, v); }
          rr = await o.rodarTeste(cmd);
        } finally {
          for (const [p2, v] of antes) { if (v === null) { if (fs.existsSync(p2)) fs.unlinkSync(p2); } else fs.writeFileSync(p2, v); }
        }
        if (!rr || !rr.ok) {
          fs.unlinkSync(abs);
          ultimo = `a sua solução de referência NÃO passou no seu próprio teste: o teste se contradiz ou pede algo impossível (ou a solução está errada). Corrija. Saída: ${String((rr && rr.saida) || '').slice(-1500)}`;
          log(`${m.provider}/${m.model}: recusado (referência não passa no teste)`);
          continue;
        }
        log(`${m.provider}/${m.model}: solução de referência passou no teste (teste possível)`);
      }
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
  // 23/11/2026 (#4198-#4206): 4 pedidos juntos esgotaram a cota; só 1 IA respondeu, errou, e o pedido caiu no caminho
  // SEM teste, que fez código errado (#4208, #4209). Com menos de 2 IAs ouvidas e outras sem cota, é falta de cota,
  // não pedido ruim: espera a cota e tenta de novo.
  if (semCota && respondentes.size < 2) return { ok: false, sem_cota: true, motivo: `só ${respondentes.size} IA respondeu e ${semCota} estavam sem cota (${ultimo})`, tentativas };
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

module.exports = { precisaGerar, motivoCurto, ajustarTeste, gerar, conferir, extrairJson, revisarCobertura, SISTEMA, REVISOR };
