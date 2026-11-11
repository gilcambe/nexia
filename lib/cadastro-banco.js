'use strict';
// Cadastro de clientes SEM PR (11/11/2026, regra dos 20 projetos em 1 hora).
// Ordem: 1) arquivo clientes/*.js (clientes atuais, nada muda); 2) banco: kernex_cadastros/<tipo>__<slug>.
// No banco só o servidor lê/grava (Admin SDK; as regras do Firestore negam o resto por padrão).
// Cache de 60 s por cadastro para não gastar leitura a cada pedido.
const CACHE = new Map();
const TTL_MS = 60 * 1000;
const COLECAO = 'kernex_cadastros';

async function buscarCadastro(tipo, slug, lerArquivo, getDb, agora = Date.now) {
  let doArquivo;
  try { doArquivo = (lerArquivo() || {})[slug]; } catch { doArquivo = undefined; }
  if (doArquivo) return doArquivo;
  if (!/^[a-z0-9-]{2,40}$/.test(String(slug || ''))) return undefined;
  const chave = `${tipo}__${slug}`;
  const c = CACHE.get(chave);
  if (c && agora() - c.em < TTL_MS) return c.valor;
  let valor;
  try {
    const db = getDb();
    if (db) {
      const d = await db.collection(COLECAO).doc(chave).get();
      const x = d && d.exists ? d.data() : null;
      if (x && x.tipo === tipo && x.ativo !== false) {
        valor = { nome: x.nome, versao: Number(x.versao) || 1, codigo_salt: x.codigo_salt, codigo_hash: x.codigo_hash, config: x.config || {}, origem: 'banco' };
      }
    }
  } catch { valor = undefined; }
  CACHE.set(chave, { valor, em: agora() });
  return valor;
}

function limparCache() { CACHE.clear(); }

module.exports = { buscarCadastro, limparCache, COLECAO };
