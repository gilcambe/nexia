'use strict';

// NEXIA Body Coach — equipe de profissionais, convites em lote e marca do coach (chamado por body-coach-chat.js).
// Parceiro: o aluno tem o coach principal (coachUid) e pode ter um segundo profissional (parceiroUid) que cuida
// de uma parte só: 'treino' (personal) ou 'dieta' (nutricionista). Cada um edita só a sua parte; os dois conversam com o aluno.
// Convites: o coach cola a planilha (nome, e-mail, telefone), o servidor guarda a lista e marca quem já entrou.
// Marca: nome, cor e logo do coach aparecem no app dos alunos dele (grátis, é só tema do próprio PWA).

const { avisarConversa } = require('./push');

const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const par = (a, b) => [a, b].sort().join('__');
const PARTES = ['treino', 'dieta'];
const MINHA_PARTE = { treino: 'do meu treino', dieta: 'da minha alimentação' };
const CORES = ['laranja', 'azul', 'verde', 'roxo', 'rosa', 'vermelho', 'turquesa', 'grafite'];
const LOGO_OK = (v) => typeof v === 'string' && v.length < 80000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
const EMAIL_OK = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const MAX_CONVITES = 300;

// Como este profissional está ligado ao aluno: principal, parceiro (com a parte) ou nada.
function vinculoDe(uid, aluno) {
  if (!aluno) return null;
  if (aluno.coachUid === uid) return { tipo: 'principal' };
  if (aluno.parceiroUid === uid && PARTES.includes(aluno.parceiroParte)) return { tipo: 'parceiro', parte: aluno.parceiroParte };
  return null;
}
// Pode mexer na ficha ('ficha') ou na dieta ('dieta') deste aluno? A parte do parceiro é só dele.
function podeEditar(uid, aluno, tipo) {
  const v = vinculoDe(uid, aluno);
  if (!v) return false;
  const parte = tipo === 'ficha' ? 'treino' : 'dieta';
  if (v.tipo === 'parceiro') return v.parte === parte;
  return !(aluno.parceiroUid && aluno.parceiroParte === parte);
}
// Alunos deste profissional: os dele e os que ele atende como parceiro (duas consultas simples, sem índice novo).
async function meusAlunos(db, uid) {
  const dir = db.collection('bc_diretorio');
  const [a, b] = await Promise.all([
    dir.where('coachUid', '==', uid).limit(100).get(),
    dir.where('parceiroUid', '==', uid).limit(100).get().catch(() => ({ docs: [] })),
  ]);
  const vistos = new Set();
  return [...a.docs, ...b.docs].filter((d) => (vistos.has(d.id) ? false : vistos.add(d.id)));
}

function marcaLimpa(m) {
  if (!m || typeof m !== 'object') return null;
  const nome = limpa(m.nome, 40);
  const cor = CORES.includes(m.cor) ? m.cor : 'laranja';
  const logo = LOGO_OK(m.logo) ? m.logo : '';
  return nome || logo || cor !== 'laranja' ? { nome, cor, logo } : null;
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
function telefoneLimpo(v) {
  let t = soDigitos(v);
  if (t.length === 10 || t.length === 11) t = `55${t}`;
  return t.length >= 12 && t.length <= 13 ? t : '';
}

async function mensagem(db, de, para, deNome, texto, tipo) {
  await db.collection('bc_conversas').doc(par(de, para)).collection('mensagens').add({ de, texto, em: Date.now(), ...(tipo ? { tipo } : {}) });
  await avisarConversa(db, para, deNome, texto);
}

// Marca o convite como aceito: pelo id do link (?c=) ou pelo e-mail da conta.
async function marcarConvite(db, coachUid, alunoUid, conviteId, email) {
  const col = db.collection('bc_convites');
  const id = limpa(conviteId, 60).replace(/[^a-zA-Z0-9_-]/g, '');
  if (id) {
    const d = (await col.doc(id).get()).data?.();
    if (d && d.coachUid === coachUid) { await col.doc(id).set({ entrou: Date.now(), alunoUid }, { merge: true }); return; }
  }
  const e = limpa(email, 120).toLowerCase();
  if (!e) return;
  const snap = await col.where('email', '==', e).limit(10).get().catch(() => ({ docs: [] }));
  for (const d of snap.docs) if (d.data().coachUid === coachUid && !d.data().entrou) await col.doc(d.id).set({ entrou: Date.now(), alunoUid }, { merge: true });
}

async function profissionais(body, uid, db, eu) {
  const acao = body.acao;
  const dir = db.collection('bc_diretorio');

  // ── Segundo profissional (lado do aluno) ──
  if (acao === 'parceiro_entrar') {
    if (eu.papel !== 'aluno' || !eu.coachUid) return [403, { error: 'Primeiro entre na equipe do seu coach principal.' }];
    const parte = PARTES.includes(body.parte) ? body.parte : '';
    if (!parte) return [400, { error: 'Escolha se ele cuida do treino ou da alimentação.' }];
    const codigo = limpa(body.codigo, 10).toUpperCase();
    if (codigo.length < 4) return [400, { error: 'Digite o código do profissional.' }];
    const achados = await dir.where('codigo', '==', codigo).limit(1).get();
    const doc = achados.docs && achados.docs[0];
    if (!doc || doc.data().papel !== 'coach') return [404, { error: 'Não achei esse código. Confira com o profissional.' }];
    if (doc.id === eu.coachUid) return [409, { error: 'Esse já é o seu coach principal.' }];
    const p = doc.data();
    await dir.doc(uid).set({ parceiroUid: doc.id, parceiroParte: parte }, { merge: true });
    await mensagem(db, uid, doc.id, eu.nome, `🤝 Entrei na sua equipe. Você cuida ${MINHA_PARTE[parte]}.`, 'equipe');
    await mensagem(db, uid, eu.coachUid, eu.nome, `🤝 ${p.nome || 'Um profissional'} agora cuida ${MINHA_PARTE[parte]}. Vocês dois me acompanham.`, 'equipe');
    return [200, { parceiro: { uid: doc.id, nome: p.nome || 'Profissional', foto: p.foto || '', parte } }];
  }
  if (acao === 'parceiro_sair') {
    if (eu.papel !== 'aluno' || !eu.parceiroUid) return [200, { ok: true }];
    await dir.doc(uid).set({ parceiroUid: '', parceiroParte: '' }, { merge: true });
    return [200, { ok: true }];
  }
  if (acao === 'equipe_minha') {
    if (eu.papel !== 'aluno') return [403, { error: 'Só para alunos.' }];
    const pega = async (id) => { if (!id) return null; const d = (await dir.doc(id).get()).data?.() || {}; return { uid: id, nome: d.nome || 'Profissional', foto: d.foto || '' }; };
    const [coach, parceiro] = await Promise.all([pega(eu.coachUid), pega(eu.parceiroUid)]);
    return [200, { coach, parceiro: parceiro ? { ...parceiro, parte: eu.parceiroParte } : null }];
  }
  // ── Lado do profissional: tirar o parceiro (o principal) ou deixar de atender (o parceiro) ──
  if (acao === 'parceiro_remover') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o profissional faz isso.' }];
    const aluno = limpa(body.aluno, 128);
    const a = (await dir.doc(aluno).get()).data?.();
    const v = vinculoDe(uid, a);
    if (!v || !a.parceiroUid) return [403, { error: 'Esse aluno não tem parceiro com você.' }];
    await dir.doc(aluno).set({ parceiroUid: '', parceiroParte: '' }, { merge: true });
    return [200, { ok: true }];
  }

  // ── Marca do coach ──
  if (acao === 'marca_salvar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach muda a marca.' }];
    if (body.logo && !LOGO_OK(body.logo)) return [400, { error: 'Logo inválido ou grande demais. Use uma imagem menor.' }];
    const marca = marcaLimpa(body);
    const extra = {};
    if (typeof body.bio === 'string') extra.bio = limpa(body.bio, 300);
    if (body.whats !== undefined) {
      const w = soDigitos(body.whats);
      if (w && (w.length < 10 || w.length > 13)) return [400, { error: 'WhatsApp inválido. Use DDD + número.' }];
      extra.whats = w;
    }
    await dir.doc(uid).set({ marca, ...extra }, { merge: true });
    return [200, { marca, ...extra, codigo: eu.codigo || '' }];
  }
  // Dados da página pública do coach (para a tela Minha marca abrir já preenchida).
  if (acao === 'marca_ver') {
    if (eu.papel !== 'coach') return [403, { error: 'Só para coach.' }];
    return [200, { marca: eu.marca || null, bio: eu.bio || '', whats: eu.whats || '', codigo: eu.codigo || '' }];
  }

  // ── Convites em lote ──
  if (!acao || !acao.startsWith('convite')) return null;
  if (eu.papel !== 'coach') return [403, { error: 'Só o coach convida alunos.' }];
  const col = db.collection('bc_convites');
  const meus = async () => (await col.where('coachUid', '==', uid).limit(MAX_CONVITES + 10).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  if (acao === 'convites_importar') {
    const entrada = (Array.isArray(body.lista) ? body.lista : []).slice(0, 200);
    const atuais = await meus();
    const jaTem = new Set(atuais.flatMap((c) => [c.email, c.telefone].filter(Boolean)));
    const novos = [];
    let repetidos = 0; let invalidos = 0;
    for (const x of entrada) {
      const nome = limpa(x && x.nome, 60);
      const email = limpa(x && x.email, 120).toLowerCase();
      const telefone = telefoneLimpo(x && x.telefone);
      const e = EMAIL_OK(email) ? email : '';
      if (!nome || (!e && !telefone)) { invalidos += 1; continue; }
      if ((e && jaTem.has(e)) || (telefone && jaTem.has(telefone))) { repetidos += 1; continue; }
      if (e) jaTem.add(e);
      if (telefone) jaTem.add(telefone);
      novos.push({ coachUid: uid, nome, email: e, telefone, em: Date.now() });
    }
    if (atuais.length + novos.length > MAX_CONVITES) return [409, { error: `Cabem até ${MAX_CONVITES} convites. Apague os antigos antes.` }];
    for (const n of novos) await col.add(n);
    return [200, { importados: novos.length, repetidos, invalidos }];
  }
  if (acao === 'convites_ver') {
    const lista = (await meus()).map((c) => ({ id: c.id, nome: c.nome, email: c.email || '', telefone: c.telefone || '', enviado: c.enviado || null, entrou: c.entrou || null }))
      .sort((a, b) => Number(!!a.entrou) - Number(!!b.entrou) || a.nome.localeCompare(b.nome));
    return [200, { convites: lista, codigo: eu.codigo, coach: (eu.marca && eu.marca.nome) || eu.nome || 'seu coach' }];
  }
  if (acao === 'convite_enviado' || acao === 'convite_apagar') {
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map((i) => limpa(i, 60).replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean).slice(0, 300);
    let n = 0;
    for (const id of ids) {
      const d = (await col.doc(id).get()).data?.();
      if (!d || d.coachUid !== uid) continue;
      if (acao === 'convite_apagar') await col.doc(id).delete();
      else await col.doc(id).set({ enviado: Date.now(), via: body.via === 'email' ? 'email' : 'whatsapp' }, { merge: true });
      n += 1;
    }
    return [200, { ok: true, n }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

module.exports = { profissionais, vinculoDe, podeEditar, meusAlunos, marcaLimpa, marcarConvite, telefoneLimpo, CORES };
