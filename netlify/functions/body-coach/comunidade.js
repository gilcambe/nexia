'use strict';

// NEXIA Body Coach — a equipe como comunidade:
// pontos_marcar: refeição registrada e check-in do dia também valem pontos no ranking (não só treino);
// registrarCargas / ranking_carga: ranking de progressão de carga por exercício (quanto cada um evoluiu desde a 1ª vez);
// feed_*: mural só da equipe (fotos, textos, curtidas), guardado em bc_equipes/{coach}/feed (sem índice novo).

const { avisar } = require('./push');

const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const hojeBR = (t = Date.now()) => new Date(t - 3 * 3600000).toISOString().slice(0, 10);
const chaveEx = (nome) => limpa(nome, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
const rm = (kg, reps) => Math.round(kg * (1 + Math.min(reps, 15) / 30) * 10) / 10; // 1RM estimado (Epley)
const IMAGEM_OK = (v) => typeof v === 'string' && v.length < 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
const MAX_EX = 60;

// Pontos da semana (ranking): treino 10, cada 10 min 1, dia de desafio 5, refeição registrada 2 (até 5 por dia),
// check-in do dia 2, treino com retorno para o coach (esforço/nota) 3.
const pontosDe = (s, diasDesafio = 0) => (s.treinos || 0) * 10 + Math.floor((s.minutos || 0) / 10) + diasDesafio * 5 + (s.refeicoes || 0) * 2 + (s.checkins || 0) * 2 + (s.feedbacks || 0) * 3;

function semanaDe(eu, inicio) {
  return eu.semana && eu.semana.inicio === inicio ? { ...eu.semana } : { inicio, treinos: 0, minutos: 0, kcal: 0 };
}

// Junta as melhores séries do treino na "progressão" do aluno: a 1ª marca de cada exercício fica como base.
function registrarCargas(eu, melhores, t = Date.now()) {
  const prog = { ...(eu.progressao || {}) };
  for (const m of (Array.isArray(melhores) ? melhores : []).slice(0, 30)) {
    const kg = Number(m && m.kg); const reps = Math.round(Number(m && m.reps));
    const id = chaveEx(m && m.ex);
    if (!id || !(kg > 0 && kg <= 1000) || !(reps >= 1 && reps <= 100)) continue;
    const r = rm(kg, reps);
    const atual = prog[id];
    if (!atual) {
      if (Object.keys(prog).length >= MAX_EX) continue;
      prog[id] = { nome: limpa(m.ex, 60), grupo: limpa(m.grupo, 20), base: { rm: r, em: t }, melhor: { rm: r, kg, reps, em: t } };
    } else if (r > atual.melhor.rm) {
      prog[id] = { ...atual, melhor: { rm: r, kg, reps, em: t } };
    }
  }
  return prog;
}
const ganho = (p) => (p && p.melhor.em > p.base.em && p.base.rm > 0 ? Math.round((p.melhor.rm / p.base.rm - 1) * 1000) / 10 : 0);

async function comunidade(body, uid, db, eu) {
  const acao = body.acao;
  const dir = db.collection('bc_diretorio');

  if (acao === 'pontos_marcar') {
    const tipo = body.tipo === 'checkin' ? 'checkin' : 'refeicao';
    const { inicioSemanaBR } = require('./tempo');
    const sem = inicioSemanaBR();
    const hoje = hojeBR();
    // Em transação: duas refeições marcadas ao mesmo tempo não podem se sobrescrever.
    const marcar = (atual) => {
      const dia = atual.pontosDia && atual.pontosDia.data === hoje ? { ...atual.pontosDia } : { data: hoje, refeicoes: 0, checkin: false };
      const s = semanaDe(atual, sem);
      if (tipo === 'refeicao') {
        if (dia.refeicoes >= 5) return { s, contou: false };
        dia.refeicoes += 1; s.refeicoes = (s.refeicoes || 0) + 1;
      } else {
        if (dia.checkin) return { s, contou: false };
        dia.checkin = true; s.checkins = (s.checkins || 0) + 1;
      }
      return { s, dia, contou: true };
    };
    const ref = dir.doc(uid);
    const r = typeof db.runTransaction === 'function'
      ? await db.runTransaction(async (tx) => {
        const x = marcar((await tx.get(ref)).data?.() || {});
        if (x.contou) tx.set(ref, { semana: x.s, pontosDia: x.dia }, { merge: true });
        return x;
      })
      : await (async () => { const x = marcar(eu); if (x.contou) await ref.set({ semana: x.s, pontosDia: x.dia }, { merge: true }); return x; })();
    return [200, { semana: r.s, contou: r.contou }];
  }

  // Ranking de progressão de carga: por exercício (ou geral = média dos ganhos), só quem participa do ranking.
  if (acao === 'ranking_carga') {
    const dono = eu.papel === 'coach' ? uid : eu.coachUid;
    if (!dono) return [200, { semEquipe: true, exercicios: [], lista: [] }];
    const alunos = (await dir.where('coachUid', '==', dono).limit(200).get()).docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => eu.papel === 'coach' || a.ranking || a.id === uid);
    const contagem = {};
    for (const a of alunos) for (const [id, p] of Object.entries(a.progressao || {})) { if (!contagem[id]) contagem[id] = { id, nome: p.nome, grupo: p.grupo, pessoas: 0 }; contagem[id].pessoas += 1; }
    const exercicios = Object.values(contagem).sort((x, y) => y.pessoas - x.pessoas || x.nome.localeCompare(y.nome)).slice(0, 30);
    const ex = limpa(body.exercicio, 60);
    const lista = alunos.map((a) => {
      const nome = (a.ranking && a.apelido) || a.nome || 'Aluno';
      const base = { nome, eu: a.id === uid, visivel: !!a.ranking };
      if (ex) {
        const p = (a.progressao || {})[ex];
        return p ? { ...base, ganho: ganho(p), de: p.base.rm, para: p.melhor.rm, kg: p.melhor.kg, reps: p.melhor.reps } : null;
      }
      const gs = Object.values(a.progressao || {}).filter((p) => p.melhor.em > p.base.em).map(ganho);
      return gs.length ? { ...base, ganho: Math.round((gs.reduce((s, g) => s + g, 0) / gs.length) * 10) / 10, exercicios: gs.length } : null;
    }).filter(Boolean).sort((x, y) => y.ganho - x.ganho);
    return [200, { exercicios, lista, exercicio: ex || null }];
  }

  // ── Feed da equipe ──
  if (!acao || !acao.startsWith('feed_')) return null;
  const equipe = eu.papel === 'coach' ? uid : eu.coachUid;
  if (!equipe) return [403, { error: 'O feed é da equipe do seu coach. Entre com o código dele.' }];
  const feed = db.collection('bc_equipes').doc(equipe).collection('feed');

  if (acao === 'feed_ver') {
    const antes = Number(body.antes) || 0;
    const q = antes ? feed.where('em', '<', antes).orderBy('em', 'desc').limit(10) : feed.orderBy('em', 'desc').limit(10);
    const snap = await q.get();
    const posts = snap.docs.map((d) => { const p = d.data(); const curt = Array.isArray(p.curtidas) ? p.curtidas : []; return { id: d.id, autor: p.autor, nome: p.nome, foto: p.foto || '', texto: p.texto || '', imagem: p.imagem || '', em: p.em, curtidas: curt.length, curti: curt.includes(uid), meu: p.autor === uid, coach: p.autor === equipe, tipo: p.tipo || '' }; });
    return [200, { posts, souCoach: eu.papel === 'coach', mais: posts.length === 10 }];
  }
  if (acao === 'feed_postar') {
    const texto = limpa(body.texto, 500);
    const imagem = body.imagem ? (IMAGEM_OK(body.imagem) ? body.imagem : null) : '';
    if (imagem === null) return [400, { error: 'Foto inválida ou grande demais.' }];
    if (!texto && !imagem) return [400, { error: 'Escreva algo ou escolha uma foto.' }];
    const post = { autor: uid, nome: eu.nome || 'Aluno', foto: eu.foto || '', texto, imagem, em: Date.now(), curtidas: [], tipo: body.tipo === 'treino' ? 'treino' : '' };
    const r = await feed.add(post);
    // post do coach avisa a equipe no celular (post de aluno não, para não virar barulho)
    if (eu.papel === 'coach') {
      const alunos = await dir.where('coachUid', '==', uid).limit(200).get();
      await Promise.race([Promise.all(alunos.docs.map((a) => avisar(db, a.id, { titulo: `${eu.nome || 'Coach'} postou no feed`, corpo: texto.slice(0, 120) || '📷 Nova foto', url: 'feed', tag: 'feed' }).catch(() => 0))), new Promise((ok) => setTimeout(ok, 4000))]);
    }
    return [200, { id: r.id }];
  }
  const id = limpa(body.id, 60).replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = id ? feed.doc(id) : null;
  const post = ref ? (await ref.get()).data?.() : null;
  if (!post) return [404, { error: 'Post não encontrado.' }];
  if (acao === 'feed_curtir') {
    const curt = Array.isArray(post.curtidas) ? post.curtidas : [];
    const curtidas = curt.includes(uid) ? curt.filter((x) => x !== uid) : [...curt, uid].slice(-500);
    await ref.set({ curtidas }, { merge: true });
    return [200, { curtidas: curtidas.length, curti: curtidas.includes(uid) }];
  }
  if (acao === 'feed_apagar') {
    if (post.autor !== uid && eu.papel !== 'coach') return [403, { error: 'Só quem postou (ou o coach) apaga.' }];
    await ref.delete();
    return [200, { ok: true }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

module.exports = { comunidade, registrarCargas, pontosDe, ganho, chaveEx };
