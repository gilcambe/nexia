'use strict';

// NEXIA Body Coach — exercícios da comunidade: quem cria um exercício que não está na lista do app
// salva para todos. Todo mundo vê; só quem criou (ou o admin) edita e apaga.
// Fica num documento só (bc_exercicios/comunidade), com no máximo MAX itens: sem índice novo nem regra nova no banco.

const MAX = 800;
const limpa = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const chave = (nome) => limpa(nome, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
const GRUPOS = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'gluteos', 'panturrilha', 'abdomen', 'cardio', 'corpo_todo', 'outro'];

// Funções puras (testadas): devolvem { lista, erro?, item? } sem mexer na lista original.
function aplicarSalvar(lista, dados, uid, autorNome, admin = false, agora = Date.now()) {
  const atual = Array.isArray(lista) ? lista : [];
  const nome = limpa(dados && dados.nome, 60);
  if (nome.length < 2) return { lista: atual, erro: 'Escreva o nome do exercício.' };
  const grupo = GRUPOS.includes(dados && dados.grupo) ? dados.grupo : 'outro';
  const como = limpa(dados && dados.como, 400);
  const id = limpa(dados && dados.id, 60);
  if (id) {
    const i = atual.findIndex((e) => e.id === id);
    if (i < 0) return { lista: atual, erro: 'Esse exercício foi apagado.' };
    if (atual[i].autor !== uid && !admin) return { lista: atual, erro: 'Só quem criou pode editar.' };
    const outro = atual.find((e) => e.id !== id && chave(e.nome) === chave(nome));
    if (outro) return { lista: atual, erro: 'Já existe um exercício com esse nome.' };
    const item = { ...atual[i], nome, grupo, como, editado: agora };
    return { lista: atual.map((e, j) => (j === i ? item : e)), item };
  }
  // Mesmo nome já salvo: não duplica, devolve o que existe.
  const igual = atual.find((e) => chave(e.nome) === chave(nome));
  if (igual) return { lista: atual, item: igual };
  if (atual.length >= MAX) return { lista: atual, erro: 'A lista da comunidade está cheia. Avise o suporte.' };
  const item = { id: `${chave(nome)}_${agora.toString(36)}`, nome, grupo, como, autor: uid, autorNome: limpa(autorNome, 40), em: agora };
  return { lista: [...atual, item], item };
}

function aplicarApagar(lista, id, uid, admin = false) {
  const atual = Array.isArray(lista) ? lista : [];
  const e = atual.find((x) => x.id === id);
  if (!e) return { lista: atual };
  if (e.autor !== uid && !admin) return { lista: atual, erro: 'Só quem criou pode apagar.' };
  return { lista: atual.filter((x) => x.id !== id) };
}

async function exercicios(body, uid, db, eu, ctx = {}) {
  const acao = body && body.acao;
  if (!['exercicios_listar', 'exercicios_salvar', 'exercicios_apagar'].includes(acao)) return null;
  const ref = db.collection('bc_exercicios').doc('comunidade');
  const lista = ((await ref.get()).data?.() || {}).lista || [];
  const admin = !!ctx.master;
  if (acao === 'exercicios_listar') return [200, { lista, eu: uid }];
  const r = acao === 'exercicios_salvar'
    ? aplicarSalvar(lista, body, uid, (eu && (eu.nome || eu.apelido)) || '', admin)
    : aplicarApagar(lista, limpa(body.id, 60), uid, admin);
  if (r.erro) return [400, { error: r.erro }];
  if (r.lista !== lista) await ref.set({ lista: r.lista, em: Date.now() });
  return [200, { ok: true, item: r.item || null, lista: r.lista, eu: uid }];
}

module.exports = { exercicios, aplicarSalvar, aplicarApagar, GRUPOS };
