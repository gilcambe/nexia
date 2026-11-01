'use strict';

const { meusAlunos } = require('./profissionais');

// NEXIA Body Coach — acesso: teste grátis, aviso antes de acabar, bloqueio no servidor e liberação pelo admin (Pix, sem gateway).
// bc_config/acesso: { diasGratis, diasGratisCoach, isentos: [emails], pix, pixNome }.
// bc_acesso/{uid}: { tipo, inicio, gratisAte, pagoAte, faixa, plano, cobertos, cobertoAte, fimDia, email, aparelhos, removidos }.
const DIA = 86400000;
const AVISO_DIAS = 3;
const MAX_APARELHOS = 2;
const SEMPRE_ISENTOS = ['gcbezerra@gmail.com']; // admin do NEXIA nunca fica bloqueado
const diaBR = (t) => new Date(t - 3 * 3600000).toISOString().slice(0, 10);

async function configAcesso(db) {
  const c = (await db.collection('bc_config').doc('acesso').get()).data?.() || {};
  return {
    diasGratis: Number(c.diasGratis) > 0 ? Math.round(Number(c.diasGratis)) : 7,
    diasGratisCoach: Number(c.diasGratisCoach) > 0 ? Math.round(Number(c.diasGratisCoach)) : 30,
    isentos: [...SEMPRE_ISENTOS, ...(Array.isArray(c.isentos) ? c.isentos.map((e) => String(e).trim().toLowerCase()) : [])],
    pix: String(c.pix || ''),
    pixNome: String(c.pixNome || ''),
    promo: c.promo && Number(c.promo.pct) > 0 ? { pct: Number(c.promo.pct), ate: Number(c.promo.ate) || 0, texto: String(c.promo.texto || '') } : null,
  };
}

// Faixas do coach (plano Completo): quantos alunos ficam grátis. Sem pagar, o coach cobre 3 alunos para sempre.
const FAIXAS = { 3: 'Grátis', 15: 'R$ 49', 40: 'R$ 89', 9999: 'R$ 149' };
const GRACA_DIAS = 7; // coach parou de pagar: o aluno ainda usa 7 dias e é avisado

function limiteDoCoach(a, isento, agora) {
  if ((a.plano || 'completo') === 'parceiro') return 0; // no Parceiro cada aluno paga o próprio Premium
  if (isento || (a.gratisAte || 0) > agora) return 9999; // teste do coach: alunos ilimitados
  if ((a.pagoAte || 0) > agora) return Number(a.faixa) > 3 ? Number(a.faixa) : 15;
  return 3;
}

// tipo: coach | aluno (de um coach) | independente (sem coach)
// situacao: isento | equipe (o coach paga) | pago | gratis | aviso (faltam 3 dias ou menos) | bloqueado (sem Premium) | basico (coach sem pagar)
async function acessoDe(db, uid, ctx = {}, agora = Date.now()) {
  const cfg = await configAcesso(db);
  const tipo = ctx.papel === 'coach' ? 'coach' : ctx.coachUid ? 'aluno' : 'independente';
  const ref = db.collection('bc_acesso').doc(uid);
  let a = (await ref.get()).data?.();
  if (!a) {
    const gratisAte = agora + (tipo === 'coach' ? cfg.diasGratisCoach : cfg.diasGratis) * DIA;
    a = { inicio: agora, gratisAte, pagoAte: 0, fimDia: diaBR(gratisAte), email: String(ctx.email || '').toLowerCase(), tipo };
    await ref.set(a);
  } else if ((ctx.email && a.email !== String(ctx.email).toLowerCase()) || a.tipo !== tipo) {
    a.email = ctx.email ? String(ctx.email).toLowerCase() : a.email || '';
    a.tipo = tipo;
    await ref.set({ email: a.email, tipo }, { merge: true });
  }
  const isento = !!(ctx.master || a.isento || (a.email && cfg.isentos.includes(a.email)));
  const base = { tipo, gratisAte: a.gratisAte || 0, pagoAte: a.pagoAte || 0, pix: cfg.pix, pixNome: cfg.pixNome, testador: !!a.testador };
  if (tipo === 'coach') {
    const limite = limiteDoCoach(a, isento, agora);
    const situacao = isento ? 'isento' : base.pagoAte > agora ? 'pago' : base.gratisAte > agora ? 'gratis' : 'basico';
    const fim = Math.max(base.gratisAte, base.pagoAte);
    return { ...base, situacao, plano: a.plano || 'completo', limite, cobertos: (a.cobertos || []).length, dias: fim > agora ? Math.ceil((fim - agora) / DIA) : 0 };
  }
  if (isento) return { ...base, situacao: 'isento', dias: null };
  if (tipo === 'aluno' && ctx.coachUid !== uid && await cobertoPeloCoach(db, uid, ctx.coachUid, agora)) {
    if (!a.cobertoAte || agora - a.cobertoAte > DIA) await ref.set({ cobertoAte: agora, fimDia: diaBR(agora + GRACA_DIAS * DIA) }, { merge: true });
    return { ...base, situacao: 'equipe', dias: null };
  }
  const graca = a.cobertoAte ? a.cobertoAte + GRACA_DIAS * DIA : 0;
  const fim = Math.max(base.gratisAte, base.pagoAte, graca);
  if (fim <= agora) return { ...base, situacao: 'bloqueado', dias: 0 };
  const dias = Math.ceil((fim - agora) / DIA);
  const motivo = graca === fim && graca > Math.max(base.gratisAte, base.pagoAte) ? 'coach' : '';
  return { ...base, situacao: dias <= AVISO_DIAS || motivo ? 'aviso' : base.pagoAte > agora ? 'pago' : 'gratis', dias, motivo };
}

// O aluno ocupa uma vaga da faixa do coach (os primeiros que entraram ficam com as vagas).
async function cobertoPeloCoach(db, uid, coachUid, agora) {
  const ref = db.collection('bc_acesso').doc(coachUid);
  const c = await acessoDe(db, coachUid, { papel: 'coach' }, agora);
  if (!c.limite) return false;
  const cobertos = ((await ref.get()).data?.() || {}).cobertos || [];
  const pos = cobertos.indexOf(uid);
  if (pos >= 0) return pos < c.limite;
  if (cobertos.length >= c.limite) return false;
  await ref.set({ cobertos: [...cobertos, uid] }, { merge: true });
  return true;
}

// Admin confirmou o Pix: soma os dias a partir de hoje (ou do fim do que já estava pago).
// faixa (só coach): 15, 40 ou 9999 alunos. valor: quanto entrou (para a receita do mês).
async function liberarAcesso(db, uid, dias, agora = Date.now(), extra = {}) {
  const ref = db.collection('bc_acesso').doc(uid);
  const a = (await ref.get()).data?.() || {};
  const pagoAte = Math.max(agora, a.pagoAte || 0) + Math.round(dias) * DIA;
  const faixa = FAIXAS[extra.faixa] && Number(extra.faixa) > 3 ? Number(extra.faixa) : a.faixa || 0;
  await ref.set({ pagoAte, faixa, fimDia: diaBR(Math.max(pagoAte, a.gratisAte || 0)) }, { merge: true });
  const valor = Number(extra.valor) > 0 ? Math.round(Number(extra.valor) * 100) / 100 : 0;
  await db.collection('bc_acesso_pagamentos').add({ uid, email: a.email || '', dias: Math.round(dias), faixa, valor, mes: diaBR(agora).slice(0, 7), em: agora });
  return pagoAte;
}

// Uma conta em no máximo 2 aparelhos: o 3º derruba o mais antigo, que recebe sair=true na próxima vez.
async function registrarAparelho(db, uid, aparelho, agora = Date.now()) {
  const id = typeof aparelho === 'string' ? aparelho.trim().slice(0, 40) : '';
  if (!id) return { sair: false };
  const ref = db.collection('bc_acesso').doc(uid);
  const a = (await ref.get()).data?.() || {};
  let lista = Array.isArray(a.aparelhos) ? a.aparelhos.filter((x) => x && x.id) : [];
  let removidos = Array.isArray(a.removidos) ? a.removidos : [];
  if (removidos.includes(id)) {
    await ref.set({ removidos: removidos.filter((x) => x !== id) }, { merge: true });
    return { sair: true };
  }
  const tinha = lista.some((x) => x.id === id);
  lista = [{ id, em: agora }, ...lista.filter((x) => x.id !== id)];
  if (!tinha && lista.length > MAX_APARELHOS) {
    removidos = [...removidos, ...lista.slice(MAX_APARELHOS).map((x) => x.id)].slice(-10);
    lista = lista.slice(0, MAX_APARELHOS);
  }
  const hoje = diaBR(agora);
  const mergeData = { aparelhos: lista, removidos };
  if (a.ultimoUso !== hoje) {
    mergeData.ultimoUso = hoje;
    // uso do dia (gráfico do Painel do dono): cada conta conta uma vez por dia
    const u = db.collection('bc_uso').doc(hoje);
    const atual = (await u.get()).data?.() || {};
    await u.set({ dia: hoje, ativos: (Number(atual.ativos) || 0) + 1 }, { merge: true });
  }
  await ref.set(mergeData, { merge: true });
  return { sair: false };
}

// Bloqueio no servidor: guarda a resposta por 10 min em memória para não gastar leituras do banco grátis a cada pedido.
const cache = new Map();
async function estaBloqueado(db, uid, ctx = {}, agora = Date.now()) {
  const c = cache.get(uid);
  if (c && c.ate > agora) return c.bloqueado;
  const ac = await acessoDe(db, uid, ctx, agora);
  cache.set(uid, { bloqueado: ac.situacao === 'bloqueado', ate: agora + 10 * 60000 });
  return ac.situacao === 'bloqueado';
}
const LIVRES = ['perfil', 'contatos', 'feedback_enviar', 'push_assinar', 'push_prefs'];

// Cupom de desconto (bc_cupons/{CODIGO}): vale até validoAte e até maxUsos (0 = sem limite).
const limparCodigo = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
async function cupomValido(db, codigo) {
  const id = limparCodigo(codigo);
  if (id.length < 3) return null;
  const c = (await db.collection('bc_cupons').doc(id).get()).data?.();
  if (!c || !(c.validoAte > Date.now()) || (c.maxUsos > 0 && (c.usos || 0) >= c.maxUsos)) return null;
  return { ...c, codigo: id };
}

// Testador do app Android (teste fechado do Google Play): uma vez por conta ganha 30 dias de Premium.
// bc_testadores/{uid}: { uid, email, nome, em, dia }. O Premium sai pelo mesmo caminho do presente do dono (liberarAcesso, valor 0).
const DIAS_TESTADOR = 30;
async function virarTestador(db, uid, ctx = {}, eu = null, agora = Date.now()) {
  const ref = db.collection('bc_testadores').doc(uid);
  const ja = (await ref.get()).data?.();
  if (ja) return [200, { ok: true, jaGanhou: true, em: ja.em || 0 }];
  const email = String(ctx.email || '').trim().toLowerCase();
  // grava antes de liberar: um segundo clique rápido já encontra o registro
  await ref.set({ uid, email, nome: (eu && eu.nome) || '', em: agora, dia: diaBR(agora) });
  const pagoAte = await liberarAcesso(db, uid, DIAS_TESTADOR, agora, { valor: 0 });
  await db.collection('bc_acesso').doc(uid).set({ testador: agora }, { merge: true });
  cache.delete(uid);
  return [200, { ok: true, jaGanhou: false, dias: DIAS_TESTADOR, pagoAte }];
}

// Ações acesso_*: ver (todos), paguei (todos), lista/liberar/isento/config (só o admin).
async function acoesAcesso(body, uid, db, ctx = {}, eu = null) {
  const acao = body.acao;
  const coachUid = eu && eu.papel === 'aluno' ? eu.coachUid || '' : '';
  if (acao === 'acesso_ver') {
    const ac = await acessoDe(db, uid, { ...ctx, coachUid, papel: eu && eu.papel });
    cache.delete(uid);
    const ap = ctx.master ? { sair: false } : await registrarAparelho(db, uid, body.aparelho);
    const { promo } = await configAcesso(db);
    return [200, { ...ac, ...ap, master: !!ctx.master || SEMPRE_ISENTOS.includes(String(ctx.email || '').toLowerCase()), papel: (eu && eu.papel) || 'nenhum', ...(promo && promo.ate > Date.now() ? { promo } : {}) }];
  }
  if (acao === 'cupom_ver') {
    const c = await cupomValido(db, body.codigo);
    return c ? [200, { pct: Number(c.pct) || 0, codigo: c.codigo, ...(c.diasGratis > 0 ? { dias: c.diasGratis } : {}) }] : [404, { error: 'Cupom inválido ou vencido.' }];
  }
  // Convite de "dias grátis": soma os dias ao teste da conta, uma vez por conta. Cupom de % fica para o Pix.
  if (acao === 'cupom_usar') {
    const c = await cupomValido(db, body.codigo);
    if (!c) return [404, { error: 'Convite inválido ou vencido.' }];
    if (!(c.diasGratis > 0)) return [200, { ok: true, pct: Number(c.pct) || 0, codigo: c.codigo }];
    await acessoDe(db, uid, { ...ctx, coachUid, papel: eu && eu.papel });
    const ref = db.collection('bc_acesso').doc(uid);
    const a = (await ref.get()).data?.() || {};
    if (a.cupomDias) return [200, { ok: true, jaUsado: true, codigo: c.codigo, gratisAte: a.gratisAte || 0 }];
    const agora = Date.now();
    const gratisAte = Math.max(agora, a.gratisAte || 0) + Math.round(c.diasGratis) * DIA;
    await ref.set({ gratisAte, cupomDias: c.codigo, fimDia: diaBR(Math.max(gratisAte, a.pagoAte || 0)) }, { merge: true });
    await db.collection('bc_cupons').doc(c.codigo).set({ usos: (c.usos || 0) + 1 }, { merge: true });
    cache.delete(uid);
    return [200, { ok: true, dias: c.diasGratis, codigo: c.codigo, gratisAte }];
  }
  if (acao === 'acesso_paguei') {
    const c = body.cupom ? await cupomValido(db, body.cupom) : null;
    const plano = ['mensal', 'anual'].includes(body.plano) ? body.plano : '';
    const valor = Math.round(Math.min(1000, Math.max(0, Number(body.valor) || 0)) * 100) / 100;
    await db.collection('bc_acesso_pedidos').add({ uid, email: String(ctx.email || ''), nome: (eu && eu.nome) || '', em: Date.now(), ...(c ? { cupom: c.codigo, pct: c.pct } : {}), ...(plano ? { plano, valor, dias: plano === 'anual' ? 365 : 30 } : {}) });
    if (c) await db.collection('bc_cupons').doc(c.codigo).set({ usos: (c.usos || 0) + 1 }, { merge: true });
    return [200, { ok: true }];
  }
  if (acao === 'acesso_testador') return virarTestador(db, uid, ctx, eu);
  if (acao === 'acesso_plano') {
    if (!eu || eu.papel !== 'coach') return [403, { error: 'Só o coach escolhe o plano dos alunos.' }];
    const ref = db.collection('bc_acesso').doc(uid);
    if (body.plano === 'completo' || body.plano === 'parceiro') await ref.set({ plano: body.plano }, { merge: true });
    // tira da lista de vagas quem já não é mais aluno deste coach
    const alunos = (await meusAlunos(db, uid)).map((d) => d.id);
    const cobertos = (((await ref.get()).data?.() || {}).cobertos || []).filter((x) => alunos.includes(x));
    await ref.set({ cobertos }, { merge: true });
    cache.clear();
    const ac = await acessoDe(db, uid, { ...ctx, papel: 'coach' });
    return [200, { ...ac, alunos: alunos.length, cobertos: cobertos.length, faixas: FAIXAS }];
  }
  return acoesAdmin(body, db, ctx);
}

// Painel do dono: contas por tipo, pagantes, cadastros e uso por dia, receita por mês.
async function resumoDono(db, col, agora = Date.now()) {
  const contas = (await col.orderBy('inicio', 'desc').limit(3000).get()).docs.map((d) => d.data());
  const dias = Array.from({ length: 30 }, (_, i) => diaBR(agora - (29 - i) * DIA));
  const meses = [...new Set(Array.from({ length: 200 }, (_, i) => diaBR(agora - i * DIA).slice(0, 7)))].slice(0, 6).reverse();
  const porTipo = { coach: 0, aluno: 0, independente: 0 };
  const novos = Object.fromEntries(dias.map((d) => [d, 0]));
  let pagantes = 0, emTeste = 0, vencendo7 = 0;
  for (const c of contas) {
    porTipo[c.tipo === 'coach' || c.tipo === 'aluno' ? c.tipo : 'independente'] += 1;
    const pago = c.pagoAte > agora;
    if (pago) { pagantes += 1; if (c.pagoAte < agora + 7 * DIA) vencendo7 += 1; }
    else if (c.gratisAte > agora) emTeste += 1;
    const d = c.inicio ? diaBR(c.inicio) : '';
    if (d in novos) novos[d] += 1;
  }
  const [uso, pags] = await Promise.all([
    Promise.all(dias.map((d) => db.collection('bc_uso').doc(d).get())),
    Promise.all(meses.map((m) => db.collection('bc_acesso_pagamentos').where('mes', '==', m).limit(1000).get())),
  ]);
  const receitaPorMes = meses.map((mes, i) => ({ mes, valor: pags[i].docs.reduce((t, x) => t + (Number(x.data().valor) || 0), 0) }));
  return {
    total: contas.length, porTipo, pagantes, emTeste, vencendo7,
    novosPorDia: dias.map((dia) => ({ dia, n: novos[dia] })),
    ativosPorDia: dias.map((dia, i) => ({ dia, n: Number((uso[i].data?.() || {}).ativos) || 0 })),
    receitaPorMes, receitaMes: receitaPorMes[receitaPorMes.length - 1].valor,
  };
}

// Só o admin: lista de contas e receita, liberar dias (e faixa do coach), isentar e regras.
async function acoesAdmin(body, db, ctx) {
  const acao = body.acao;
  const admin = ctx.master || SEMPRE_ISENTOS.includes(String(ctx.email || '').toLowerCase());
  if (!admin) return [403, { error: 'Só o administrador mexe nos acessos.' }];
  const col = db.collection('bc_acesso');
  if (acao === 'acesso_lista') {
    const [contas, pedidos, config, pagamentos] = await Promise.all([
      col.orderBy('inicio', 'desc').limit(300).get(),
      db.collection('bc_acesso_pedidos').orderBy('em', 'desc').limit(50).get(),
      configAcesso(db),
      db.collection('bc_acesso_pagamentos').where('mes', '==', diaBR(Date.now()).slice(0, 7)).limit(500).get(),
    ]);
    const lista = contas.docs.map((d) => { const x = d.data(); return { uid: d.id, email: x.email || '', tipo: x.tipo || 'independente', inicio: x.inicio || 0, gratisAte: x.gratisAte || 0, pagoAte: x.pagoAte || 0, cobertoAte: x.cobertoAte || 0, faixa: x.faixa || 0, plano: x.plano || '', isento: !!x.isento }; });
    const receitaMes = pagamentos.docs.reduce((t, d) => t + (Number(d.data().valor) || 0), 0);
    return [200, { contas: lista, pedidos: pedidos.docs.map((d) => ({ id: d.id, ...d.data() })), config, receitaMes, faixas: FAIXAS }];
  }
  let alvo = typeof body.uid === 'string' ? body.uid.slice(0, 128) : '';
  if (!alvo && typeof body.email === 'string' && body.email.includes('@')) {
    const snap = await col.where('email', '==', body.email.trim().toLowerCase()).limit(1).get();
    alvo = snap.docs[0] ? snap.docs[0].id : '';
  }
  if (acao === 'acesso_liberar') {
    const dias = Number(body.dias);
    if (!alvo) return [404, { error: 'Não achei essa conta. A pessoa precisa abrir o app uma vez.' }];
    if (!(dias >= 1 && dias <= 400)) return [400, { error: 'Dias entre 1 e 400.' }];
    const pagoAte = await liberarAcesso(db, alvo, dias, Date.now(), { faixa: body.faixa, valor: body.valor });
    if (Number(body.valor) > 0) await require('./indicacao').premiarIndicacao(db, alvo, liberarAcesso).catch(() => {});
    cache.clear(); // os alunos do coach mudam junto
    return [200, { ok: true, uid: alvo, pagoAte }];
  }
  if (acao === 'acesso_isento') {
    if (!alvo) return [404, { error: 'Não achei essa conta.' }];
    await col.doc(alvo).set({ isento: body.isento === true }, { merge: true });
    cache.delete(alvo);
    return [200, { ok: true }];
  }
  if (acao === 'dono_presente') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return [400, { error: 'E-mail inválido.' }];
    const dias = Number(body.dias) > 0 ? Math.round(Number(body.dias)) : 30;
    const snap = await col.where('email', '==', email).limit(1).get();
    if (!snap.docs[0]) return [404, { error: 'Essa pessoa ainda não entrou no app.' }];
    const uidAlvo = snap.docs[0].id;
    const pagoAte = await liberarAcesso(db, uidAlvo, dias, Date.now(), { valor: 0 });
    await col.doc(uidAlvo).set({ presente: true }, { merge: true });
    cache.clear();
    return [200, { ok: true, uid: uidAlvo, pagoAte }];
  }
  if (acao === 'acesso_testadores') {
    const snap = await db.collection('bc_testadores').orderBy('em', 'desc').limit(200).get();
    return [200, { testadores: snap.docs.map((d) => { const x = d.data(); return { uid: d.id, email: x.email || '', nome: x.nome || '', em: x.em || 0 }; }) }];
  }
  if (acao === 'dono_resumo') return [200, await resumoDono(db, col)];
  if (acao === 'cupom_criar') {
    const codigo = limparCodigo(body.codigo);
    const pct = Math.round(Number(body.pct));
    if (codigo.length < 3) return [400, { error: 'O código precisa de 3 a 20 letras ou números.' }];
    if (!(pct >= 5 && pct <= 90)) return [400, { error: 'O desconto vai de 5% a 90%.' }];
    const dias = Number(body.dias) > 0 ? Math.round(Number(body.dias)) : 30;
    const cupom = { codigo, pct, validoAte: Date.now() + dias * DIA, maxUsos: Math.max(0, Math.round(Number(body.maxUsos) || 0)), usos: 0, criadoEm: Date.now() };
    await db.collection('bc_cupons').doc(codigo).set(cupom);
    return [200, { cupom }];
  }
  // Convite com desconto em 2 toques: o dono escolhe "20%" ou "30 dias grátis" e o código nasce sozinho (1 uso, vale 30 dias).
  if (acao === 'cupom_convite') {
    const dias = body.tipo === 'dias';
    const valor = Math.round(Number(body.valor) || (dias ? 30 : 20));
    if (dias ? !(valor >= 1 && valor <= 90) : !(valor >= 5 && valor <= 90)) return [400, { error: dias ? 'De 1 a 90 dias grátis.' : 'O desconto vai de 5% a 90%.' }];
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 4 && !codigo; i++) {
      const tent = 'CV' + Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
      if (!(await db.collection('bc_cupons').doc(tent).get()).data?.()) codigo = tent;
    }
    if (!codigo) return [500, { error: 'Tente de novo.' }];
    const cupom = { codigo, pct: dias ? 0 : valor, ...(dias ? { diasGratis: valor } : {}), validoAte: Date.now() + 30 * DIA, maxUsos: 1, usos: 0, criadoEm: Date.now(), convite: true };
    await db.collection('bc_cupons').doc(codigo).set(cupom);
    return [200, { cupom }];
  }
  if (acao === 'cupom_lista') {
    const snap = await db.collection('bc_cupons').orderBy('criadoEm', 'desc').limit(50).get();
    return [200, { cupons: snap.docs.map((d) => d.data()) }];
  }
  if (acao === 'promo_salvar') {
    const pct = Math.round(Number(body.pct) || 0);
    if (pct && !(pct >= 5 && pct <= 90)) return [400, { error: 'O desconto vai de 5% a 90%.' }];
    const promo = pct ? { pct, ate: Number(body.ate) || Date.now() + 7 * DIA, texto: String(body.texto || '').slice(0, 120) } : null;
    await db.collection('bc_config').doc('acesso').set({ promo }, { merge: true });
    return [200, { promo }];
  }
  if (acao === 'acesso_config') {
    const atual = await configAcesso(db);
    const dias = Number(body.diasGratis);
    const novo = {
      diasGratis: dias >= 1 && dias <= 365 ? Math.round(dias) : atual.diasGratis,
      diasGratisCoach: Number(body.diasGratisCoach) >= 1 && Number(body.diasGratisCoach) <= 365 ? Math.round(Number(body.diasGratisCoach)) : atual.diasGratisCoach,
      pix: typeof body.pix === 'string' ? body.pix.trim().slice(0, 120) : atual.pix,
      pixNome: typeof body.pixNome === 'string' ? body.pixNome.trim().slice(0, 60) : atual.pixNome,
      isentos: Array.isArray(body.isentos) ? body.isentos.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@') && !SEMPRE_ISENTOS.includes(e)).slice(0, 100) : atual.isentos.filter((e) => !SEMPRE_ISENTOS.includes(e)),
    };
    await db.collection('bc_config').doc('acesso').set(novo, { merge: true });
    return [200, { ok: true, config: novo }];
  }
  return [400, { error: 'Ação desconhecida.' }];
}

module.exports = { resumoDono, DIAS_TESTADOR, virarTestador, FAIXAS, GRACA_DIAS, acessoDe, liberarAcesso, registrarAparelho, configAcesso, estaBloqueado, acoesAcesso, diaBR, LIVRES, AVISO_DIAS, MAX_APARELHOS };
