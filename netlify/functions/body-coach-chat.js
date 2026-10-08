'use strict';

// NEXIA Body Coach — conversa direta entre coach/personal e aluno (como um WhatsApp interno).
// Tudo passa por aqui (login do Firebase + banco no servidor), então não precisa abrir regras do Firestore
// e um aluno nunca lê conversa de outra pessoa. Só texto curto; sem armazenamento pago.
// ações: perfil, vincular, contatos, enviar, ler, resumo, video_enviar, video_ver, demo_salvar, demo_ver
// Vídeos: clipes curtos (até ~10 s, gravados já comprimidos no celular) guardados como texto no próprio banco grátis.

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');

const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });
const par = (a, b) => [a, b].sort().join('__');
const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const VIDEO_MAX = 700000; // caracteres do data URL (cabe no limite de 1 MiB do documento)
const videoOk = (v) => typeof v === 'string' && v.length < VIDEO_MAX && /^data:video\/(webm|mp4)(;codecs=[^;,]+)?;base64,[A-Za-z0-9+/=]+$/.test(v);
const codigoNovo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

// Junta o que o aluno fez nos últimos 7 dias em números simples para o coach.
function resumirSemana({ treinos, pesos }, desde, perfilAluno) {
  const t = (v) => { const n = new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
  const semana = treinos.filter((w) => t(w.done_at) >= desde);
  const kgs = pesos.filter((p) => p.weight_kg > 0).sort((a, b) => t(b.taken_at) - t(a.taken_at));
  const recente = kgs.find((p) => t(p.taken_at) >= desde);
  const anterior = kgs.find((p) => t(p.taken_at) < desde);
  const dias = Math.round((Date.now() - (semana.length ? Math.min(...semana.map((w) => t(w.done_at))) : Date.now())) / 86400000);
  return {
    aluno: perfilAluno && perfilAluno.nome,
    treinos: semana.length,
    minutos: Math.round(semana.reduce((a, w) => a + (Number(w.duration_min) || 0), 0)),
    volumeKg: Math.round(semana.reduce((a, w) => a + (Number(w.volume_kg) || 0), 0)),
    ultimoTreino: treinos[0] ? treinos[0].done_at : null,
    titulos: semana.slice(0, 7).map((w) => String(w.title || '').slice(0, 60)),
    pesoAtual: recente ? recente.weight_kg : (kgs[0] ? kgs[0].weight_kg : null),
    variacaoPeso: recente && anterior ? Math.round((recente.weight_kg - anterior.weight_kg) * 10) / 10 : null,
    diasDesdeOPrimeiro: semana.length ? dias : null,
  };
}

async function executar(body, uid, db, ctx = {}) {
  const dir = db.collection('bc_diretorio');
  const eu = (await dir.doc(uid).get()).data?.() || null;
  const acao = body.acao;

  if (acao === 'perfil') {
    const papel = body.papel === 'coach' ? 'coach' : 'aluno';
    const nome = limpa(body.nome, 60) || 'Sem nome';
    const atual = eu || {};
    // quem escolheu aluno por engano pode virar coach enquanto ainda não entrou na equipe de ninguém
    const virar = atual.papel === 'aluno' && !atual.coachUid && papel === 'coach';
    const papelFinal = virar ? 'coach' : (atual.papel || papel);
    const novo = { papel: papelFinal, nome, foto: typeof body.foto === 'string' && body.foto.length < 40000 ? body.foto : (atual.foto || ''), coachUid: atual.coachUid || '', codigo: atual.codigo || (papelFinal === 'coach' ? codigoNovo() : '') };
    await dir.doc(uid).set(novo, { merge: true });
    return [200, { perfil: novo }];
  }
  if (acao === 'feedback_enviar') {
    const texto = limpa(body.texto, 2000);
    if (texto.length < 3) return [400, { error: 'Escreva o seu comentário.' }];
    const tipo = ['bug', 'ideia', 'elogio'].includes(body.tipo) ? body.tipo : 'ideia';
    await db.collection('bc_feedback').add({ uid, nome: (eu && eu.nome) || '', tipo, texto, tela: limpa(body.tela, 60), em: Date.now() });
    return [200, { ok: true }];
  }
  if (acao === 'feedback_ver') {
    if (!ctx.master) return [403, { error: 'Só o administrador vê os comentários.' }];
    const snap = await db.collection('bc_feedback').orderBy('em', 'desc').limit(100).get();
    return [200, { itens: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }];
  }
  if (!eu) return [409, { error: 'Antes, escolha se você é aluno ou coach.' }];

  if (acao === 'vincular') {
    if (eu.papel !== 'aluno') return [403, { error: 'Só aluno entra pelo código do coach.' }];
    const codigo = limpa(body.codigo, 10).toUpperCase();
    if (codigo.length < 4) return [400, { error: 'Digite o código que o seu coach passou.' }];
    const achados = await dir.where('codigo', '==', codigo).limit(1).get();
    const doc = achados.docs && achados.docs[0];
    if (!doc || doc.data().papel !== 'coach') return [404, { error: 'Não achei esse código. Confira com o seu coach.' }];
    await dir.doc(uid).set({ coachUid: doc.id }, { merge: true });
    return [200, { coach: { uid: doc.id, nome: doc.data().nome, foto: doc.data().foto || '' } }];
  }

  if (acao === 'contatos') {
    if (eu.papel === 'coach') {
      const alunos = await dir.where('coachUid', '==', uid).limit(100).get();
      return [200, { papel: 'coach', codigo: eu.codigo, contatos: alunos.docs.map((d) => ({ uid: d.id, nome: d.data().nome, foto: d.data().foto || '' })) }];
    }
    if (!eu.coachUid) return [200, { papel: 'aluno', contatos: [] }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    return [200, { papel: 'aluno', contatos: [{ uid: eu.coachUid, nome: c.nome || 'Seu coach', foto: c.foto || '' }] }];
  }

  // Vídeo de demonstração do coach para um exercício (o aluno vê o do coach vinculado a ele)
  if (acao === 'demo_salvar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach grava demonstrações.' }];
    const ex = limpa(body.exercicio, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!ex) return [400, { error: 'Exercício inválido.' }];
    if (!videoOk(body.video)) return [400, { error: 'Vídeo inválido ou grande demais (máximo ~10 segundos).' }];
    await db.collection('bc_demos').doc(`${uid}__${ex}`).set({ coachUid: uid, exercicio: ex, video: body.video, em: Date.now() });
    return [200, { ok: true }];
  }
  if (acao === 'demo_ver') {
    const dono = eu.papel === 'coach' ? uid : eu.coachUid;
    const ex = limpa(body.exercicio, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!dono || !ex) return [200, { video: null }];
    const d = (await db.collection('bc_demos').doc(`${dono}__${ex}`).get()).data?.();
    return [200, { video: d ? d.video : null }];
  }
  if (acao === 'video_ver') {
    const v = (await db.collection('bc_videos').doc(limpa(body.id, 60)).get()).data?.();
    if (!v || (v.de !== uid && v.para !== uid)) return [404, { error: 'Vídeo não encontrado.' }];
    return [200, { video: v.video }];
  }

  // enviar / ler: só entre coach e aluno vinculados
  const outro = limpa(body.com, 128);
  if (!outro) return [400, { error: 'Escolha com quem falar.' }];
  const dOutro = (await dir.doc(outro).get()).data?.() || null;
  const vinculados = dOutro && ((eu.papel === 'aluno' && eu.coachUid === outro && dOutro.papel === 'coach') || (eu.papel === 'coach' && dOutro.coachUid === uid));
  if (!vinculados) return [403, { error: 'Você só conversa com o seu coach ou com os seus alunos.' }];
  const msgs = db.collection('bc_conversas').doc(par(uid, outro)).collection('mensagens');

  if (acao === 'enviar') {
    const texto = limpa(body.texto, 1500);
    if (!texto) return [400, { error: 'Escreva a mensagem.' }];
    const m = { de: uid, texto, em: Date.now() };
    const ref = await msgs.add(m);
    return [200, { mensagem: { id: ref.id, ...m } }];
  }
  if (acao === 'resumo') {
    // Revisão da semana do aluno, só para o coach vinculado (lê os dados do aluno pelo servidor; nada de regras novas)
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vê o resumo do aluno.' }];
    const base = db.collection('bodycoach_users').doc(outro);
    const desde = Date.now() - 7 * 86400000;
    const lista = async (colecao, campo) => {
      const snap = await base.collection(colecao).orderBy(campo, 'desc').limit(30).get();
      return snap.docs.map((d) => d.data());
    };
    const [treinos, pesos, prontidao, refeicoes] = await Promise.all([
      lista('workouts', 'done_at').catch(() => []), lista('progress_entries', 'taken_at').catch(() => []),
      lista('daily_readiness', 'date').catch(() => []), lista('meals', 'time').catch(() => []),
    ]);
    return [200, { resumo: resumirSemana({ treinos, pesos, prontidao, refeicoes }, desde, dOutro) }];
  }
  if (acao === 'video_enviar') {
    if (!videoOk(body.video)) return [400, { error: 'Vídeo inválido ou grande demais (máximo ~10 segundos).' }];
    const ref = await db.collection('bc_videos').add({ de: uid, para: outro, video: body.video, em: Date.now() });
    const m = { de: uid, texto: limpa(body.texto, 300), video: ref.id, em: Date.now() };
    const r = await msgs.add(m);
    return [200, { mensagem: { id: r.id, ...m } }];
  }
  if (acao === 'ler') {
    // com "depois" devolve só o que chegou depois dessa hora (a tela confere a cada poucos segundos sem gastar a cota do banco grátis)
    const depois = Number(body.depois) || 0;
    const q = depois ? msgs.where('em', '>', depois).orderBy('em', 'asc').limit(100) : msgs.orderBy('em', 'desc').limit(100);
    const snap = await q.get();
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return [200, { mensagens: depois ? lista : lista.reverse() }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

exports.executar = executar;
exports.resumirSemana = resumirSemana;

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });
  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre na sua conta para conversar.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  // leituras (a tela confere a cada poucos segundos) não gastam o limite nem a cota do banco grátis
  if (['enviar', 'perfil', 'vincular', 'video_enviar', 'demo_salvar', 'feedback_enviar'].includes(body.acao)) {
    const rl = await checkRateLimit(auth.uid, 'body-coach-chat');
    if (!rl.ok) return resposta(event, 429, { error: 'Muitos pedidos seguidos. Aguarde um instante.' });
  }
  try {
    const { db } = require('./firebase-init');
    if (!db) return resposta(event, 503, { error: 'Conversa indisponível agora.' });
    const [status, out] = await executar(body, auth.uid, db, { master: auth.role === 'master' });
    return resposta(event, status, out);
  } catch {
    return resposta(event, 503, { error: 'Conversa indisponível agora. Tente de novo.' });
  }
};
