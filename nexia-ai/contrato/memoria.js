'use strict';
// Memória do Cortex (melhoria 15, 16/11/2026). As IAs grátis não lembram de nada entre pedidos; quem lembra é o
// Cortex, que põe no pedido o que aprendeu. Duas camadas (plano "ensinar uma IA", Fase 3):
//   1. PROCEDURAL — licoes.md: regras curtas escritas por quem revisa (Claude/dono), a partir de falhas reais.
//      Vão em TODO pedido. Só pessoas gravam aqui (a IA não grava lição sozinha: evita aprender errado).
//   2. EPISÓDICA — exemplos/<n>.json: cada contrato que passou no teste vira um exemplo (pedido + diff aprovado).
//      Num pedido novo, os 2 exemplos mais parecidos (busca por palavras e por arquivos) entram como modelo.
//      O exemplo vai no próprio PR: se o PR for rejeitado, o exemplo não entra na memória.
// Pasta padrão: ./memoria ao lado deste arquivo (vale no nexia e no .cortex/ do zelome). CORTEX_MEMORIA troca.
const fs = require('node:fs');
const path = require('node:path');

const LICOES_MAX = 7000, EXEMPLO_MAX = 3500, EXEMPLOS_TOTAL = 7000, DIFF_MAX = 6000;
const VAZIAS = new Set(('para pela pelo pelos pelas como quando onde qual quais isso esse essa este esta todo toda todos todas cada '
  + 'deve devem pode podem precisa fazer faça feito arquivo arquivos teste testes pedido criar crie mudar altere adicione '
  + 'função funcao retorna retornar devolve devolver sempre nunca mais menos with that this from return').split(' '));

function pasta(o = {}) { return o.pasta || process.env.CORTEX_MEMORIA || path.join(__dirname, 'memoria'); }
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palavras úteis de um texto (sem acento, minúsculas, >= 4 letras, sem palavras vazias). */
function palavras(texto) {
  const out = new Set();
  for (const m of semAcento(texto).toLowerCase().matchAll(/[a-z_][a-z0-9_]{3,}/g)) if (!VAZIAS.has(m[0])) out.add(m[0]);
  return out;
}

/** Texto do caderno de lições (ou '' se não houver). Cortado em LICOES_MAX. */
function licoes(o = {}) {
  const f = path.join(pasta(o), 'licoes.md');
  if (!fs.existsSync(f)) return '';
  const t = fs.readFileSync(f, 'utf8').trim();
  return t.length > LICOES_MAX ? t.slice(0, LICOES_MAX) + '\n(...)' : t;
}

/**
 * 22/11: livros por assunto (o caderno geral tem limite de LICOES_MAX). Cada arquivo em memoria/livros/<assunto>.md
 * começa com a linha "Quando: palavra, pasta/, arquivo" e só entra no pedido quando o pedido ou os arquivos do
 * contrato citam um desses termos. Livro novo = arquivo novo; não há limite de livros, só de cada um (LICOES_MAX).
 */
function lerLivros(o = {}) {
  const dir = path.join(pasta(o), 'livros');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /^[\w-]+\.md$/.test(n)).sort().map(nome => {
    const bruto = fs.readFileSync(path.join(dir, nome), 'utf8').trim();
    const m = bruto.match(/^Quando:\s*(.+)$/im);
    const termos = m ? m[1].split(',').map(x => semAcento(x).toLowerCase().trim()).filter(Boolean) : [];
    const texto = bruto.replace(/^Quando:.*$/im, '').trim();
    return { nome: nome.replace(/\.md$/, ''), termos, texto };
  });
}

/** Livros cujo assunto aparece no contrato (pedido + arquivos), mais termos casados primeiro; cada um em LICOES_MAX. */
function livros(c, o = {}) {
  const alvo = semAcento(`${(c && c.pedido) || ''} ${((c && c.arquivos) || []).join(' ')}`).toLowerCase();
  return lerLivros(o)
    .map(l => ({ ...l, casou: l.termos.filter(t => alvo.includes(t)).length }))
    .filter(l => l.casou > 0 && l.texto)
    .sort((a, b) => b.casou - a.casou)
    .slice(0, o.maxLivros ?? 2)
    .map(l => ({ nome: l.nome, texto: l.texto.length > LICOES_MAX ? l.texto.slice(0, LICOES_MAX) + '\n(...)' : l.texto }));
}

function lerExemplos(o = {}) {
  const dir = path.join(pasta(o), 'exemplos');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const nome of fs.readdirSync(dir).filter(n => /^[\w-]+\.json$/.test(n)).sort()) {
    try { const e = JSON.parse(fs.readFileSync(path.join(dir, nome), 'utf8')); if (e && e.pedido && e.diff) out.push(e); } catch { /* exemplo estragado: ignora */ }
  }
  return out;
}

/**
 * Os n exemplos mais parecidos com o contrato (busca lexical com peso IDF: palavra rara vale mais que palavra comum).
 * Nota = 10 × (quanto do pedido o exemplo cobre, de 0 a 1) + 4 por arquivo igual + 1 por pasta igual.
 * Exemplo fraco atrapalha a IA: abaixo do mínimo (padrão 3, ou seja ~30% de cobertura) não entra.
 */
function buscarExemplos(c, o = {}) {
  const n = o.n ?? 2;
  // Mesmo conjunto de arquivos em vários exemplos = versões da mesma peça: vale só a MAIS NOVA (a antiga pode ter
  // o defeito que a nova corrigiu).
  const novos = new Map();
  for (const e of lerExemplos(o).filter(x => String(x.numero) !== String(o.excluir))) {
    const k = [...(e.arquivos || [])].sort().join('|'), atual = novos.get(k);
    if (!atual || Number(e.numero) > Number(atual.numero)) novos.set(k, e);
  }
  const todos = [...novos.values()];
  if (!todos.length) return [];
  const docs = todos.map(e => palavras(e.pedido));
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
  const idf = w => Math.log((todos.length + 1) / ((df.get(w) || 0) + 1)) + 0.1;
  const alvo = palavras(c.pedido);
  const totalAlvo = [...alvo].reduce((s, w) => s + idf(w), 0) || 1;
  const pastas = new Set(c.arquivos.map(a => path.posix.dirname(a)));
  const pontos = todos.map((e, i) => {
    let comum = 0;
    for (const w of docs[i]) if (alvo.has(w)) comum += idf(w);
    let p = 10 * comum / totalAlvo;
    for (const a of e.arquivos || []) { if (c.arquivos.includes(a)) p += 4; else if (pastas.has(path.posix.dirname(a))) p += 1; }
    return { e, p };
  }).filter(x => x.p >= (o.minimo ?? 3)).sort((a, b) => b.p - a.p);
  return pontos.slice(0, n).map(x => x.e);
}

/** Bloco de texto com os exemplos para o pedido (respeita EXEMPLO_MAX e EXEMPLOS_TOTAL). */
function textoExemplos(exemplos) {
  const partes = []; let total = 0;
  for (const e of exemplos) {
    const t = `--- EXEMPLO APROVADO (tarefa #${e.numero}, passou no teste e foi revisada) ---\nPEDIDO: ${String(e.pedido).slice(0, 800)}\nARQUIVOS: ${(e.arquivos || []).join(', ')}\nMUDANÇA QUE FUNCIONOU (diff):\n${String(e.diff).slice(0, EXEMPLO_MAX)}`;
    if (total + t.length > EXEMPLOS_TOTAL) break;
    total += t.length; partes.push(t);
  }
  return partes.length ? `EXEMPLOS DE TAREFAS PARECIDAS JÁ RESOLVIDAS (use como modelo de estilo e de solução; NÃO copie se o pedido for diferente):\n\n${partes.join('\n\n')}` : '';
}

/** Grava o exemplo de um contrato que passou. Devolve o caminho do arquivo (para ir no commit) ou null. */
function gravarExemplo({ numero, contrato, modelo, tentativas, diff }, o = {}) {
  if (!numero || !contrato || !diff || !String(diff).trim()) return null;
  // Nunca guarda segredo: diff com cara de chave/senha não vira exemplo.
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|gho|github_pat|xox[abp]|AKIA)[-_A-Za-z0-9]{12,}/.test(diff)) return null;
  const dir = path.join(pasta(o), 'exemplos');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${String(numero).replace(/[^\w-]/g, '')}.json`);
  const e = { numero, data: (o.agora || new Date()).toISOString().slice(0, 10), modelo, tentativas,
    pedido: String(contrato.pedido || '').slice(0, 1500), arquivos: contrato.arquivos, teste: contrato.teste,
    diff: String(diff).length > DIFF_MAX ? String(diff).slice(0, DIFF_MAX) + '\n(... diff cortado)' : String(diff) };
  fs.writeFileSync(f, JSON.stringify(e, null, 2) + '\n');
  return f;
}

module.exports = { pasta, palavras, licoes, lerLivros, livros, lerExemplos, buscarExemplos, textoExemplos, gravarExemplo, LICOES_MAX };
