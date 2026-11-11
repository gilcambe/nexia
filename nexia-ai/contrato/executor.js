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
  'Para mudar um arquivo existente use blocos SEARCH/REPLACE com trecho EXATO copiado do arquivo. Para criar arquivo novo, mande o arquivo inteiro.',
  'Formato:', FORMAT_HELP,
  'Arquivo inteiro: linha "ARQUIVO: caminho" seguida do conteúdo completo entre ``` ```. Nunca use "..." no lugar de código.',
].join('\n');

function montarPedido(c, raiz, anterior) {
  const partes = [`PEDIDO:\n${c.pedido}`, `ARQUIVOS PERMITIDOS: ${c.arquivos.join(', ')}`, `TESTE DE ACEITAÇÃO: ${c.teste}`];
  for (const f of c.testes) { const p = path.join(raiz, f); if (fs.existsSync(p)) partes.push(`--- TESTE (só leitura) ${f} ---\n${fs.readFileSync(p, 'utf8').slice(0, 12000)}`); }
  for (const f of c.arquivos) {
    const p = path.join(raiz, f);
    partes.push(fs.existsSync(p) ? `--- ARQUIVO ${f} ---\n${fs.readFileSync(p, 'utf8').slice(0, 20000)}` : `--- ARQUIVO ${f} --- (não existe: crie o arquivo inteiro)`);
  }
  if (anterior) partes.push(`A TENTATIVA ANTERIOR NÃO PASSOU. Corrija a partir do estado atual dos arquivos acima.\nMOTIVO:\n${anterior.slice(-4000)}`);
  return partes.join('\n\n');
}

/** Aplica os blocos só nos arquivos permitidos. Devolve { aplicados[], recusas[] }. */
function aplicar(texto, c, raiz) {
  const b = parseEditBlocks(texto);
  const aplicados = [], recusas = [...b.problems];
  const permitido = p => c.arquivos.includes(p);
  for (const f of b.files) {
    if (!permitido(f.path)) { recusas.push(`${f.path}: fora dos arquivos permitidos`); continue; }
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
  for (const m of o.modelos) {
    restaurar(original, raiz);              // cada degrau começa do zero
    let anterior = base.saida;
    for (let k = 0; k < (o.porModelo || 2); k++) {
      tentativas++;
      let texto = '';
      try {
        const out = await o.router.chat(m, { system: SISTEMA, messages: [{ role: 'user', content: montarPedido(c, raiz, anterior) }], maxTokens: 8000 });
        texto = (out && out.text) || '';
      } catch (e) { historico.push({ modelo: `${m.provider}/${m.model}`, erro: String(e.message || e).slice(0, 200) }); log(`${m.provider}/${m.model}: sem resposta (${String(e.message || e).slice(0, 80)})`); break; }
      const ap = aplicar(texto, c, raiz);
      if (!ap.aplicados.length) {
        anterior = `Nenhuma mudança aplicada. ${ap.recusas.join(' | ') || 'Responda só com blocos de edição no formato pedido.'}`;
        historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: [], recusas: ap.recusas });
        log(`${m.provider}/${m.model}: nada aplicado`);
        continue;
      }
      const t = await o.rodarTeste(c.teste);
      historico.push({ modelo: `${m.provider}/${m.model}`, aplicados: ap.aplicados, recusas: ap.recusas, teste: t.ok });
      log(`${m.provider}/${m.model}: aplicou ${ap.aplicados.join(', ')}; teste ${t.ok ? 'PASSOU' : 'falhou'}`);
      if (t.ok) return { ok: true, modelo: `${m.provider}/${m.model}`, tentativas, arquivos: Object.keys(original).filter(f => { const p = path.join(raiz, f); const v = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; return v !== original[f]; }), historico };
      anterior = `${ap.recusas.length ? `Recusas: ${ap.recusas.join(' | ')}\n` : ''}${t.saida}`;
    }
  }
  restaurar(original, raiz);
  // Nenhuma IA respondeu (cota/limite/fora do ar): não é falha da tarefa, é espera (o vigia redispara).
  const semCota = historico.length > 0 && historico.every(h => h.erro);
  return { ok: false, motivo: semCota ? 'nenhuma IA respondeu (sem cota agora)' : 'nenhuma IA fez o teste passar', sem_cota: semCota, tentativas, historico };
}

module.exports = { lerContrato, executar, aplicar, montarPedido, SISTEMA, TESTE_OK };
