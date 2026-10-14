'use strict';

// NEXIA Body Coach — conversa direta entre coach/personal e aluno (como um WhatsApp interno).
// Tudo passa por aqui (login do Firebase + banco no servidor), então não precisa abrir regras do Firestore
// e um aluno nunca lê conversa de outra pessoa. Só texto curto; sem armazenamento pago.
// ações: perfil, vincular, contatos, enviar, ler, resumo, video_enviar, video_ver, demo_salvar, demo_ver, demo_listar
// Coach monta treino e dieta do aluno: alunos_painel, prescricao_ver, ficha_salvar, dieta_salvar.
// Anamnese do coach e modelos de ficha/dieta para vários alunos: anamnese_*, modelo_* (em body-coach/equipe.js).
// Novos: treino_feito, ranking_ver, ranking_config (ranking da equipe); dupla_* (treino em dupla ao vivo);
// pix_config, pix_ver, pagamento_marcar, pagamento_avisar (mensalidade por Pix, sem gateway).
// Evolução: alunos_evolucao, aluno_evolucao, agendar_avaliacao, comentar (coach); evolucao_info, evolucao_config (aluno);
// compartilhar_criar / compartilhar_revogar (dono da avaliação) e compartilhado_ver (link público que vence sozinho).
// Vídeos: clipes curtos (até ~10 s, gravados já comprimidos no celular) guardados como texto no próprio banco grátis.

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');
const { equipe, textoDoTreino, situacaoAnamnese } = require('./body-coach/equipe');
const { acoesPush, avisarConversa } = require('./body-coach/push');
const { negocio, lojaVer } = require('./body-coach/negocio');
const { comunidade, registrarCargas, pontosDe } = require('./body-coach/comunidade');
const { inicioSemanaBR } = require('./body-coach/tempo');
const { profissionais, vinculoDe, podeEditar, meusAlunos, marcaLimpa, marcarConvite } = require('./body-coach/profissionais');
const { acoesAcesso, estaBloqueado, LIVRES } = require('./body-coach/acesso');

const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });
const par = (a, b) => [a, b].sort().join('__');
const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const VIDEO_MAX = 700000; // caracteres do data URL (cabe no limite de 1 MiB do documento)
const videoOk = (v) => typeof v === 'string' && v.length < VIDEO_MAX && /^data:video\/(webm|mp4)(;codecs=[^;,]+)?;base64,[A-Za-z0-9+/=]+$/.test(v);
const codigoNovo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');


const DUPLA_HORAS = 4;
async function dupla(body, uid, db, eu) {
  const salas = db.collection('bc_duplas');
  const nome = (eu && eu.nome) || limpa(body.nome, 40) || 'Parceiro';
  const acao = body.acao;
  if (acao === 'dupla_criar') {
    const codigo = codigoNovo();
    const sala = { a: uid, b: '', nomes: { [uid]: nome }, status: {}, criado: Date.now(), expira: Date.now() + DUPLA_HORAS * 3600000 };
    await salas.doc(codigo).set(sala);
    return [200, { codigo, sala: { ...sala, souA: true } }];
  }
  const codigo = limpa(body.codigo, 10).toUpperCase();
  if (codigo.length < 4) return [400, { error: 'Digite o código do treino em dupla.' }];
  const ref = salas.doc(codigo);
  const sala = (await ref.get()).data?.();
  if (!sala || sala.expira < Date.now()) return [404, { error: 'Esse treino em dupla não existe ou já acabou.' }];
  if (acao === 'dupla_entrar') {
    if (sala.a !== uid && sala.b && sala.b !== uid) return [409, { error: 'Essa dupla já está completa.' }];
    if (sala.a !== uid && !sala.b) {
      sala.b = uid;
      sala.nomes = { ...sala.nomes, [uid]: nome };
      await ref.set({ b: uid, nomes: sala.nomes }, { merge: true });
    }
    return [200, { codigo, sala: { ...sala, souA: sala.a === uid } }];
  }
  if (sala.a !== uid && sala.b !== uid) return [403, { error: 'Você não está nessa dupla.' }];
  if (acao === 'dupla_status') {
    const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
    const st = { exercicio: limpa(body.exercicio, 60), series: num(body.series, 99), bpm: num(body.bpm, 240), kcal: num(body.kcal, 5000), recado: limpa(body.recado, 40), em: Date.now() };
    sala.status = { ...(sala.status || {}), [uid]: st };
    await ref.set({ status: sala.status }, { merge: true });
    return [200, { codigo, sala: { ...sala, souA: sala.a === uid } }];
  }
  if (acao === 'dupla_ver') return [200, { codigo, sala: { ...sala, souA: sala.a === uid } }];
  if (acao === 'dupla_sair') {
    await ref.set({ expira: 0 }, { merge: true });
    return [200, { ok: true }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

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

// ── Ficha e dieta montadas pelo coach (gravadas no perfil do aluno pelo servidor) ──
const numEntre = (v, min, max, padrao) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Confere e limpa a ficha que o coach mandou. Devolve null se não der para usar.
function fichaLimpa(f) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.dias)) return null;
  const dias = f.dias.slice(0, 7).map((d, i) => ({
    titulo: limpa(d && d.titulo, 60) || `Treino ${'ABCDEFG'[i]}`,
    exercicios: (Array.isArray(d && d.exercicios) ? d.exercicios : []).slice(0, 15).map((x) => ({
      id: limpa(x && x.id, 60).replace(/[^a-zA-Z0-9_-]/g, ''),
      nome: limpa(x && x.nome, 80),
      grupo: limpa(x && x.grupo, 30),
      series: numEntre(x && x.series, 1, 10, 3),
      reps: limpa(x && x.reps, 12) || '8–12',
      descanso: numEntre(x && x.descanso, 0, 600, 90),
      carga: limpa(x && x.carga, 16),
      obs: limpa(x && x.obs, 200),
    })).filter((x) => x.nome),
  })).filter((d) => d.exercicios.length);
  if (!dias.length) return null;
  return { nome: limpa(f.nome, 60) || 'Ficha do coach', obs: limpa(f.obs, 500), dias };
}

function macrosLimpos(m) {
  if (!m || typeof m !== 'object') return null;
  const n = (v) => Math.min(20000, Math.max(0, Math.round((Number(v) || 0) * 10) / 10));
  const out = { proteina: n(m.proteina), gordura: n(m.gordura), carbo: n(m.carbo), kcal: n(m.kcal) };
  return out.kcal || out.proteina || out.carbo || out.gordura ? out : null;
}

// Mesmo formato do plano importado do PDF da nutricionista (o app do aluno já sabe mostrar).
function planoLimpo(p, coachNome) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.refeicoes)) return null;
  const refeicoes = p.refeicoes.slice(0, 10).map((r) => ({
    horario: r && HHMM.test(String(r.horario || '')) ? String(r.horario).padStart(5, '0') : null,
    nome: limpa(r && r.nome, 40) || 'Refeição',
    itens: (Array.isArray(r && r.itens) ? r.itens : []).slice(0, 20).map((it) => ({ nome: limpa(it && it.nome, 80), qtd: limpa(it && it.qtd, 40) })).filter((it) => it.nome),
    trocas: (Array.isArray(r && r.trocas) ? r.trocas : []).slice(0, 20).map((t) => ({ de: limpa(t && t.de, 80), por: (Array.isArray(t && t.por) ? t.por : []).slice(0, 5).map((x) => limpa(x, 80)).filter(Boolean) })).filter((t) => t.de && t.por.length),
    obs: (Array.isArray(r && r.obs) ? r.obs : []).slice(0, 5).map((x) => limpa(x, 200)).filter(Boolean),
    macros: macrosLimpos(r && r.macros),
  })).filter((r) => r.itens.length);
  if (!refeicoes.length) return null;
  const extras = (Array.isArray(p.extras) ? p.extras : []).slice(0, 5).map((e) => ({ titulo: limpa(e && e.titulo, 60), texto: (Array.isArray(e && e.texto) ? e.texto : []).slice(0, 10).map((x) => limpa(x, 300)).filter(Boolean) })).filter((e) => e.titulo && e.texto.length);
  return { arquivo: `Plano de ${coachNome || 'seu coach'}`, importado_em: new Date().toISOString(), refeicoes, totais: macrosLimpos(p.totais), extras, do_coach: true };
}

// Linha do painel "Meus alunos": treinou hoje? quantos dias sem treinar? comeu? pagou?
async function linhaDoPainel(db, id, d, mes, hoje, sem, coach, uid) {
  const v = vinculoDe(uid, d) || { tipo: 'principal' };
  const outroProf = v.tipo === 'parceiro' ? d.coachUid : d.parceiroUid;
  const nomeOutro = outroProf ? (((await db.collection('bc_diretorio').doc(outroProf).get().catch(() => null))?.data?.() || {}).nome || 'Profissional') : '';
  const base = db.collection('bodycoach_users').doc(id);
  let ultimo = Number(d.ultimoTreino) || 0;
  if (!ultimo) {
    const w = await base.collection('workouts').orderBy('done_at', 'desc').limit(1).get().catch(() => null);
    ultimo = w && w.docs[0] ? tempo(w.docs[0].data().done_at) : 0;
  }
  const m = await base.collection('meals').orderBy('created_at', 'desc').limit(10).get().catch(() => null);
  const diaBR = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
  const refeicoesHoje = m ? m.docs.filter((x) => { const t = tempo(x.data().created_at); return t && diaBR(t) === hoje; }).length : 0;
  const perfil = (await base.collection('profile').doc('main').get().catch(() => null))?.data?.() || {};
  const s = d.semana && d.semana.inicio === sem ? d.semana : { treinos: 0 };
  const p = (d.pagamentos || {})[mes] || {};
  return {
    uid: id, nome: d.nome || 'Aluno', foto: d.foto || '',
    ultimoTreino: ultimo || null,
    treinouHoje: !!ultimo && diaBR(ultimo) === hoje,
    diasSemTreinar: ultimo ? Math.floor((tempo(`${hoje}T12:00:00-03:00`) - tempo(`${diaBR(ultimo)}T12:00:00-03:00`)) / 86400000) : null,
    treinosSemana: s.treinos || 0,
    refeicoesHoje,
    temFicha: !!(perfil.ficha_coach && Array.isArray(perfil.ficha_coach.dias) && perfil.ficha_coach.dias.length),
    temDieta: !!(perfil.plano_nutri && Array.isArray(perfil.plano_nutri.refeicoes) && perfil.plano_nutri.refeicoes.length),
    pago: !!p.pago, avisou: !!p.avisou,
    anamnese: v.tipo === 'parceiro' ? null : situacaoAnamnese(coach, d),
    vinculo: v.tipo,
    // equipe: o parceiro deste aluno (para o principal) ou o principal (para o parceiro), e a parte de quem é parceiro
    equipe: outroProf ? { nome: nomeOutro, parte: d.parceiroParte } : null,
  };
}

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
  // Acesso: teste grátis, aviso e bloqueio no servidor (o admin libera quando confirma o Pix).
  if (typeof acao === 'string' && acao.startsWith('acesso_')) return acoesAcesso(body, uid, db, ctx, eu);
  // Loja: ofertas fitness do robô de afiliados (só leitura de um arquivo público, com cache de 1 h).
  if (acao === 'loja_ofertas') return [200, await require('./body-coach/ofertas').lojaOfertas()];
  if (!LIVRES.includes(acao) && await estaBloqueado(db, uid, { ...ctx, papel: eu && eu.papel, coachUid: eu && eu.papel === 'aluno' ? eu.coachUid || '' : '' })) {
    return [402, { error: 'Seu período grátis acabou. Pague para continuar usando o app.', bloqueado: true }];
  }

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
  // Treino em dupla ao vivo: um cria o código, o amigo entra, e cada um vê a série e os batimentos do outro.
  // Não depende de coach nem de equipe; a sala some sozinha em 4 horas.
  if (acao && acao.startsWith('dupla_')) return dupla(body, uid, db, eu);
  // Avisos no celular (Web Push grátis): ligar, desligar, escolher lembretes, testar.
  if (acao && acao.startsWith('push_')) { const r = await acoesPush(body, uid, db); if (r) return r; }

  // Comprar um programa na loja de um coach: quem compra pode ainda não ter escolhido aluno/coach.
  if (['compra_criar', 'compra_avisar', 'compras_minhas'].includes(acao)) return negocio(body, uid, db, eu || {}, {});

  if (!eu) return [409, { error: 'Antes, escolha se você é aluno ou coach.' }];

  // Grava a ficha ou a dieta no perfil do aluno e avisa na conversa (usado ao montar para um aluno e ao aplicar um modelo).
  const gravarPrescricao = async (aluno, tipo, valor) => {
    const agora = Date.now();
    const ficha = tipo === 'ficha';
    await db.collection('bodycoach_users').doc(aluno).collection('profile').doc('main')
      .set(ficha ? { ficha_coach: { ...valor, coach: eu.nome || 'Seu coach', em: agora }, ficha_coach_dia: 0 } : { plano_nutri: valor }, { merge: true });
    const texto = ficha
      ? `📋 Montei a sua ficha de treino "${valor.nome}" (${valor.dias.length} treino${valor.dias.length > 1 ? 's' : ''}). Já está no seu app: é só abrir Treino.`
      : `🍽️ Montei o seu plano alimentar (${valor.refeicoes.length} refeições). Já está na aba Nutrição do seu app.`;
    const m = { de: uid, texto, em: agora };
    const r = await db.collection('bc_conversas').doc(par(uid, aluno)).collection('mensagens').add(m);
    await avisarConversa(db, aluno, eu.nome, texto);
    return { id: r.id, ...m };
  };
  const daEquipe = await equipe(body, uid, db, eu, { fichaLimpa, planoLimpo, gravarPrescricao });
  if (daEquipe) return daEquipe;
  const doNegocio = await negocio(body, uid, db, eu, { gravarPrescricao, situacaoAnamnese });
  if (doNegocio) return doNegocio;
  const daComunidade = await comunidade(body, uid, db, eu);
  if (daComunidade) return daComunidade;
  const dosProfissionais = await profissionais(body, uid, db, eu);
  if (dosProfissionais) return dosProfissionais;

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
    const alunos = await meusAlunos(db, uid);
    const lista = await Promise.all(alunos.map(async (a) => {
      const d = a.data();
      const p = partilha(d);
      const base = { uid: a.id, nome: d.nome, foto: d.foto || '', partilha: p, proximaAvaliacao: d.proximaAvaliacao || null };
      if (!p.avaliacoes) return { ...base, entradas: [], perfil: null };
      const [entradas, perfil] = await Promise.all([entradasDe(db, a.id, 4).catch(() => []), perfilDe(db, a.id)]);
      return { ...base, entradas: entradas.map(semFotos), perfil };
    }));
    return [200, { alunos: lista }];
  }

  // Painel "Meus alunos": quem treinou hoje, quem sumiu, quem comeu, quem pagou, quem tem ficha e dieta.
  if (acao === 'alunos_painel') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vê o painel dos alunos.' }];
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    const sem = inicioSemanaBR();
    const alunos = await meusAlunos(db, uid);
    const lista = await Promise.all(alunos.map((a) => linhaDoPainel(db, a.id, a.data(), mes, hoje, sem, eu, uid)));
    return [200, { alunos: lista, hoje, mes, cobra: !!eu.pix }];
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

  // Treino feito: conta a semana para o ranking da equipe e marca o desafio do dia sozinho.
  if (acao === 'treino_feito') {
    const min = Math.min(300, Math.max(0, Math.round(Number(body.minutos) || 0)));
    const kcal = Math.min(3000, Math.max(0, Math.round(Number(body.kcal) || 0)));
    const sem = inicioSemanaBR();
    const s = eu.semana && eu.semana.inicio === sem ? eu.semana : { inicio: sem, treinos: 0, minutos: 0, kcal: 0 };
    const temRetorno = eu.papel === 'aluno' && !!eu.coachUid && !!textoDoTreino(body);
    const semana = { ...s, inicio: sem, treinos: s.treinos + 1, minutos: s.minutos + min, kcal: (s.kcal || 0) + kcal, feedbacks: (s.feedbacks || 0) + (temRetorno ? 1 : 0) };
    // feitoEm: treino salvo sem internet e enviado depois conta no dia em que foi feito
    const feito = Number(body.feitoEm);
    const novo = { semana, progressao: registrarCargas(eu, body.melhores), ultimoTreino: feito > 0 && feito <= Date.now() && feito > Date.now() - 7 * 86400000 ? Math.max(feito, Number(eu.ultimoTreino) || 0) : Date.now() };
    let desafioMarcado = false;
    if (eu.papel === 'aluno' && eu.coachUid) {
      const d = ((await dir.doc(eu.coachUid).get()).data?.() || {}).desafio;
      const hoje = hojeBR();
      if (d) {
        const fim = new Date(new Date(`${d.inicio}T00:00:00Z`).getTime() + (d.dias - 1) * 86400000).toISOString().slice(0, 10);
        if (hoje >= d.inicio && hoje <= fim) {
          const datas = eu.checkins && eu.checkins.id === d.id ? eu.checkins.datas.slice() : [];
          if (!datas.includes(hoje)) { datas.push(hoje); desafioMarcado = true; }
          novo.checkins = { id: d.id, datas };
        }
      }
    }
    await dir.doc(uid).set(novo, { merge: true });
    // Notas por série, "até a falha", esforço e comentário vão para a conversa com o coach.
    const nota = eu.papel === 'aluno' && eu.coachUid ? textoDoTreino(body) : '';
    if (nota) {
      // o personal parceiro (quem cuida do treino) também recebe
      for (const para of [eu.coachUid, eu.parceiroParte === 'treino' && eu.parceiroUid].filter(Boolean)) {
        await db.collection('bc_conversas').doc(par(uid, para)).collection('mensagens').add({ de: uid, texto: nota, em: Date.now(), tipo: 'treino' });
        await avisarConversa(db, para, eu.nome, nota);
      }
    }
    return [200, { semana, desafioMarcado, coachAvisado: !!nota }];
  }
  if (acao === 'ranking_config') {
    const apelido = limpa(body.apelido, 30);
    await dir.doc(uid).set({ ranking: !!body.participar, apelido }, { merge: true });
    return [200, { ranking: !!body.participar, apelido }];
  }
  if (acao === 'ranking_ver') {
    // Só aparece quem escolheu participar; o coach vê a equipe inteira.
    const dono = eu.papel === 'coach' ? uid : eu.coachUid;
    if (!dono) return [200, { lista: [], participo: !!eu.ranking, apelido: eu.apelido || '', semEquipe: true }];
    const sem = inicioSemanaBR();
    const c = eu.papel === 'coach' ? eu : ((await dir.doc(dono).get()).data?.() || {});
    const d = c.desafio || null;
    const alunos = await dir.where('coachUid', '==', dono).limit(100).get();
    const lista = alunos.docs
      .map((a) => ({ id: a.id, ...a.data() }))
      .filter((a) => eu.papel === 'coach' || a.ranking || a.id === uid)
      .map((a) => {
        const s = a.semana && a.semana.inicio === sem ? a.semana : { treinos: 0, minutos: 0 };
        const dias = d && a.checkins && a.checkins.id === d.id ? a.checkins.datas.length : 0;
        return { nome: (a.ranking && a.apelido) || a.nome || 'Aluno', eu: a.id === uid, visivel: !!a.ranking, treinos: s.treinos, minutos: s.minutos, dias, refeicoes: s.refeicoes || 0, checkins: s.checkins || 0, feedbacks: s.feedbacks || 0, pontos: pontosDe(s, dias) };
      })
      .sort((a, b) => b.pontos - a.pontos || b.minutos - a.minutos);
    return [200, { lista, desafio: d, semana: sem, papel: eu.papel, participo: !!eu.ranking, apelido: eu.apelido || '' }];
  }

  // Mensalidade por Pix, sem gateway nem taxa: o coach cadastra a chave dele, o aluno paga pelo banco
  // e avisa; o coach marca quem pagou. O dinheiro vai direto de um para o outro.
  if (acao === 'pix_config') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach cadastra a chave Pix.' }];
    const tipo = ['cpf', 'cnpj', 'telefone', 'email', 'aleatoria'].includes(body.tipo) ? body.tipo : '';
    const chave = limpa(body.chave, 77);
    const nome = limpa(body.nome, 60);
    const cidade = limpa(body.cidade, 40);
    const valor = Math.round((Number(body.valor) || 0) * 100) / 100;
    const vencimento = Math.min(28, Math.max(1, Math.round(Number(body.vencimento) || 10)));
    if (!tipo || chave.length < 5) return [400, { error: 'Informe o tipo e a chave Pix.' }];
    if (nome.length < 3 || cidade.length < 2) return [400, { error: 'Informe o seu nome e a sua cidade (aparecem no banco do aluno).' }];
    if (!(valor >= 0 && valor <= 100000)) return [400, { error: 'Valor inválido.' }];
    const pix = { tipo, chave, nome, cidade, valor, vencimento, lembrete: body.lembrete !== false };
    await dir.doc(uid).set({ pix }, { merge: true });
    return [200, { pix }];
  }
  if (acao === 'pix_ver') {
    const mes = limpa(body.mes, 7) || hojeBR().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) return [400, { error: 'Mês inválido.' }];
    if (eu.papel === 'coach') {
      const alunos = await dir.where('coachUid', '==', uid).limit(100).get();
      return [200, { papel: 'coach', mes, pix: eu.pix || null, alunos: alunos.docs.map((a) => { const p = (a.data().pagamentos || {})[mes] || {}; return { uid: a.id, nome: a.data().nome, pago: !!p.pago, avisou: !!p.avisou, valor: a.data().valorMensal ?? null }; }) }];
    }
    if (!eu.coachUid) return [200, { papel: 'aluno', mes, pix: null }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    const p = (eu.pagamentos || {})[mes] || {};
    return [200, { papel: 'aluno', mes, pix: c.pix || null, coach: c.nome || 'Seu coach', valor: eu.valorMensal ?? (c.pix ? c.pix.valor : null), pago: !!p.pago, avisou: !!p.avisou }];
  }
  if (acao === 'pagamento_marcar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach marca pagamentos.' }];
    const aluno = limpa(body.aluno, 128);
    const mes = limpa(body.mes, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) return [400, { error: 'Mês inválido.' }];
    const a = (await dir.doc(aluno).get()).data?.();
    if (!a || a.coachUid !== uid) return [403, { error: 'Esse aluno não é da sua equipe.' }];
    const pagamentos = { ...(a.pagamentos || {}), [mes]: { ...((a.pagamentos || {})[mes] || {}), pago: !!body.pago, em: Date.now() } };
    const novo = { pagamentos };
    if (body.valor !== undefined) { const v = Math.round((Number(body.valor) || 0) * 100) / 100; if (v >= 0 && v <= 100000) novo.valorMensal = v; }
    await dir.doc(aluno).set(novo, { merge: true });
    return [200, { ok: true }];
  }
  if (acao === 'pagamento_avisar') {
    if (eu.papel !== 'aluno' || !eu.coachUid) return [403, { error: 'Só o aluno de um coach avisa o pagamento.' }];
    const mes = hojeBR().slice(0, 7);
    const pagamentos = { ...(eu.pagamentos || {}), [mes]: { ...((eu.pagamentos || {})[mes] || {}), avisou: true, avisouEm: Date.now() } };
    await dir.doc(uid).set({ pagamentos }, { merge: true });
    const [ano, m] = mes.split('-');
    await db.collection('bc_conversas').doc(par(uid, eu.coachUid)).collection('mensagens').add({ de: uid, texto: `💸 Paguei a mensalidade de ${m}/${ano} pelo Pix. Pode conferir?`, em: Date.now() });
    await avisarConversa(db, eu.coachUid, eu.nome, `💸 Paguei a mensalidade de ${m}/${ano} pelo Pix.`);
    return [200, { ok: true }];
  }

  if (acao === 'vincular') {
    if (eu.papel !== 'aluno') return [403, { error: 'Só aluno entra pelo código do coach.' }];
    const codigo = limpa(body.codigo, 10).toUpperCase();
    if (codigo.length < 4) return [400, { error: 'Digite o código que o seu coach passou.' }];
    const achados = await dir.where('codigo', '==', codigo).limit(1).get();
    const doc = achados.docs && achados.docs[0];
    if (!doc || doc.data().papel !== 'coach') return [404, { error: 'Não achei esse código. Confira com o seu coach.' }];
    // Já tem coach e veio pelo link de um parceiro (nutricionista ou personal): entra como segundo profissional.
    if (eu.coachUid && eu.coachUid !== doc.id && ['treino', 'dieta'].includes(body.parte)) return profissionais({ acao: 'parceiro_entrar', codigo, parte: body.parte }, uid, db, eu);
    await dir.doc(uid).set({ coachUid: doc.id }, { merge: true });
    await marcarConvite(db, doc.id, uid, body.convite, ctx.email).catch(() => {});
    return [200, { coach: { uid: doc.id, nome: doc.data().nome, foto: doc.data().foto || '' } }];
  }

  if (acao === 'contatos') {
    if (eu.papel === 'coach') {
      const alunos = await meusAlunos(db, uid);
      return [200, { papel: 'coach', codigo: eu.codigo, eu: { nome: eu.nome, foto: eu.foto || '' }, marca: marcaLimpa(eu.marca), contatos: alunos.map((d) => ({ uid: d.id, nome: d.data().nome, foto: d.data().foto || '', ...(d.data().coachUid === uid ? {} : { parte: d.data().parceiroParte }) })) }];
    }
    if (!eu.coachUid) return [200, { papel: 'aluno', contatos: [] }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    const contatos = [{ uid: eu.coachUid, nome: c.nome || 'Seu coach', foto: c.foto || '' }];
    if (eu.parceiroUid) {
      const pc = (await dir.doc(eu.parceiroUid).get()).data?.() || {};
      contatos.push({ uid: eu.parceiroUid, nome: pc.nome || 'Profissional', foto: pc.foto || '', parte: eu.parceiroParte });
    }
    return [200, { papel: 'aluno', marca: marcaLimpa(c.marca), contatos }];
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
  const vinculados = dOutro && ((eu.papel === 'aluno' && (eu.coachUid === outro || eu.parceiroUid === outro) && dOutro.papel === 'coach') || (eu.papel === 'coach' && !!vinculoDe(uid, dOutro)));
  if (!vinculados) return [403, { error: 'Você só conversa com o seu coach ou com os seus alunos.' }];
  const msgs = db.collection('bc_conversas').doc(par(uid, outro)).collection('mensagens');

  if (acao === 'enviar') {
    const texto = limpa(body.texto, 1500);
    if (!texto) return [400, { error: 'Escreva a mensagem.' }];
    const m = { de: uid, texto, em: Date.now() };
    const ref = await msgs.add(m);
    await avisarConversa(db, outro, eu.nome, texto);
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
    await avisarConversa(db, outro, eu.nome, `📅 Avaliação marcada para ${dataBR(data)}${hora ? ` às ${hora}` : ''}.`);
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
    await avisarConversa(db, outro, eu.nome, texto);
    return [200, { mensagem: { id: r.id, ...m } }];
  }
  // Ficha e dieta do aluno montadas pelo coach: o coach lê o questionário do aluno e grava no perfil dele.
  if (acao === 'prescricao_ver') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach monta a ficha do aluno.' }];
    const p = (await db.collection('bodycoach_users').doc(outro).collection('profile').doc('main').get().catch(() => null))?.data?.() || {};
    // O parceiro vê a anamnese do coach principal (saúde, lesões) e só edita a parte dele.
    const v = vinculoDe(uid, dOutro);
    const principal = v.tipo === 'parceiro' ? ((await dir.doc(dOutro.coachUid).get()).data?.() || {}) : eu;
    const outroProf = v.tipo === 'parceiro' ? principal : (dOutro.parceiroUid ? ((await dir.doc(dOutro.parceiroUid).get()).data?.() || {}) : null);
    return [200, {
      vinculo: v.tipo,
      pode: { ficha: podeEditar(uid, dOutro, 'ficha'), dieta: podeEditar(uid, dOutro, 'dieta') },
      equipe: outroProf ? { nome: outroProf.nome || 'Profissional', parte: dOutro.parceiroParte, principal: v.tipo === 'parceiro' } : null,
      nome: dOutro.nome || 'Aluno',
      foto: dOutro.foto || '',
      respostas: { ...(p.onboarding || {}), mobility: Array.isArray(p.mobility) ? p.mobility : [] },
      ficha: p.ficha_coach || null,
      fichaDia: Number(p.ficha_coach_dia) || 0,
      plano: p.plano_nutri || null,
      anamnese: principal.anamnese ? { perguntas: principal.anamnese.perguntas, respostas: (dOutro.anamneseResp && dOutro.anamneseResp.respostas) || {}, em: (dOutro.anamneseResp && dOutro.anamneseResp.em) || null, situacao: situacaoAnamnese(principal, dOutro) } : null,
    }];
  }
  if (acao === 'ficha_salvar' || acao === 'dieta_salvar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach monta a ficha do aluno.' }];
    const ficha = acao === 'ficha_salvar';
    if (!podeEditar(uid, dOutro, ficha ? 'ficha' : 'dieta')) return [403, { error: ficha ? 'O treino deste aluno é com o outro profissional da equipe.' : 'A alimentação deste aluno é com o outro profissional da equipe.' }];
    if (body.remover) {
      await db.collection('bodycoach_users').doc(outro).collection('profile').doc('main').set(ficha ? { ficha_coach: null, ficha_coach_dia: 0 } : { plano_nutri: null }, { merge: true });
      return [200, { ok: true }];
    }
    const valor = ficha ? fichaLimpa(body.ficha) : planoLimpo(body.plano, eu.nome);
    if (!valor) return [400, { error: ficha ? 'Coloque pelo menos um exercício na ficha.' : 'Coloque pelo menos um alimento no plano.' }];
    if (JSON.stringify(valor).length > 60000) return [400, { error: 'Ficou grande demais. Tire alguns itens.' }];
    const mensagem = await gravarPrescricao(outro, ficha ? 'ficha' : 'dieta', valor);
    return [200, { ok: true, mensagem }];
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
      lista('daily_readiness', 'date').catch(() => []), lista('meals', 'created_at').catch(() => []),
    ]);
    return [200, { resumo: resumirSemana({ treinos, pesos, prontidao, refeicoes }, desde, dOutro) }];
  }
  if (acao === 'video_enviar') {
    if (!videoOk(body.video)) return [400, { error: 'Vídeo inválido ou grande demais (máximo ~10 segundos).' }];
    const ref = await db.collection('bc_videos').add({ de: uid, para: outro, video: body.video, em: Date.now() });
    const m = { de: uid, texto: limpa(body.texto, 300), video: ref.id, em: Date.now() };
    const r = await msgs.add(m);
    await avisarConversa(db, outro, eu.nome, `🎥 ${m.texto || 'Mandou um vídeo'}`);
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
exports.lojaVer = lojaVer;
exports.resumirSemana = resumirSemana;

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  // Link público de avaliação: o único pedido sem login (o token aleatório é a chave, e vence sozinho).
  // Loja pública do coach (vitrine dos programas): sem login, só dados públicos.
  if (body && body.acao === 'loja_ver') {
    try {
      const { db } = require('./firebase-init');
      if (!db) return resposta(event, 503, { error: 'Indisponível agora.' });
      const [status, out] = await lojaVer(body, db);
      return resposta(event, status, out);
    } catch {
      return resposta(event, 503, { error: 'Indisponível agora. Tente de novo.' });
    }
  }
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
  if (['enviar', 'perfil', 'vincular', 'video_enviar', 'demo_salvar', 'feedback_enviar', 'desafio_criar', 'desafio_checkin', 'comentar', 'agendar_avaliacao', 'compartilhar_criar', 'dupla_criar', 'dupla_entrar', 'pix_config', 'pagamento_avisar', 'ranking_config', 'treino_feito', 'ficha_salvar', 'dieta_salvar', 'anamnese_salvar', 'anamnese_responder', 'modelo_salvar', 'modelo_apagar', 'modelo_aplicar', 'push_assinar', 'push_prefs', 'push_testar', 'pagamento_lembrar', 'programa_salvar', 'compra_criar', 'compra_avisar', 'compra_confirmar', 'feed_postar', 'feed_curtir', 'parceiro_entrar', 'marca_salvar', 'convites_importar'].includes(body.acao)) {
    const rl = await checkRateLimit(auth.uid, 'body-coach-chat');
    if (!rl.ok) return resposta(event, 429, { error: 'Muitos pedidos seguidos. Aguarde um instante.' });
  }
  try {
    const { db } = require('./firebase-init');
    if (!db) return resposta(event, 503, { error: 'Conversa indisponível agora.' });
    const [status, out] = await executar(body, auth.uid, db, { master: auth.role === 'master', email: auth.email });
    return resposta(event, status, out);
  } catch {
    return resposta(event, 503, { error: 'Conversa indisponível agora. Tente de novo.' });
  }
};
