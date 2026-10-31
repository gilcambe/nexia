import { d1 } from '../db/d1';

export async function criarConversa(uid: string, data: { titulo?: string, descricao?: string }) {
  const { results } = await d1.prepare(`
    INSERT INTO conversas (uid, titulo, descricao, criado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    RETURNING id, uid, titulo, descricao, criado_em
  `).bind(uid, data.titulo || null, data.descricao || null).all();

  return results[0];
}

export async function obterConversas(uid: string) {
  const { results } = await d1.prepare(`
    SELECT id, uid, titulo, descricao, criado_em
    FROM conversas
    WHERE uid = ?
    ORDER BY criado_em DESC
  `).bind(uid).all();

  return results;
}

export async function salvarMensagem(uid: string, conversaId: string, mensagem: { texto: string, remetente: string }) {
  const { results } = await d1.prepare(`
    INSERT INTO mensagens (uid, conversa_id, texto, remetente, criado_em)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    RETURNING id, uid, conversa_id, texto, remetente, criado_em
  `).bind(uid, conversaId, mensagem.texto, mensagem.remetente).all();

  return results[0];
}

export async function obterMensagens(uid: string, conversaId: string) {
  const { results } = await d1.prepare(`
    SELECT id, uid, conversa_id, texto, remetente, criado_em
    FROM mensagens
    WHERE uid = ? AND conversa_id = ?
    ORDER BY criado_em ASC
  `).bind(uid, conversaId).all();

  return results;
}

export async function incrementarUso(uid: string) {
  const { results } = await d1.prepare(`
    INSERT INTO uso (uid, contador, atualizado_em)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(uid) DO UPDATE SET
      contador = uso.contador + 1,
      atualizado_em = CURRENT_TIMESTAMP
    RETURNING uid, contador, atualizado_em
  `).bind(uid).all();

  return results[0];
}

export async function obterUso(uid: string) {
  const { results } = await d1.prepare(`
    SELECT uid, contador, atualizado_em
    FROM uso
    WHERE uid = ?
  `).bind(uid).all();

  return results[0] || { uid, contador: 0, atualizado_em: null };
}
