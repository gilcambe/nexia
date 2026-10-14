'use strict';

// NEXIA Body Coach — nota do app (1 a 5 estrelas) e depoimentos (chamado por body-coach-chat.js).
// avaliar (logado, uma por pessoa, pode trocar), avaliacoes_ver e avaliacao_aprovar (só o admin)
// e depoimentos_publicos (sem login: só aprovados, 4+ estrelas, com primeiro nome, texto e estrelas).

const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const COL = 'bc_avaliacoes';

async function acoesAvaliacoes(body, uid, db, ctx = {}, eu = null) {
  const acao = body.acao;
  const col = db.collection(COL);
  if (acao === 'avaliar') {
    const estrelas = Math.round(Number(body.estrelas));
    if (!(estrelas >= 1 && estrelas <= 5)) return [400, { error: 'Escolha de 1 a 5 estrelas.' }];
    const texto = limpa(body.texto, 400);
    const publicar = body.publicar === true && estrelas >= 4;
    const antes = (await col.doc(uid).get()).data?.() || {};
    // trocou o texto ou a nota: volta para o admin aprovar de novo
    const aprovado = !!antes.aprovado && antes.texto === texto && antes.estrelas === estrelas && antes.publicar === publicar;
    const a = { estrelas, texto, publicar, aprovado, nome: limpa((eu && eu.nome) || body.nome, 60), papel: (eu && eu.papel) || 'aluno', em: Date.now() };
    await col.doc(uid).set(a);
    return [200, { ok: true }];
  }
  if (acao === 'avaliacoes_ver') {
    if (!ctx.master) return [403, { error: 'Só o administrador vê as avaliações.' }];
    const snap = await col.orderBy('em', 'desc').limit(200).get();
    const itens = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const media = itens.length ? Math.round((itens.reduce((s, i) => s + (i.estrelas || 0), 0) / itens.length) * 10) / 10 : 0;
    return [200, { itens, media }];
  }
  if (acao === 'avaliacao_aprovar') {
    if (!ctx.master) return [403, { error: 'Só o administrador aprova.' }];
    const alvo = limpa(body.uid, 128);
    if (!alvo || !(await col.doc(alvo).get()).data?.()) return [404, { error: 'Avaliação não encontrada.' }];
    await col.doc(alvo).set({ aprovado: body.aprovado === true }, { merge: true });
    return [200, { ok: true }];
  }
  return null;
}

// Sem login: até 6 depoimentos aprovados (4 ou 5 estrelas), só o primeiro nome.
async function depoimentosPublicos(db) {
  const snap = await db.collection(COL).where('aprovado', '==', true).limit(50).get();
  const itens = snap.docs.map((d) => d.data())
    .filter((a) => a.publicar === true && a.estrelas >= 4 && a.texto)
    .sort((a, b) => (b.em || 0) - (a.em || 0))
    .slice(0, 6)
    .map((a) => ({ nome: String(a.nome || '').split(' ')[0] || 'Aluno', texto: a.texto, estrelas: a.estrelas }));
  return [200, { depoimentos: itens }];
}

module.exports = { acoesAvaliacoes, depoimentosPublicos };
