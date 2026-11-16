'use strict';
// Executor de CONTRATO do Cortex (11/11/2026): uma IA só + verificador automático, no lugar dos 7 agentes.
// Medido no dia: 7 agentes com IAs grátis = 12% de sucesso (IA terminava sem gravar, revisor estourava passos).
// Aqui quem decide é o TESTE, não a IA:
//   1. contrato = arquivos que a IA pode mudar + comando de teste (node --test ...) + pedido;
//   2. o teste precisa FALHAR antes (senão não prova nada) e o arquivo de teste é só-leitura para a IA;
//   3. a IA devolve blocos de edição; o executor aplica só nos arquivos permitidos;
//   4. roda o teste; se falha, devolve o erro exato para a IA e tenta de novo; depois sobe de degrau (outra IA);
//   5. só termina "ok" com o teste passando. Sem teste verde não há entrega.
const fs = require('node:fs');
const path = require('node:path');
const { parseEditBlocks, safePath, FORMAT_HELP } = require('../orchestrator/edit-blocks');
const memoria = require('./memoria');

// Opções aceitas (lista fechada): --test-force-exit, --test-timeout=N, --test-concurrency=N. Nada de shell livre vindo de issue.
const OPCAO_TESTE = /^--test-(?:force-exit|timeout=\d{1,6}|concurrency=\d{1,2})$/;
const TESTE_OK = /^node --test(?: --test-(?:force-exit|timeout=\d{1,6}|concurrency=\d{1,2}))*( [\w@./-]+\.test\.(?:js|cjs|mjs))+$/;

/** Lê o contrato do corpo da issue: "Arquivos: `a`, `b`" e "Teste: `node --test x.test.js`". */
function lerContrato(corpo) {
  const t = String(corpo || '');
  const linha = re => (t.match(re) || [])[1] || '';
  const arquivos = [...linha(/^\s*(?:[-*]\s*)?\**Arquivos\**\s*:\s*(.+)$/im).matchAll(/`([^`]+)`/g)].map(m => safePath(m[1].trim())).filter(Boolean);
  const teste = (linha(/^\s*(?:[-*]\s*)?\**Teste\**\s*:\s*`([^`]+)`/im) || '').trim().replace(/\s+/g, ' ');
  const erros = [];
  if (!arquivos.length) erros.push('faltam os arquivos permitidos (linha "Arquivos: `caminho`")');
  if (arquivos.length > 6) erros.push('no máximo 6 arquivos por contrato (divida a tarefa)');
  if (!TESTE_OK.test(teste)) erros.push('falta o teste de aceitação (linha "Teste: `node --test tests/unit/x.test.js`")');
  const testes = teste.split(' ').slice(2).filter(x => !OPCAO_TESTE.test(x));
  if (testes.some(f => arquivos.includes(f))) erros.push('o arquivo de teste não pode estar entre os arquivos que a IA muda');
  const pedido = t.replace(/^.*\b(?:Arquivos|Teste)\b\s*:.*$/gim, '').trim().slice(0, 6000);
  return { ok: !erros.length, erros, arquivos, teste, testes, pedido };
}

const SISTEMA = [
  'Você é o programador do Cortex KERNEX. Faça a mudança pedida para que o teste de aceitação passe.',
  'Regras: mexa SÓ nos arquivos permitidos; não mexa no teste; responda SÓ com blocos de edição, sem explicação.',
  // 16/11/2026: as IAs grátis "decoravam" as frases do teste (passavam no teste e erravam fora dele).
  'Generalize: o teste pode ler arquivos de dados que você NÃO vê. Escreva a regra geral (radicais, padrões, contexto); nunca código que só reconhece os exemplos do teste.',
  'Para mudar um arquivo existente use blocos SEARCH/REPLACE com trecho EXATO copiado do arquivo. Para criar arquivo novo, mande o arquivo inteiro.',
  'Formato:', FORMAT_HELP,
  'Arquivo inteiro: linha "ARQUIVO: caminho" seguida do conteúdo completo entre ``` ```. Nunca use "..." no lugar de código.',
].join('\n');

// Até este tamanho a IA manda o arquivo inteiro (mais curto e sem erro de cópia exata do SEARCH).
const ARQUIVO_PEQUENO = 8000;

// Referências: arquivos do repo citados no pedido entre crases (ex.: `api/src/app.js`), só leitura.
// Limites para caber nas IAs grátis: até 6 arquivos, 6000 caracteres cada, 16000 no total.
const REF_MAX_ARQ = 6, REF_MAX_CADA = 6000, REF_MAX_TOTAL = 16000;
function referencias(c, raiz) {
  const vistos = new Set([...c.arquivos, ...c.testes]), saida = [];
  let total = 0;
  for (const m of String(c.pedido || '').matchAll(/`([\w@./-]+\.(?:js|cjs|mjs|ts|json|sql|html|css))`/g)) {
    const f = m[1].replace(/^\.\//, '');
    if (vistos.has(f) || f.includes('..') || path.isAbsolute(f) || /(^|\/)\.env|node_modules\//.test(f)) continue;
    vistos.add(f);
    const p = path.join(raiz, f);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
    let txt = fs.readFileSync(p, 'utf8');
    if (txt.length > REF_MAX_CADA) txt = txt.slice(0, REF_MAX_CADA) + '\n/* ... (cortado) */';
    if (total + txt.length > REF_MAX_TOTAL) break;
    total += txt.length;
    saida.push(`--- REFERÊNCIA (só leitura, NÃO altere; use as funções como estão) ${f} ---\n${txt}`);
    if (saida.length >= REF_MAX_ARQ) break;
  }
  return saida;
}

function montarPedido(c, raiz, anterior, exemplos = '') {
  const partes = [`PEDIDO:\n${c.pedido}`, `ARQUIVOS PERMITIDOS: ${c.arquivos.join(', ')}`, `TESTE DE ACEITAÇÃO: ${c.teste}`];
  if (exemplos) partes.push(exemplos);
  for (const f of c.testes) { const p = path.join(raiz, f); if (fs.existsSync(p)) partes.push(`--- TESTE (só leitura) ${f} ---\n${fs.readFileSync(p, 'utf8').slice(0, 12000)}`); }
  partes.push(...referencias(c, raiz));
  for (const f of c.arquivos) {
    const p = path.join(raiz, f);
    const pequeno = fs.existsSync(p) && fs.statSync(p).size <= ARQUIVO_PEQUENO;
    partes.push(!fs.existsSync(p) ? `--- ARQUIVO ${f} --- (não existe: crie o arquivo inteiro)`
      : `--- ARQUIVO ${f} ---${pequeno ? ' (arquivo pequeno: responda com o ARQUIVO INTEIRO novo, sem SEARCH/REPLACE)' : ''}\n${fs.readFileSync(p, 'utf8').slice(0, 20000)}`);
  }
  if (anterior) partes.push(`A TENTATIVA ANTERIOR NÃO PASSOU. Corrija a partir do estado atual dos arquivos acima.\nMOTIVO:\n${anterior.slice(-4000)}`);
  return partes.join('\n\n');
}

// Formatos "quase certos" das IAs grátis (16/11/2026). Só vale para arquivo permitido do contrato.
const CABECALHO = /^\s*(?:[#>*\-\s]*)(?:\*\*)?\s*(?:ARQUIVO|FILE|PATH|CAMINHO)\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s*`?([^`*\s]+)`?\s*$/i;
function resgatarFormato(texto, c) {
  const files = [];
  const linhas = String(texto || '').replace(/\r\n/g, '\n').split('\n');
  const permitido = p => c.arquivos.includes(p);
  // a) cerca cuja 1ª linha é "ARQUIVO: caminho"
  for (let i = 0; i < linhas.length; i++) {
    if (!/^\s*```/.test(linhas[i])) continue;
    const h = CABECALHO.exec(linhas[i + 1] || '');
    let j = i + 2; while (j < linhas.length && !/^\s*```\s*$/.test(linhas[j])) j++;
    if (h && permitido(h[1])) files.push({ path: h[1], content: linhas.slice(i + 2, j).join('\n') + '\n' });
    i = j;
  }
  if (files.length) return files;
  // b) "ARQUIVO: caminho" seguido do código solto (sem cerca) até o próximo ARQUIVO ou o fim
  for (let i = 0; i < linhas.length; i++) {
    const h = CABECALHO.exec(linhas[i]);
    if (!h || !permitido(h[1])) continue;
    let j = i + 1; while (j < linhas.length && !CABECALHO.exec(linhas[j])) j++;
    const corpo = linhas.slice(i + 1, j).filter(l => !/^\s*```\w*\s*$/.test(l)).join('\n').trim();
    if (corpo && !/^<<<<<<< SEARCH/m.test(corpo)) files.push({ path: h[1], content: corpo + '\n' });
    i = j - 1;
  }
  return files;
}

// Melhoria 17: o teste em que 3 ou mais IAs DIFERENTES pararam na última tentativa delas (provável teste que se contradiz).
function testeSuspeito(historico, minimo = 3) {
  const ultima = new Map();
  for (const h of historico) if (h.falham && h.aplicados && h.aplicados.length) ultima.set(h.modelo, h.falham);
  const conta = new Map();
  for (const falham of ultima.values()) for (const n of new Set(falham)) conta.set(n, (conta.get(n) || 0) + 1);
  const [nome, vezes] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return vezes >= minimo ? { nome, ias: vezes } : null;
}

/** Aplica os blocos só nos arquivos permitidos. Devolve { aplicados[], recusas[] }. */
function aplicar(texto, c, raiz) {
  const b = parseEditBlocks(texto);
  if (!b.edits.length && !b.files.length) { const r = resgatarFormato(texto, c); if (r.length) { b.files = r; b.problems = []; } }
  const aplicados = [], recusas = [...b.problems];
  const permitido = p => c.arquivos.includes(p);
  for (const f of b.files) {
    if (!permitido(f.path)) { recusas.push(`${f.path}: fora dos arquivos permitidos`); continue; }
    // IA grátis costuma truncar arquivo grande: trocar um existente (>2 KB) por menos da metade é recusado.
    const atualP = path.join(raiz, f.path);
    const antes = fs.existsSync(atualP) ? fs.statSync(atualP).size : 0;
    if (antes > 2000 && Buffer.byteLength(f.content) < antes / 2) { recusas.push(`${f.path}: arquivo inteiro com menos da metade do atual (provável corte); use blocos SEARCH/REPLACE`); continue; }
    fs.mkdirSync(path.dirname(path.join(raiz, f.path)), { recursive: true });
    fs.writeFileSync(path.join(raiz, f.path), f.content);
    aplicados.push(f.path);
  }
  for (const e of b.edits) {
    if (!permitido(e.path)) { recusas.push(`${e.path}: fora dos arquivos permitidos`); continue; }
    const p = path.join(raiz, e.path);
    if (!fs.existsSync(p)) { recusas.push(`${e.path}: não existe; mande o arquivo inteiro`); continue; }
    const atual = fs.readFileSync(p, 'utf8');
    const n = atual.split(e.find).length - 1;
    if (n !== 1) { recusas.push(`${e.path}: o trecho SEARCH aparece ${n} vez(es); copie um trecho exato e único`); continue; }
    fs.writeFileSync(p, atual.replace(e.find, () => e.replace));
    aplicados.push(e.path);
  }
  return { aplicados: [...new Set(aplicados)], recusas };
}

// Nota de uma tentativa a partir da saída do teste: testes que falharam (node --test) e, se o teste imprimir
// "PONTUACAO: acertos/total", a soma disso. Maior é melhor.
function nota(saida) {
  const s = String(saida || '');
  const falhas = Number((s.match(/(?:ℹ|#) fail (\d+)/) || [])[1] || 0);
  let pontos = 0, total = 0;
  for (const m of s.matchAll(/PONTUACAO: (\d+)\/(\d+)/g)) { pontos += Number(m[1]); total += Number(m[2]); }
  // Sem resumo = o teste nem rodou direito (erro de sintaxe, travou): é a PIOR tentativa, nunca a melhor.
  if (!/(?:ℹ|#) (?:pass|fail) \d/.test(s)) return { falhas: Infinity, pontos: 0, total: 0, valor: -Infinity };
  // O ARQUIVO de teste inteiro falhou ao carregar (erro de sintaxe, módulo faltando): o node --test conta "1 falha",
  // mas é a pior situação possível.
  if (/(?:✖|not ok \d+ -) [^\n]*\.test\.[cm]?js(?: \(|\s*$)/m.test(s) || /^(SyntaxError|ReferenceError|TypeError): /m.test(s) && /\.test\.[cm]?js/.test(s) && !/(?:ℹ|#) pass [1-9]/.test(s)) return { falhas: Infinity, pontos: 0, total: 0, valor: -Infinity };
  return { falhas, pontos, total, valor: pontos - falhas * 1000 };
}
function nomesDosTestes(saida) {
  const s = String(saida || '').split('\n✖ failing tests:')[0];
  const passam = new Set(), falham = new Set();
  for (const l of s.split('\n')) {
    let m = /^\s*✔ (.+?) \(\d[\d.]*ms\)\s*$/.exec(l); if (m) { passam.add(m[1]); continue; }
    m = /^\s*✖ (.+?) \(\d[\d.]*ms\)\s*$/.exec(l); if (m && !/\.test\.[cm]?js$/.test(m[1])) { falham.add(m[1]); continue; }
    m = /^\s*ok \d+ - (.+?)\s*$/.exec(l); if (m) { passam.add(m[1]); continue; }
    m = /^\s*not ok \d+ - (.+?)\s*$/.exec(l); if (m && !/\.test\.[cm]?js$/.test(m[1])) falham.add(m[1]);
  }
  for (const f of falham) passam.delete(f);
  return { passam: [...passam], falham: [...falham] };
}
// FOCO: com vários testes falhando, a IA conserta 2 de cada vez sem quebrar os que já passam.
function foco(saida) {
  const { passam, falham } = nomesDosTestes(saida);
  if (falham.length <= 2) return '';
  return `FOCO DESTA RODADA (um passo de cada vez): faça passar primeiro estes testes: ${falham.slice(0, 2).map(x => '"' + x + '"').join(' e ')}.` +
    (passam.length ? ` NÃO quebre os que já passam: ${passam.map(x => '"' + x + '"').join(', ')}.` : '') + '\n\n';
}

const textoNota = n => n.falhas === Infinity ? 'teste quebrado: nem rodou (erro de sintaxe ou travou)' : n.total ? `${n.pontos}/${n.total} pontos, ${n.falhas} teste(s) falhando` : `${n.falhas} teste(s) falhando`;

function guardar(c, raiz) { return Object.fromEntries(c.arquivos.map(f => { const p = path.join(raiz, f); return [f, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null]; })); }
function restaurar(copia, raiz) {
  for (const [f, v] of Object.entries(copia)) { const p = path.join(raiz, f); if (v === null) { if (fs.existsSync(p)) fs.unlinkSync(p); } else fs.writeFileSync(p, v); }
}

// Melhoria 16: revisor item a item. Devolve até 5 itens do PEDIDO que o código não atende ([] = tudo certo ou sem resposta).
const REVISOR = [
  'Você é o REVISOR de código do Cortex KERNEX. Leia o PEDIDO e o CÓDIGO entregue (que já passa no teste de aceitação).',
  'Confira o pedido ITEM POR ITEM: cada regra, cada caso citado, entrada inválida, variações de escrita (acento, maiúsculas), limites.',
  'Liste SÓ o que o pedido exige e o código NÃO faz ou faz errado. Não invente requisito que não está no pedido. Não comente estilo.',
  'Responda SÓ em JSON: {"faltando": ["item curto e concreto", ...]} — lista vazia se o código atende o pedido inteiro.',
].join('\n');
async function revisarItens(o, c, raiz, autor, escada, log) {
  const outro = escada.find(x => x.provider !== autor.provider) || escada.find(x => x !== autor) || autor;
  const codigo = c.arquivos.map(f => { const p = path.join(raiz, f); return `--- ${f} ---\n${fs.existsSync(p) ? fs.readFileSync(p, 'utf8').slice(0, 12000) : '(não existe)'}`; }).join('\n\n');
  try {
    const out = await o.router.chat(outro, { system: REVISOR, messages: [{ role: 'user', content: `PEDIDO:\n${c.pedido}\n\nCÓDIGO ENTREGUE:\n${codigo}` }], maxTokens: 3000, raciocinioMax: 1500 });
    const txt = String((out && out.text) || '');
    const j = JSON.parse((txt.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const itens = (Array.isArray(j.faltando) ? j.faltando : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 200)).slice(0, 5);
    log(`revisor ${outro.provider}/${outro.model}: ${itens.length ? itens.length + ' item(ns) faltando: ' + itens.join(' | ').slice(0, 200) : 'nada faltando'}`);
    return itens;
  } catch (e) { log(`revisor ${outro.provider}/${outro.model}: sem revisão (${String(e.message || e).slice(0, 100)})`); return []; }
}

/**
 * @param {object} o { contrato, raiz, router, modelos: [{provider,model}], rodarTeste: (cmd) => Promise<{ok, saida}>, porModelo=2, log }
 * @returns {Promise<{ ok, motivo?, modelo?, tentativas, arquivos?, historico }>}
 */
async function executar(o) {
  const c = o.contrato, raiz = o.raiz, log = o.log || (() => {});
  const historico = [];
  if (!c.ok) return { ok: false, motivo: `contrato inválido: ${c.erros.join('; ')}`, tentativas: 0, historico };
  for (const f of c.testes) if (!fs.existsSync(path.join(raiz, f))) return { ok: false, motivo: `o teste ${f} não existe (o contrato traz o teste pronto)`, tentativas: 0, historico };
  const base = await o.rodarTeste(c.teste);
  if (base.ok) return { ok: false, motivo: 'o teste já passa antes da mudança: não prova nada (escreva um teste que falhe sem a mudança)', tentativas: 0, historico };
  const original = guardar(c, raiz);
  // Memória (melhoria 15): caderno de lições no sistema + exemplos aprovados parecidos no pedido. memoria:false desliga.
  const mem = o.memoria === false ? null : (o.memoria || {});
  const lic = mem ? memoria.licoes(mem) : '';
  const sistema = lic ? `${SISTEMA}\n\nLIÇÕES DO CORTEX (aprendidas em tarefas anteriores; siga sempre):\n${lic}` : SISTEMA;
  const exemplosUsados = mem ? memoria.buscarExemplos(c, { ...mem, excluir: o.numero }) : [];
  const exemplos = memoria.textoExemplos(exemplosUsados);
  if (lic || exemplosUsados.length) log(`memória: ${lic ? 'lições' : 'sem lições'}; exemplos ${exemplosUsados.map(e => '#' + e.numero).join(', ') || 'nenhum'}`);
  // Regressão (melhoria 14): nomes dos testes da suíte que já falham antes da mudança.
  const regBase = o.regressao ? await o.regressao() : null;
  const jaFalhavam = new Set(regBase && !regBase.ok ? nomesDosTestes(regBase.completo || regBase.saida).falham : []);
  let tentativas = 0;
  // Frente A (#3377): com placar de cota, quem está sem cota vai para o fim (ou sai, se houver livres).
  const placar = o.placar || null;
  const escada = placar ? placar.ordenar(o.modelos) : o.modelos;
  const semCotaErro = e => { const s = (e && e.details && e.details.status) || 0; return s === 429 || s === 402 || /\b(429|402)\b|rate.?limit|quota|cota/i.test(String((e && e.message) || e)); };
  // 16/11/2026: o próximo degrau parte da MELHOR tentativa até agora (não do zero) e recebe o erro dela.
  let melhor = null;
  // Melhoria 16: versão que já passou no teste, guardada enquanto a revisão pede ajustes.
  let aprovado = null;
  const entregue = mod => ({ ok: true, modelo: `${mod.provider}/${mod.model}`, tentativas, revisado: !!aprovado, arquivos: Object.keys(original).filter(f => { const p = path.join(raiz, f); const v = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; return v !== original[f]; }), historico });
  for (const m of escada) {
    if (aprovado) break;
    if (melhor) restaurar(melhor.estado, raiz); else restaurar(original, raiz);
    let anterior = melhor ? `${foco(melhor.completo || melhor.saida)}${melhor.saida}` : base.saida;
    if (melhor) log(`${m.provider}/${m.model}: parte da melhor tentativa até agora (${textoNota(melhor.nota)})`);
    let limite = o.porModelo || 2, extras = 0, ultimaAssinatura = '';
    for (let k = 0; k < limite; k++) {
      tentativas++;
      let texto = '', parada = '';
      try {
        const out = await o.router.chat(m, { system: sistema, messages: [{ role: 'user', content: montarPedido(c, raiz, anterior, exemplos) }], maxTokens: 16000, raciocinioMax: 2500 });
        texto = (out && out.text) || '';
        parada = (out && out.stop_reason) || '';
        if (placar) placar.sucesso(m);
      } catch (e) {
        const detalhe = `${String(e.message || e)}${e && e.details && e.details.upstream ? ` — ${String(e.details.upstream).replace(/\s+/g, ' ')}` : ''}`.slice(0, 400);
        // 16/11/2026: limite por minuto (Groq) não é falha: espera e repete uma vez, sem contar tentativa.
        if (semCotaErro(e) && !m._esperou && (o.esperar429Ms ?? 45000) > 0) {
          m._esperou = true; tentativas--; k--;
          log(`${m.provider}/${m.model}: limite por minuto (${detalhe.slice(0, 120)}); esperando ${Math.round((o.esperar429Ms ?? 45000) / 1000)} s`);
          await new Promise(r => setTimeout(r, o.esperar429Ms ?? 45000));
          continue;
        }
        if (placar && semCotaErro(e)) placar.marcar(m, 'rate'); historico.push({ modelo: `${m.provider}/${m.model}`, erro: detalhe }); log(`${m.provider}/${m.model}: sem resposta (${detalhe})`); break;
      }
      if (!texto.trim()) { historico.push({ modelo: `${m.provider}/${m.model}`, erro: `resposta vazia (${parada || 'sem motivo'})` }); log(`${m.provider}/${m.model}: resposta vazia, parada=${parada || '?'} (próximo degrau)`); break; }
      // Resposta cortada pelo limite de tamanho: aplicar quebraria o arquivo. Pede de novo, mais enxuto.
      if (/^(length|max_tokens|MAX_TOKENS)$/.test(parada)) {
        anterior = 'Sua resposta anterior foi CORTADA por tamanho e não foi aplicada. Mande o arquivo inteiro de novo, mais enxuto (sem comentários longos e sem explicação fora do código).';
        historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: [], recusas: ['resposta cortada'] });
        log(`${m.provider}/${m.model}: resposta cortada (parada=${parada}, ${texto.length} caracteres); pedindo de novo mais enxuta`);
        continue;
      }
      const ap = aplicar(texto, c, raiz);
      if (!ap.aplicados.length) {
        anterior = `Nenhuma mudança aplicada. ${ap.recusas.join(' | ') || 'Responda só com blocos de edição no formato pedido.'}`;
        historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: [], recusas: ap.recusas });
        log(`${m.provider}/${m.model}: nada aplicado (parada=${parada || '?'}, ${texto.length} caracteres; recusas: ${ap.recusas.join(' | ').slice(0, 200) || 'nenhum bloco reconhecido'}; início: ${JSON.stringify(texto.slice(0, 160))})`);
        continue;
      }
      let t = await o.rodarTeste(c.teste);
      if (t.ok && o.regressao) {
        const rg = await o.regressao();
        const novas = rg.ok ? [] : nomesDosTestes(rg.completo || rg.saida).falham.filter(x => !jaFalhavam.has(x));
        const quebrouCarga = !rg.ok && !novas.length && nota(rg.completo || rg.saida).valor === -Infinity && !(regBase && !regBase.ok);
        if (novas.length || quebrouCarga) {
          log(`${m.provider}/${m.model}: passou no teste do contrato mas QUEBROU ${novas.length || 'a carga de'} outro(s) teste(s): ${novas.slice(0, 2).join(' | ').slice(0, 160)}`);
          t = { ok: false, regressao: true, saida: `O TESTE DO CONTRATO PASSOU, mas a sua mudança QUEBROU outros testes do projeto que passavam antes: ${novas.map(x => '"' + x + '"').join(', ') || '(arquivo de teste não carrega)'}. Mantenha o teste do contrato passando e conserte sem quebrar estes. Exemplo do erro:\n${(rg.saida || '').slice(-3000)}`, completo: t.completo };
        }
      }
      historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: ap.aplicados, recusas: ap.recusas, teste: t.ok, falham: t.ok || t.regressao ? [] : nomesDosTestes(t.completo || t.saida).falham });
      const n = t.regressao ? { falhas: 1, pontos: 0, total: 0, valor: -0.5 } : nota(t.completo || t.saida);
      const melhorou = !t.ok && (!melhor || n.valor > melhor.nota.valor);
      if (melhorou) melhor = { estado: guardar(c, raiz), saida: t.saida, completo: t.completo, nota: n };
      // Está melhorando na última rodada dela: ganha mais uma (até 3 extras por IA).
      if (melhorou && k === limite - 1 && extras < (o.extrasMax ?? 3)) { limite++; extras++; log(`${m.provider}/${m.model}: melhorou a nota; rodada extra ${extras}`); }
      const falhamNomes = t.ok ? [] : nomesDosTestes(t.completo || t.saida).falham;
      log(`${m.provider}/${m.model}: aplicou ${ap.aplicados.join(', ')}; teste ${t.ok ? 'PASSOU' : `falhou (${textoNota(n)}${falhamNomes.length ? `; ex.: ${falhamNomes.slice(0, 2).join(' | ').slice(0, 160)}` : ''})`}`);
      if (t.ok && o.revisor && !aprovado) {
        const faltando = await revisarItens(o, c, raiz, m, escada, log);
        if (faltando.length) {
          aprovado = { estado: guardar(c, raiz), modelo: m };
          anterior = `O TESTE PASSOU, mas o REVISOR conferiu o pedido item por item e achou o que falta: ${faltando.map((x, i) => `${i + 1}) ${x}`).join(' ')}. Corrija ESTES pontos mantendo o teste passando. Se algum ponto não estiver no pedido, ignore-o.`;
          if (k === limite - 1) limite++;
          log(`${m.provider}/${m.model}: revisor achou ${faltando.length} item(ns) faltando; mais uma rodada para corrigir`);
          continue;
        }
      }
      if (t.ok) return entregue(m);
      if (aprovado) { restaurar(aprovado.estado, raiz); log(`${m.provider}/${m.model}: a correção da revisão não passou no teste; fica a versão que já tinha passado`); return entregue(aprovado.modelo); }
      anterior = `${foco(t.completo || t.saida)}${ap.recusas.length ? `Recusas: ${ap.recusas.join(' | ')}\n` : ''}${t.saida}`;
      // Melhoria 15: a mesma IA errou IGUAL duas vezes seguidas (mesma nota e mesmos testes falhando): está presa.
      // Passa para o próximo degrau em vez de gastar mais cota com ela.
      const assinatura = `${n.valor}|${falhamNomes.join('|')}`;
      if (assinatura === ultimaAssinatura && !melhorou) { log(`${m.provider}/${m.model}: mesmo erro 2x seguidas; próximo degrau`); break; }
      ultimaAssinatura = assinatura;
    }
  }
  if (aprovado) { restaurar(aprovado.estado, raiz); return entregue(aprovado.modelo); }
  restaurar(original, raiz);
  // Nenhuma IA respondeu (cota/limite/fora do ar): não é falha da tarefa, é espera (o vigia redispara).
  // 16/11/2026: se a maioria das IAs parou por COTA (dia, minuto, limite de saída), é espera, não fracasso.
  const porCota = h => h.erro && /\b(429|402)\b|quota|cota|rate.?limit|TPD|OTPM|tokens per day|Daily/i.test(h.erro);
  const comErro = historico.filter(h => h.erro);
  const semCota = historico.length > 0 && (historico.every(h => h.erro) || (comErro.length && comErro.filter(porCota).length * 2 >= new Set(historico.map(h => h.modelo)).size));
  return { ok: false, motivo: semCota ? 'nenhuma IA respondeu (sem cota agora)' : 'nenhuma IA fez o teste passar', sem_cota: semCota, tentativas, historico, testeSuspeito: testeSuspeito(historico) };
}

module.exports = { testeSuspeito, lerContrato, executar, aplicar, montarPedido, resgatarFormato, nota, nomesDosTestes, foco, referencias, SISTEMA, TESTE_OK };
