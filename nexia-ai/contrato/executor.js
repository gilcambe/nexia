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

const TESTE_OK = /^node --test( [\w@./-]+\.test\.(?:js|cjs|mjs))+$/;   // nada de shell livre vindo de issue

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
  const testes = teste.split(' ').slice(2);
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

function montarPedido(c, raiz, anterior) {
  const partes = [`PEDIDO:\n${c.pedido}`, `ARQUIVOS PERMITIDOS: ${c.arquivos.join(', ')}`, `TESTE DE ACEITAÇÃO: ${c.teste}`];
  for (const f of c.testes) { const p = path.join(raiz, f); if (fs.existsSync(p)) partes.push(`--- TESTE (só leitura) ${f} ---\n${fs.readFileSync(p, 'utf8').slice(0, 12000)}`); }
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
  return { falhas, pontos, total, valor: pontos - falhas * 1000 };
}
const textoNota = n => n.falhas === Infinity ? 'teste quebrado: nem rodou (erro de sintaxe ou travou)' : n.total ? `${n.pontos}/${n.total} pontos, ${n.falhas} teste(s) falhando` : `${n.falhas} teste(s) falhando`;

function guardar(c, raiz) { return Object.fromEntries(c.arquivos.map(f => { const p = path.join(raiz, f); return [f, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null]; })); }
function restaurar(copia, raiz) {
  for (const [f, v] of Object.entries(copia)) { const p = path.join(raiz, f); if (v === null) { if (fs.existsSync(p)) fs.unlinkSync(p); } else fs.writeFileSync(p, v); }
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
  let tentativas = 0;
  // Frente A (#3377): com placar de cota, quem está sem cota vai para o fim (ou sai, se houver livres).
  const placar = o.placar || null;
  const escada = placar ? placar.ordenar(o.modelos) : o.modelos;
  const semCotaErro = e => { const s = (e && e.details && e.details.status) || 0; return s === 429 || s === 402 || /\b(429|402)\b|rate.?limit|quota|cota/i.test(String((e && e.message) || e)); };
  // 16/11/2026: o próximo degrau parte da MELHOR tentativa até agora (não do zero) e recebe o erro dela.
  let melhor = null;
  for (const m of escada) {
    if (melhor) restaurar(melhor.estado, raiz); else restaurar(original, raiz);
    let anterior = melhor ? melhor.saida : base.saida;
    if (melhor) log(`${m.provider}/${m.model}: parte da melhor tentativa até agora (${textoNota(melhor.nota)})`);
    let limite = o.porModelo || 2, extras = 0;
    for (let k = 0; k < limite; k++) {
      tentativas++;
      let texto = '', parada = '';
      try {
        const out = await o.router.chat(m, { system: SISTEMA, messages: [{ role: 'user', content: montarPedido(c, raiz, anterior) }], maxTokens: 16000, raciocinioMax: 2500 });
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
      const ap = aplicar(texto, c, raiz);
      if (!ap.aplicados.length) {
        anterior = `Nenhuma mudança aplicada. ${ap.recusas.join(' | ') || 'Responda só com blocos de edição no formato pedido.'}`;
        historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: [], recusas: ap.recusas });
        log(`${m.provider}/${m.model}: nada aplicado (parada=${parada || '?'}, ${texto.length} caracteres; recusas: ${ap.recusas.join(' | ').slice(0, 200) || 'nenhum bloco reconhecido'}; início: ${JSON.stringify(texto.slice(0, 160))})`);
        continue;
      }
      const t = await o.rodarTeste(c.teste);
      historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: ap.aplicados, recusas: ap.recusas, teste: t.ok });
      const n = nota(t.completo || t.saida);
      const melhorou = !t.ok && (!melhor || n.valor > melhor.nota.valor);
      if (melhorou) melhor = { estado: guardar(c, raiz), saida: t.saida, nota: n };
      // Está melhorando na última rodada dela: ganha mais uma (até 3 extras por IA).
      if (melhorou && k === limite - 1 && extras < (o.extrasMax ?? 3)) { limite++; extras++; log(`${m.provider}/${m.model}: melhorou a nota; rodada extra ${extras}`); }
      log(`${m.provider}/${m.model}: aplicou ${ap.aplicados.join(', ')}; teste ${t.ok ? 'PASSOU' : `falhou (${textoNota(n)})`}`);
      if (t.ok) return { ok: true, modelo: `${m.provider}/${m.model}`, tentativas, arquivos: Object.keys(original).filter(f => { const p = path.join(raiz, f); const v = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; return v !== original[f]; }), historico };
      anterior = `${ap.recusas.length ? `Recusas: ${ap.recusas.join(' | ')}\n` : ''}${t.saida}`;
    }
  }
  restaurar(original, raiz);
  // Nenhuma IA respondeu (cota/limite/fora do ar): não é falha da tarefa, é espera (o vigia redispara).
  const semCota = historico.length > 0 && historico.every(h => h.erro);
  return { ok: false, motivo: semCota ? 'nenhuma IA respondeu (sem cota agora)' : 'nenhuma IA fez o teste passar', sem_cota: semCota, tentativas, historico };
}

module.exports = { lerContrato, executar, aplicar, montarPedido, resgatarFormato, nota, SISTEMA, TESTE_OK };
