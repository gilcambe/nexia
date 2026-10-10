'use strict';

// NEXIA Body Coach — conversa direta entre coach/personal e aluno (como um WhatsApp interno).
// Tudo passa por aqui (login do Firebase + banco no servidor), então não precisa abrir regras do Firestore
// e um aluno nunca lê conversa de outra pessoa. Só texto curto; sem armazenamento pago.
// ações: perfil, vincular, contatos, enviar, ler, resumo, video_enviar, video_ver, demo_salvar, demo_ver, demo_listar
// Evolução: alunos_evolucao, aluno_evolucao, agendar_avaliacao, comentar (coach); evolucao_info, evolucao_config (aluno);
// compartilhar_criar / compartilhar_revogar (dono da avaliação) e compartilhado_ver (link público que vence sozinho).
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

// Avaliação sem as fotos (as fotos pesam ~200 KB cada): diz só quais poses existem.
const POSES = ['frente', 'costas', 'direita', 'esquerda'];
function semFotos(d) {
  const { fotos, image_url: img, ...resto } = d || {};
  const poses = POSES.filter((p) => fotos && fotos[p]);
  if (img && !poses.includes('frente')) poses.unshift('frente');
  return { ...resto, image_url: null, fotos: null, poses };
}
const tempo = (v) => { const n = new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };

// Perfil mínimo do aluno para os cálculos (sexo, idade, altura) e as metas.
async function perfilDe(db, aluno) {
  const p = (await db.collection('bodycoach_users').doc(aluno).collection('profile').doc('main').get().catch(() => null))?.data?.() || {};
  const ob = p.onboarding || {};
  const altura = Number(p.height_cm) || Number(ob.height) || null;
  const idade = Number(ob.age) || null;
  return {
    sexo: p.sexo === 'M' || p.sexo === 'F' ? p.sexo : null,
    idade, altura,
    nome: p.full_name || ob.name || p.apelido || null,
    metaGordura: Number(p.goal_body_fat_pct) || null,
    metaPeso: Number(p.goal_weight_kg) || null,
  };
}

async function entradasDe(db, aluno, limite) {
  const snap = await db.collection('bodycoach_users').doc(aluno).collection('progress_entries').orderBy('taken_at', 'desc').limit(limite).get();
  return snap.docs.map((d) => d.data()).sort((a, b) => tempo(b.taken_at) - tempo(a.taken_at));
}

// O aluno escolhe o que o coach vê. Medidas: sim por padrão (como o peso no resumo da semana). Fotos: só se o aluno ligar.
const partilha = (d) => ({ avaliacoes: !(d && d.compartilhaEvolucao && d.compartilhaEvolucao.avaliacoes === false), fotos: !!(d && d.compartilhaEvolucao && d.compartilhaEvolucao.fotos) });

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const ALVOS = ['geral', 'medidas', ...POSES];
const dataBR = (iso) => iso.split('-').reverse().join('/');

// Link público de uma avaliação (sem login). Vence sozinho; o dono pode revogar antes.
async function verCompartilhado(body, db) {
  const token = limpa(body.token, 64);
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return [404, { error: 'Link inválido.' }];
  const c = (await db.collection('bc_compartilhados').doc(token).get()).data?.();
  if (!c || c.revogado) return [404, { error: 'Este link não existe mais.' }];
  if (Date.now() > c.expira) return [410, { error: 'Este link venceu. Peça um novo para quem enviou.' }];
  const todas = await entradasDe(db, c.uid, 40);
  const i = todas.findIndex((e) => String(e.id) === c.entrada);
  if (i < 0) return [404, { error: 'Esta avaliação foi apagada.' }];
  const atual = c.fotos ? todas[i] : semFotos(todas[i]);
  const anteriores = todas.slice(i + 1).filter((e) => e.avaliacao && Object.keys(e.avaliacao.valores || {}).length).slice(0, 1).map(semFotos);
  const perfil = await perfilDe(db, c.uid);
  return [200, { entradas: [atual, ...anteriores], perfil: { ...perfil, metaGordura: null, metaPeso: null }, expira: c.expira }];
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
  if (acao === 'compartilhar_criar') {
    const entrada = limpa(String(body.entrada ?? ''), 40);
    if (!ID_OK.test(entrada)) return [400, { error: 'Avaliação inválida.' }];
    const existe = (await db.collection('bodycoach_users').doc(uid).collection('progress_entries').doc(entrada).get()).data?.();
    if (!existe) return [404, { error: 'Avaliação não encontrada.' }];
    const dias = Math.min(30, Math.max(1, Math.round(Number(body.dias) || 7)));
    const token = require('crypto').randomBytes(18).toString('hex');
    const expira = Date.now() + dias * 86400000;
    await db.collection('bc_compartilhados').doc(token).set({ uid, entrada, expira, fotos: !!body.fotos, em: Date.now() });
    return [200, { token, expira }];
  }
  if (acao === 'compartilhar_revogar') {
    const token = limpa(body.token, 64);
    const ref = db.collection('bc_compartilhados').doc(token);
    const c = (await ref.get()).data?.();
    if (!c || c.uid !== uid) return [404, { error: 'Link não encontrado.' }];
    await ref.set({ revogado: true }, { merge: true });
    return [200, { ok: true }];
  }
  if (acao === 'evolucao_info') {
    // quem ainda não abriu a conversa não tem coach: responde vazio em vez de erro
    if (!eu || eu.papel !== 'aluno' || !eu.coachUid) return [200, { coach: null, partilha: partilha(eu), proximaAvaliacao: null }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    return [200, { coach: { uid: eu.coachUid, nome: c.nome || 'Seu coach', foto: c.foto || '' }, partilha: partilha(eu), proximaAvaliacao: eu.proximaAvaliacao || null }];
  }
  if (!eu) return [409, { error: 'Antes, escolha se você é aluno ou coach.' }];

  // ── Evolução: o lado do aluno ──
  if (acao === 'evolucao_config') {
    if (eu.papel !== 'aluno') return [403, { error: 'Só o aluno escolhe o que compartilha.' }];
    const nova = { avaliacoes: body.avaliacoes !== false, fotos: !!body.fotos };
    await dir.doc(uid).set({ compartilhaEvolucao: nova }, { merge: true });
    return [200, { partilha: nova }];
  }
  // ── Evolução: o painel do coach ──
  if (acao === 'alunos_evolucao') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vê a evolução dos alunos.' }];
    const alunos = await dir.where('coachUid', '==', uid).limit(100).get();
    const lista = await Promise.all(alunos.docs.map(async (a) => {
      const d = a.data();
      const p = partilha(d);
      const base = { uid: a.id, nome: d.nome, foto: d.foto || '', partilha: p, proximaAvaliacao: d.proximaAvaliacao || null };
      if (!p.avaliacoes) return { ...base, entradas: [], perfil: null };
      const [entradas, perfil] = await Promise.all([entradasDe(db, a.id, 4).catch(() => []), perfilDe(db, a.id)]);
      return { ...base, entradas: entradas.map(semFotos), perfil };
    }));
    return [200, { alunos: lista }];
  }

  // Desafio da equipe: o coach cria um (ex.: "7 dias treinando"); cada aluno marca o seu dia. Um aluno nunca vê o progresso de outro.
  const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  if (acao === 'desafio_criar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach cria desafios.' }];
    const titulo = limpa(body.titulo, 60);
    const dias = Math.round(Number(body.dias));
    if (titulo.length < 3) return [400, { error: 'Dê um nome ao desafio.' }];
    if (!(dias >= 3 && dias <= 60)) return [400, { error: 'O desafio dura de 3 a 60 dias.' }];
    const desafio = { id: String(Date.now()), titulo, dias, inicio: hojeBR() };
    await dir.doc(uid).set({ desafio }, { merge: true });
    return [200, { desafio }];
  }
  if (acao === 'desafio_encerrar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach encerra desafios.' }];
    await dir.doc(uid).set({ desafio: null }, { merge: true });
    return [200, { ok: true }];
  }
  if (acao === 'desafio_ver') {
    if (eu.papel === 'coach') {
      const alunos = await dir.where('coachUid', '==', uid).limit(100).get();
      const d = eu.desafio || null;
      return [200, { desafio: d, alunos: d ? alunos.docs.map((a) => ({ uid: a.id, nome: a.data().nome, feitos: a.data().checkins && a.data().checkins.id === d.id ? a.data().checkins.datas.length : 0 })) : [] }];
    }
    const c = eu.coachUid ? ((await dir.doc(eu.coachUid).get()).data?.() || {}) : {};
    const d = c.desafio || null;
    const datas = d && eu.checkins && eu.checkins.id === d.id ? eu.checkins.datas : [];
    return [200, { desafio: d, datas, hoje: hojeBR() }];
  }
  if (acao === 'desafio_checkin') {
    if (eu.papel !== 'aluno' || !eu.coachUid) return [403, { error: 'Só o aluno de um coach marca o desafio.' }];
    const d = ((await dir.doc(eu.coachUid).get()).data?.() || {}).desafio;
    if (!d) return [404, { error: 'O seu coach não tem desafio ativo.' }];
    const hoje = hojeBR();
    const fim = new Date(new Date(`${d.inicio}T00:00:00Z`).getTime() + (d.dias - 1) * 86400000).toISOString().slice(0, 10);
    if (hoje < d.inicio || hoje > fim) return [409, { error: 'Este desafio já terminou.' }];
    const datas = eu.checkins && eu.checkins.id === d.id ? eu.checkins.datas.slice() : [];
    if (!datas.includes(hoje)) datas.push(hoje);
    await dir.doc(uid).set({ checkins: { id: d.id, datas } }, { merge: true });
    return [200, { datas, hoje }];
  }

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
      return [200, { papel: 'coach', codigo: eu.codigo, eu: { nome: eu.nome, foto: eu.foto || '' }, contatos: alunos.docs.map((d) => ({ uid: d.id, nome: d.data().nome, foto: d.data().foto || '' })) }];
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
    // Índice leve (sem os vídeos) para a tela "Minhas demonstrações" do coach.
    const idx = db.collection('bc_demos_idx').doc(uid);
    const lista = ((await idx.get()).data?.() || {}).lista || [];
    await idx.set({ lista: [...lista.filter((e) => e !== ex), ex].slice(-300), em: Date.now() });
    return [200, { ok: true }];
  }
  if (acao === 'demo_listar') {
    if (eu.papel !== 'coach') return [200, { lista: [] }];
    const d = (await db.collection('bc_demos_idx').doc(uid).get()).data?.();
    return [200, { lista: d && Array.isArray(d.lista) ? d.lista : [] }];
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
  if (acao === 'aluno_evolucao') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vê a evolução do aluno.' }];
    const p = partilha(dOutro);
    if (!p.avaliacoes) return [403, { error: `${dOutro.nome || 'O aluno'} não compartilhou as avaliações com você.` }];
    const [todas, perfil] = await Promise.all([entradasDe(db, outro, 40), perfilDe(db, outro)]);
    // fotos só se o aluno ligou, e só das 8 sessões mais recentes que têm foto (o resto vai sem, para não pesar)
    let comFoto = 0;
    const entradas = todas.map((e) => {
      const tem = e.fotos && POSES.some((x) => e.fotos[x]);
      if (p.fotos && tem && comFoto < 8) { comFoto += 1; return { ...e, poses: POSES.filter((x) => e.fotos[x]) }; }
      return semFotos(e);
    });
    return [200, { entradas, perfil, partilha: p, nome: dOutro.nome, proximaAvaliacao: dOutro.proximaAvaliacao || null }];
  }
  if (acao === 'agendar_avaliacao') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach marca avaliações.' }];
    if (body.data == null) {
      await dir.doc(outro).set({ proximaAvaliacao: null }, { merge: true });
      return [200, { proximaAvaliacao: null }];
    }
    const data = limpa(body.data, 10);
    const hora = limpa(body.hora, 5);
    if (!DATA_OK.test(data) || (hora && !HORA_OK.test(hora))) return [400, { error: 'Escolha uma data e hora válidas.' }];
    if (data < hojeBR()) return [400, { error: 'Escolha uma data a partir de hoje.' }];
    const proxima = { data, hora: hora || null, em: Date.now() };
    await dir.doc(outro).set({ proximaAvaliacao: proxima }, { merge: true });
    const m = { de: uid, texto: `📅 Avaliação marcada para ${dataBR(data)}${hora ? ` às ${hora}` : ''}. Como se preparar: venha em jejum de 3 horas, sem treinar antes, com bexiga vazia e roupa leve. Para as fotos, mesma luz e mesmo lugar da última vez.`, em: Date.now(), tipo: 'agenda' };
    const r = await msgs.add(m);
    return [200, { proximaAvaliacao: proxima, mensagem: { id: r.id, ...m } }];
  }
  if (acao === 'comentar') {
    const texto = limpa(body.texto, 600);
    const entrada = limpa(String(body.entrada ?? ''), 40);
    const alvo = ALVOS.includes(body.alvo) ? body.alvo : 'geral';
    if (!texto) return [400, { error: 'Escreva o comentário.' }];
    if (!ID_OK.test(entrada)) return [400, { error: 'Avaliação inválida.' }];
    const data = DATA_OK.test(String(body.data || '')) ? body.data : null;
    const m = { de: uid, texto, em: Date.now(), ref: { entrada, alvo, data } };
    const r = await msgs.add(m);
    return [200, { mensagem: { id: r.id, ...m } }];
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
exports.verCompartilhado = verCompartilhado;
exports.resumirSemana = resumirSemana;

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  // Link público de avaliação: o único pedido sem login (o token aleatório é a chave, e vence sozinho).
  if (body && body.acao === 'compartilhado_ver') {
    try {
      const { db } = require('./firebase-init');
      if (!db) return resposta(event, 503, { error: 'Indisponível agora.' });
      const [status, out] = await verCompartilhado(body, db);
      return resposta(event, status, out);
    } catch {
      return resposta(event, 503, { error: 'Indisponível agora. Tente de novo.' });
    }
  }
  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre na sua conta para conversar.' });
  // leituras (a tela confere a cada poucos segundos) não gastam o limite nem a cota do banco grátis
  if (['enviar', 'perfil', 'vincular', 'video_enviar', 'demo_salvar', 'feedback_enviar', 'desafio_criar', 'desafio_checkin', 'comentar', 'agendar_avaliacao', 'compartilhar_criar'].includes(body.acao)) {
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
