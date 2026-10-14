'use strict';

// NEXIA Body Coach — o negócio do coach, tudo por Pix direto (sem gateway, sem taxa):
// financeiro_ver (12 meses, quem falta pagar), pagamento_lembrar (no app e no celular),
// lembretes automáticos da mensalidade (3 dias antes, no dia, 3 dias depois — pelo cron),
// programas à venda numa loja com link (programa_*, loja_ver público, compra_*): o coach confirma o Pix
// e o programa (ficha + dieta de um modelo) cai no app do comprador, que entra na equipe.

const { avisar, avisarConversa } = require('./push');

const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const par = (a, b) => [a, b].sort().join('__');
const hojeBR = (t = Date.now()) => new Date(t - 3 * 3600000).toISOString().slice(0, 10);
const reais = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const dinheiro = (v) => { const n = Math.round((Number(v) || 0) * 100) / 100; return n >= 0 && n <= 100000 ? n : null; };
const mesesAte = (mes, n) => {
  const [a, m] = mes.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1)).toISOString().slice(0, 7));
};
const valorDo = (aluno, pix) => (aluno.valorMensal != null ? Number(aluno.valorMensal) : Number((pix && pix.valor) || 0));

// Situação da mensalidade do aluno neste mês (dias < 0 = atrasado).
function situacaoMes(aluno, pix, t = Date.now()) {
  const hoje = hojeBR(t);
  const mes = hoje.slice(0, 7);
  const p = (aluno.pagamentos || {})[mes] || {};
  const venc = Math.min(28, Math.max(1, Number(pix && pix.vencimento) || 10));
  return { mes, pago: !!p.pago, avisou: !!p.avisou, vencimento: venc, dias: venc - Number(hoje.slice(8, 10)), valor: valorDo(aluno, pix) };
}

const msgCobranca = (s, pix, auto) => `🔔 ${auto ? 'Lembrete automático: ' : ''}${s.dias > 0 ? `sua mensalidade de ${reais(s.valor)} vence dia ${s.vencimento}` : s.dias === 0 ? `sua mensalidade de ${reais(s.valor)} vence hoje` : `sua mensalidade de ${reais(s.valor)} venceu dia ${s.vencimento}`}. Pague pelo app em Ferramentas › Mensalidade (Pix para ${pix.nome}). Se já pagou, toque em "Já paguei".`;

async function cobrar(db, coachUid, coach, alunoUid, aluno, auto, t) {
  const s = situacaoMes(aluno, coach.pix, t);
  const texto = msgCobranca(s, coach.pix, auto);
  await db.collection('bc_conversas').doc(par(coachUid, alunoUid)).collection('mensagens').add({ de: coachUid, texto, em: Date.now(), tipo: 'cobranca' });
  await db.collection('bc_diretorio').doc(alunoUid).set({ lembreteMensalidade: hojeBR(t) }, { merge: true });
  await Promise.race([avisar(db, alunoUid, { titulo: 'Mensalidade', corpo: texto.replace(/^🔔 (Lembrete automático: )?/, '').slice(0, 180), url: 'ferramentas/mensalidade', tag: 'mensalidade' }, 'mensalidade').catch(() => 0), new Promise((r) => setTimeout(r, 3000))]);
}

// Cron diário (09:00 de Brasília): lembra quem não pagou, 3 dias antes, no dia e 3 dias depois do vencimento.
async function rodarCobrancas(db, t = Date.now()) {
  const dir = db.collection('bc_diretorio');
  const coaches = await dir.where('papel', '==', 'coach').limit(500).get();
  let lembrados = 0;
  for (const c of coaches.docs) {
    const coach = c.data();
    if (!coach.pix || coach.pix.lembrete === false) continue;
    const alunos = await dir.where('coachUid', '==', c.id).limit(200).get();
    for (const a of alunos.docs) {
      const aluno = a.data();
      const s = situacaoMes(aluno, coach.pix, t);
      if (s.pago || s.avisou || ![3, 0, -3].includes(s.dias) || aluno.lembreteMensalidade === hojeBR(t) || !(s.valor > 0)) continue;
      await cobrar(db, c.id, coach, a.id, aluno, true, t);
      lembrados += 1;
    }
  }
  return { coaches: coaches.docs.length, lembrados };
}

function programaLimpo(b) {
  const preco = dinheiro(b.preco);
  return {
    titulo: limpa(b.titulo, 60), descricao: limpa(b.descricao, 600), preco: preco == null ? 0 : preco,
    semanas: Math.min(52, Math.max(1, Math.round(Number(b.semanas) || 4))), ativo: b.ativo !== false,
    ficha: limpa(b.ficha, 60).replace(/[^a-zA-Z0-9_-]/g, ''), dieta: limpa(b.dieta, 60).replace(/[^a-zA-Z0-9_-]/g, '') || null,
  };
}
const publico = (id, p, modelos) => ({ id, titulo: p.titulo, descricao: p.descricao, preco: p.preco, semanas: p.semanas, resumo: (modelos[p.ficha] && modelos[p.ficha].resumo) || '', temDieta: !!p.dieta, vendas: p.vendas || 0 });

async function lojaVer(body, db) {
  const codigo = limpa(body.codigo, 10).toUpperCase();
  if (codigo.length < 4) return [404, { error: 'Loja não encontrada.' }];
  const achados = await db.collection('bc_diretorio').where('codigo', '==', codigo).limit(1).get();
  const c = achados.docs[0];
  if (!c || c.data().papel !== 'coach') return [404, { error: 'Loja não encontrada.' }];
  const snap = await db.collection('bc_programas').where('coachUid', '==', c.id).limit(30).get();
  const progs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.ativo);
  const modelos = {};
  await Promise.all(progs.map(async (p) => { const m = (await db.collection('bc_modelos').doc(p.ficha).get()).data?.(); if (m) modelos[p.ficha] = m; }));
  const d = c.data();
  // Página pública do coach: só dados que ele mesmo escolheu mostrar (nada de e-mail nem de alunos, só quantos são).
  const alunos = (await db.collection('bc_diretorio').where('coachUid', '==', c.id).limit(500).get().catch(() => ({ docs: [] }))).docs.length;
  const m = d.marca && typeof d.marca === 'object' ? { nome: d.marca.nome || '', cor: d.marca.cor || 'laranja', logo: d.marca.logo || '' } : null;
  const whats = String(d.whats || '').replace(/\D/g, '');
  const coach = { nome: d.nome || 'Coach', foto: d.foto || '', recebePix: !!d.pix, marca: m, bio: limpa(d.bio, 300), whats, alunos, codigo };
  return [200, { coach, programas: progs.sort((a, b) => a.preco - b.preco).map((p) => publico(p.id, p, modelos)) }];
}

async function negocio(body, uid, db, eu, util) {
  const acao = body.acao;
  const dir = db.collection('bc_diretorio');

  if (acao === 'financeiro_ver') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vê o financeiro.' }];
    const hoje = hojeBR();
    const meses = mesesAte(hoje.slice(0, 7), 12);
    const alunos = (await dir.where('coachUid', '==', uid).limit(200).get()).docs.map((d) => ({ uid: d.id, ...d.data() }));
    const compras = (await db.collection('bc_compras').where('coachUid', '==', uid).limit(500).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const historico = meses.map((m) => ({
      mes: m,
      mensalidades: Math.round(alunos.reduce((s, a) => s + (((a.pagamentos || {})[m] || {}).pago ? valorDo(a, eu.pix) : 0), 0) * 100) / 100,
      vendas: Math.round(compras.filter((c) => c.status === 'pago' && hojeBR(c.confirmadoEm || c.em).slice(0, 7) === m).reduce((s, c) => s + (c.preco || 0), 0) * 100) / 100,
    }));
    const lista = alunos.map((a) => { const s = situacaoMes(a, eu.pix); return { uid: a.uid, nome: a.nome || 'Aluno', valor: s.valor, pago: s.pago, avisou: s.avisou, dias: s.dias, lembradoHoje: a.lembreteMensalidade === hoje }; })
      .sort((x, y) => Number(x.pago) - Number(y.pago) || x.dias - y.dias || x.nome.localeCompare(y.nome));
    const vendas = compras.filter((c) => c.status !== 'recusado').sort((a, b) => (a.status === 'pago') - (b.status === 'pago') || b.em - a.em).slice(0, 50)
      .map((c) => ({ id: c.id, programa: c.titulo, comprador: c.nome, preco: c.preco, status: c.status, em: c.em }));
    return [200, { hoje, pix: eu.pix || null, historico, alunos: lista, vendas, previsto: Math.round(lista.reduce((s, a) => s + a.valor, 0) * 100) / 100 }];
  }

  if (acao === 'pagamento_lembrar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach cobra.' }];
    if (!eu.pix) return [409, { error: 'Cadastre a sua chave Pix antes (Mensalidade).' }];
    const alvos = body.todos ? (await dir.where('coachUid', '==', uid).limit(200).get()).docs.map((d) => [d.id, d.data()]) : [[limpa(body.aluno, 128), (await dir.doc(limpa(body.aluno, 128)).get()).data?.()]];
    let lembrados = 0;
    for (const [id, a] of alvos) {
      if (!a || a.coachUid !== uid) continue;
      const s = situacaoMes(a, eu.pix);
      if (s.pago) continue;
      await cobrar(db, uid, eu, id, a, false);
      lembrados += 1;
    }
    return [200, { lembrados }];
  }

  // Pendências do aluno para o Hoje: anamnese e mensalidade (uma chamada só).
  if (acao === 'aluno_pendencias') {
    if (eu.papel !== 'aluno' || !eu.coachUid) return [200, { coach: null, anamnese: null, mensalidade: null }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    const s = c.pix ? situacaoMes(eu, c.pix) : null;
    return [200, {
      coach: c.nome || 'Seu coach',
      anamnese: util.situacaoAnamnese(c, eu),
      mensalidade: s && !s.pago && s.valor > 0 && s.dias <= 3 ? { valor: s.valor, vencimento: s.vencimento, dias: s.dias, avisou: s.avisou } : null,
    }];
  }

  // ── Programas à venda ──
  const programas = db.collection('bc_programas');
  if (acao === 'programa_listar' || acao === 'programa_salvar' || acao === 'programa_apagar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach vende programas.' }];
    if (acao === 'programa_listar') {
      const snap = await programas.where('coachUid', '==', uid).limit(30).get();
      return [200, { programas: snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.em - a.em), codigo: eu.codigo, recebePix: !!eu.pix }];
    }
    const id = limpa(body.id, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    const atual = id ? (await programas.doc(id).get()).data?.() : null;
    if (id && (!atual || atual.coachUid !== uid)) return [404, { error: 'Programa não encontrado.' }];
    if (acao === 'programa_apagar') { await programas.doc(id).set({ ativo: false, apagado: true }, { merge: true }); return [200, { ok: true }]; }
    const p = programaLimpo(body);
    if (p.titulo.length < 3) return [400, { error: 'Dê um nome ao programa.' }];
    if (!(p.preco > 0)) return [400, { error: 'Coloque o preço.' }];
    const mf = (await db.collection('bc_modelos').doc(p.ficha).get()).data?.();
    if (!mf || mf.coachUid !== uid || mf.tipo !== 'ficha') return [400, { error: 'Escolha a ficha (um modelo seu).' }];
    if (p.dieta) { const md = (await db.collection('bc_modelos').doc(p.dieta).get()).data?.(); if (!md || md.coachUid !== uid || md.tipo !== 'dieta') return [400, { error: 'Dieta inválida.' }]; }
    const doc = { ...p, coachUid: uid, em: atual ? atual.em : Date.now(), atualizado: Date.now(), vendas: atual ? atual.vendas || 0 : 0 };
    if (atual) { await programas.doc(id).set(doc, { merge: true }); return [200, { id }]; }
    const ativos = (await programas.where('coachUid', '==', uid).limit(31).get()).docs.filter((d) => !d.data().apagado);
    if (ativos.length >= 30) return [409, { error: 'Máximo de 30 programas.' }];
    const r = await programas.add(doc);
    return [200, { id: r.id }];
  }

  const compras = db.collection('bc_compras');
  if (acao === 'compra_criar') {
    const pid = limpa(body.programa, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    const p = pid ? (await programas.doc(pid).get()).data?.() : null;
    if (!p || !p.ativo) return [404, { error: 'Este programa não está mais à venda.' }];
    if (p.coachUid === uid) return [400, { error: 'Este programa é seu.' }];
    if (eu.papel === 'coach') return [403, { error: 'Contas de coach não compram programas. Use uma conta de aluno.' }];
    if (eu.coachUid && eu.coachUid !== p.coachUid) return [409, { error: 'Você já é aluno de outro coach. Fale com ele antes de comprar.' }];
    const c = (await dir.doc(p.coachUid).get()).data?.() || {};
    if (!c.pix) return [409, { error: 'Este coach ainda não recebe por Pix no app.' }];
    const minhas = (await compras.where('comprador', '==', uid).limit(50).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const aberta = minhas.find((x) => x.programa === pid && (x.status === 'pendente' || x.status === 'avisou'));
    const perfil = eu.nome ? null : (await db.collection('bodycoach_users').doc(uid).collection('profile').doc('main').get().catch(() => null))?.data?.();
    const nome = eu.nome || limpa(perfil && (perfil.full_name || (perfil.onboarding && perfil.onboarding.name)), 60) || 'Aluno';
    const compra = aberta || { programa: pid, titulo: p.titulo, preco: p.preco, coachUid: p.coachUid, comprador: uid, nome, status: 'pendente', em: Date.now() };
    const id = aberta ? aberta.id : (await compras.add(compra)).id;
    if (!aberta) await avisar(db, p.coachUid, { titulo: '💰 Nova compra', corpo: `${compra.nome} quer o programa “${p.titulo}” (${reais(p.preco)}). Confira o Pix e confirme no Financeiro.`, url: 'coach/financeiro', tag: 'venda' }).catch(() => 0);
    const pix = { tipo: c.pix.tipo, chave: c.pix.chave, nome: c.pix.nome, cidade: c.pix.cidade };
    return [200, { compra: { id, ...compra }, pix, coach: c.nome || 'Coach' }];
  }
  if (acao === 'compra_avisar') {
    const id = limpa(body.id, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    const x = id ? (await compras.doc(id).get()).data?.() : null;
    if (!x || x.comprador !== uid) return [404, { error: 'Compra não encontrada.' }];
    if (x.status === 'pendente') {
      await compras.doc(id).set({ status: 'avisou', avisouEm: Date.now() }, { merge: true });
      await avisar(db, x.coachUid, { titulo: '💸 Pix de programa', corpo: `${x.nome} disse que pagou “${x.titulo}” (${reais(x.preco)}). Confira no banco e confirme no Financeiro.`, url: 'coach/financeiro', tag: 'venda' }).catch(() => 0);
    }
    return [200, { status: x.status === 'pendente' ? 'avisou' : x.status }];
  }
  if (acao === 'compras_minhas') {
    const snap = await compras.where('comprador', '==', uid).limit(50).get();
    return [200, { compras: snap.docs.map((d) => ({ id: d.id, programa: d.data().programa, titulo: d.data().titulo, preco: d.data().preco, status: d.data().status, em: d.data().em })) }];
  }
  if (acao === 'compra_confirmar') {
    if (eu.papel !== 'coach') return [403, { error: 'Só o coach confirma.' }];
    const id = limpa(body.id, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    const x = id ? (await compras.doc(id).get()).data?.() : null;
    if (!x || x.coachUid !== uid) return [404, { error: 'Venda não encontrada.' }];
    if (x.status === 'pago' || x.status === 'recusado') return [409, { error: 'Esta venda já foi resolvida.' }];
    if (!body.ok) {
      await compras.doc(id).set({ status: 'recusado', confirmadoEm: Date.now() }, { merge: true });
      await avisar(db, x.comprador, { titulo: 'Compra não confirmada', corpo: `${eu.nome || 'O coach'} não encontrou o Pix de “${x.titulo}”. Fale com ele.`, url: '', tag: 'venda' }).catch(() => 0);
      return [200, { status: 'recusado' }];
    }
    const comprador = (await dir.doc(x.comprador).get()).data?.() || null;
    if (comprador && comprador.coachUid && comprador.coachUid !== uid) return [409, { error: 'O comprador entrou na equipe de outro coach. Devolva o Pix.' }];
    if (comprador && comprador.papel === 'coach') return [409, { error: 'O comprador é uma conta de coach.' }];
    // entra na equipe (a conversa passa a funcionar) e recebe a ficha e a dieta do programa
    await dir.doc(x.comprador).set({ papel: 'aluno', nome: (comprador && comprador.nome) || x.nome, coachUid: uid, programa: { id: x.programa, titulo: x.titulo, em: Date.now() } }, { merge: true });
    const p = (await programas.doc(x.programa).get()).data?.() || {};
    const mf = (await db.collection('bc_modelos').doc(p.ficha || '').get()).data?.();
    if (mf && mf.coachUid === uid) await util.gravarPrescricao(x.comprador, 'ficha', { ...mf.dados, nome: x.titulo });
    const md = p.dieta ? (await db.collection('bc_modelos').doc(p.dieta).get()).data?.() : null;
    if (md && md.coachUid === uid) await util.gravarPrescricao(x.comprador, 'dieta', { ...md.dados, arquivo: `Plano de ${eu.nome || 'seu coach'}`, importado_em: new Date().toISOString(), do_coach: true });
    await compras.doc(id).set({ status: 'pago', confirmadoEm: Date.now() }, { merge: true });
    await programas.doc(x.programa).set({ vendas: (p.vendas || 0) + 1 }, { merge: true });
    const texto = `🎉 Pagamento confirmado! O programa “${x.titulo}” já está no seu app. Qualquer dúvida, é só falar aqui.`;
    await db.collection('bc_conversas').doc(par(uid, x.comprador)).collection('mensagens').add({ de: uid, texto, em: Date.now() });
    await avisarConversa(db, x.comprador, eu.nome, texto);
    return [200, { status: 'pago' }];
  }
  return null;
}

module.exports = { negocio, lojaVer, rodarCobrancas, situacaoMes };
