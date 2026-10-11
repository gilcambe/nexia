'use strict';

// NEXIA Body Coach — ferramentas do coach para a equipe (chamadas por body-coach-chat.js, mesmo login e mesmo banco).
// anamnese_salvar / anamnese_ver / anamnese_responder: o coach cria as perguntas dele e o aluno responde ao entrar.
// modelo_salvar / modelo_listar / modelo_ver / modelo_apagar / modelo_aplicar: fichas e dietas prontas para vários alunos.
// textoDoTreino: o resumo do treino (notas por série, "até a falha", esforço, comentário) que vai para a conversa do coach.

const { avisarConversa } = require('./push');

const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const par = (a, b) => [a, b].sort().join('__');
const conversa = (db, a, b) => db.collection('bc_conversas').doc(par(a, b)).collection('mensagens');

const TIPOS = ['texto', 'simnao', 'opcoes', 'numero'];
const MAX_PERGUNTAS = 30;
const MAX_MODELOS = 40;

function perguntasLimpas(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  return lista.slice(0, MAX_PERGUNTAS).map((p, i) => {
    let id = limpa(p && p.id, 20).replace(/[^a-zA-Z0-9_-]/g, '') || `p${i + 1}`;
    while (vistos.has(id)) id = `${id}x`;
    vistos.add(id);
    const tipo = TIPOS.includes(p && p.tipo) ? p.tipo : 'texto';
    const opcoes = tipo === 'opcoes' ? (Array.isArray(p.opcoes) ? p.opcoes : []).slice(0, 8).map((o) => limpa(o, 40)).filter(Boolean) : [];
    return { id, texto: limpa(p && p.texto, 200), tipo: tipo === 'opcoes' && opcoes.length < 2 ? 'texto' : tipo, opcoes, obrigatoria: !!(p && p.obrigatoria) };
  }).filter((p) => p.texto.length >= 3);
}

// Respostas conferidas contra as perguntas atuais do coach. Devolve [erro] ou [null, respostas].
function respostasLimpas(perguntas, r) {
  const fonte = r && typeof r === 'object' ? r : {};
  const out = {};
  for (const p of perguntas) {
    let v = limpa(String(fonte[p.id] ?? ''), 1000);
    if (p.tipo === 'simnao' && v && !['sim', 'nao'].includes(v)) v = '';
    if (p.tipo === 'opcoes' && v && !p.opcoes.includes(v)) v = '';
    if (p.tipo === 'numero' && v && !Number.isFinite(Number(v.replace(',', '.')))) v = '';
    if (p.obrigatoria && !v) return [`Responda: "${p.texto}"`];
    if (v) out[p.id] = v;
  }
  return [null, out];
}

// Situação da anamnese de um aluno: null (coach não tem), 'pendente' ou 'respondida'.
function situacaoAnamnese(coach, aluno) {
  const a = coach && coach.anamnese;
  if (!a || !Array.isArray(a.perguntas) || !a.perguntas.length) return null;
  return aluno && aluno.anamneseResp && aluno.anamneseResp.versao === a.versao ? 'respondida' : 'pendente';
}

const resumoFicha = (f) => `${f.dias.length} treino${f.dias.length > 1 ? 's' : ''} · ${f.dias.reduce((a, d) => a + d.exercicios.length, 0)} exercícios`;
const resumoDieta = (p) => `${p.refeicoes.length} refeições${p.totais && p.totais.kcal ? ` · ${Math.round(p.totais.kcal)} kcal` : ''}`;

// Nota de treino para o coach: só sai mensagem quando o aluno anotou algo, foi até a falha ou deu o esforço.
function textoDoTreino(body) {
  const titulo = limpa(body.titulo, 60) || 'Treino';
  const min = Math.round(Number(body.minutos) || 0);
  const esforco = Math.round(Number(body.esforco));
  const comentario = limpa(body.comentario, 500);
  const notas = (Array.isArray(body.notas) ? body.notas : []).slice(0, 30).map((n) => ({
    ex: limpa(n && n.ex, 60), serie: Math.max(1, Math.min(20, Math.round(Number(n && n.serie) || 1))),
    falha: !!(n && n.falha), nota: limpa(n && n.nota, 200), carga: limpa(String((n && n.carga) ?? ''), 12), reps: Math.max(0, Math.min(200, Math.round(Number(n && n.reps) || 0))),
  })).filter((n) => n.ex && (n.falha || n.nota));
  const temEsforco = esforco >= 1 && esforco <= 5;
  if (!comentario && !notas.length && !temEsforco) return '';
  const linhas = [`🏋️ Treino feito: ${titulo}${min ? ` (${min} min)` : ''}.`];
  if (temEsforco) linhas.push(`Esforço: ${'●'.repeat(esforco)}${'○'.repeat(5 - esforco)} (${['muito leve', 'leve', 'na medida', 'pesado', 'no limite'][esforco - 1]}).`);
  for (const n of notas.slice(0, 12)) {
    linhas.push(`• ${n.ex}, série ${n.serie}${n.carga ? ` (${n.carga} kg × ${n.reps})` : ''}${n.falha ? ' · até a falha' : ''}${n.nota ? `: ${n.nota}` : ''}`);
  }
  if (comentario) linhas.push(`“${comentario}”`);
  return linhas.join('\n').slice(0, 1500);
}

async function equipe(body, uid, db, eu, util) {
  const acao = body.acao;
  const dir = db.collection('bc_diretorio');

  // ── Anamnese do coach ──
  if (acao === 'anamnese_salvar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach monta a anamnese.' }];
    const perguntas = perguntasLimpas(body.perguntas);
    const anamnese = perguntas.length ? { versao: Date.now(), perguntas, titulo: limpa(body.titulo, 60) || 'Anamnese' } : null;
    await dir.doc(uid).set({ anamnese }, { merge: true });
    return [200, { anamnese }];
  }
  if (acao === 'anamnese_ver') {
    if (eu.papel === 'coach') return [200, { papel: 'coach', anamnese: eu.anamnese || null }];
    if (!eu.coachUid) return [200, { papel: 'aluno', anamnese: null, situacao: null }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    return [200, { papel: 'aluno', coach: c.nome || 'Seu coach', anamnese: c.anamnese || null, respostas: (eu.anamneseResp && eu.anamneseResp.respostas) || {}, situacao: situacaoAnamnese(c, eu) }];
  }
  if (acao === 'anamnese_responder') {
    if (eu.papel !== 'aluno' || !eu.coachUid) return [403, { error: 'Só o aluno de um coach responde a anamnese.' }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    if (!c.anamnese) return [404, { error: 'O seu coach não tem anamnese.' }];
    const [erro, respostas] = respostasLimpas(c.anamnese.perguntas, body.respostas);
    if (erro) return [400, { error: erro }];
    const primeira = !(eu.anamneseResp && eu.anamneseResp.versao);
    await dir.doc(uid).set({ anamneseResp: { versao: c.anamnese.versao, respostas, em: Date.now() } }, { merge: true });
    const texto = primeira ? '📝 Respondi a sua anamnese. Já dá para ver em Meus alunos.' : '📝 Atualizei as respostas da anamnese.';
    await conversa(db, uid, eu.coachUid).add({ de: uid, texto, em: Date.now(), tipo: 'anamnese' });
    await avisarConversa(db, eu.coachUid, eu.nome, texto);
    return [200, { ok: true, situacao: 'respondida' }];
  }

  // ── Modelos de ficha e dieta ──
  if (!acao || !acao.startsWith('modelo_')) return null;
  if (eu.papel !== 'coach') return [403, { error: 'Só o coach usa modelos.' }];
  const modelos = db.collection('bc_modelos');
  const meu = async (id) => {
    const limpo = limpa(id, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!limpo) return null;
    const d = (await modelos.doc(limpo).get()).data?.();
    return d && d.coachUid === uid ? { id: limpo, ...d } : null;
  };

  if (acao === 'modelo_listar') {
    const snap = await modelos.where('coachUid', '==', uid).limit(MAX_MODELOS + 10).get();
    const lista = snap.docs.map((d) => { const x = d.data(); return { id: d.id, tipo: x.tipo, nome: x.nome, resumo: x.resumo || '', em: x.em, usos: x.usos || 0 }; })
      .filter((x) => !body.tipo || x.tipo === body.tipo)
      .sort((a, b) => b.em - a.em);
    return [200, { modelos: lista }];
  }
  if (acao === 'modelo_ver') {
    const m = await meu(body.id);
    if (!m) return [404, { error: 'Modelo não encontrado.' }];
    return [200, { modelo: { id: m.id, tipo: m.tipo, nome: m.nome, dados: m.dados } }];
  }
  if (acao === 'modelo_apagar') {
    const m = await meu(body.id);
    if (!m) return [404, { error: 'Modelo não encontrado.' }];
    await modelos.doc(m.id).delete();
    return [200, { ok: true }];
  }
  if (acao === 'modelo_salvar') {
    const tipo = body.tipo === 'dieta' ? 'dieta' : 'ficha';
    const dados = tipo === 'ficha' ? util.fichaLimpa(body.dados) : util.planoLimpo(body.dados, eu.nome);
    if (!dados) return [400, { error: tipo === 'ficha' ? 'Coloque pelo menos um exercício.' : 'Coloque pelo menos um alimento.' }];
    if (tipo === 'dieta') { delete dados.arquivo; delete dados.importado_em; delete dados.do_coach; }
    if (JSON.stringify(dados).length > 60000) return [400, { error: 'Ficou grande demais. Tire alguns itens.' }];
    const nome = limpa(body.nome, 60) || (tipo === 'ficha' ? dados.nome : 'Dieta');
    const doc = { coachUid: uid, tipo, nome, dados, resumo: tipo === 'ficha' ? resumoFicha(dados) : resumoDieta(dados), em: Date.now() };
    const existente = body.id ? await meu(body.id) : null;
    if (existente) {
      await modelos.doc(existente.id).set(doc, { merge: true });
      return [200, { id: existente.id, nome }];
    }
    const total = await modelos.where('coachUid', '==', uid).limit(MAX_MODELOS + 1).get();
    if (total.docs.length >= MAX_MODELOS) return [409, { error: `Você já tem ${MAX_MODELOS} modelos. Apague algum antes.` }];
    const ref = await modelos.add(doc);
    return [200, { id: ref.id, nome }];
  }
  if (acao === 'modelo_aplicar') {
    const m = await meu(body.id);
    if (!m) return [404, { error: 'Modelo não encontrado.' }];
    const alunos = [...new Set((Array.isArray(body.alunos) ? body.alunos : []).map((a) => limpa(a, 128)).filter(Boolean))].slice(0, 60);
    if (!alunos.length) return [400, { error: 'Escolha pelo menos um aluno.' }];
    let aplicados = 0;
    const recusados = [];
    for (const a of alunos) {
      const d = (await dir.doc(a).get()).data?.();
      if (!d || d.coachUid !== uid) { recusados.push(a); continue; }
      await util.gravarPrescricao(a, m.tipo, m.tipo === 'ficha' ? { ...m.dados } : { ...m.dados, arquivo: `Plano de ${eu.nome || 'seu coach'}`, importado_em: new Date().toISOString(), do_coach: true });
      aplicados += 1;
    }
    await modelos.doc(m.id).set({ usos: (m.usos || 0) + aplicados }, { merge: true });
    return [200, { aplicados, recusados: recusados.length }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

module.exports = { equipe, textoDoTreino, situacaoAnamnese, perguntasLimpas, respostasLimpas };
