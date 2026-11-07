'use strict';
/**
 * Kernex Finance, fase 12: grupo familiar e módulo autônomo (PF × PJ).
 * Família: cada pessoa decide o que compartilha (nada por padrão). Quem vê só recebe as seções marcadas pelo dono dos dados.
 * Autônomo: lançamentos têm perfil 'pf' ou 'pj'; os totais nunca se misturam e o imposto só é estimado com a alíquota que a pessoa informar.
 */
const crypto = require('crypto');
const { totais, patrimonio } = require('./motor');

const SECOES = { resumo_mes: 'Resumo do mês (receitas, despesas, economia)', patrimonio: 'Patrimônio líquido', dividas: 'Total de dívidas', metas: 'Objetivos e progresso' };
const MES = /^\d{4}-\d{2}$/;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dinheiro = (n) => Math.round(n * 100) / 100;
const numero = (v) => (typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')));
const codigo = () => crypto.randomBytes(5).toString('hex').toUpperCase();

async function ler(ref) { const s = await ref.get(); return s && s.exists ? s.data() : null; }

/** Monta só as seções pedidas, a partir dos dados do DONO. */
async function secoes(baseDono, quais, mes) {
  const col = (n) => baseDono.collection(n).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  const out = {};
  const lancs = quais.includes('resumo_mes') ? (await col('lancamentos')).filter((x) => x.perfil !== 'pj' && String(x.data).startsWith(mes)) : [];
  if (quais.includes('resumo_mes')) { const t = totais(lancs); out.resumo_mes = { mes, receitas: t.receitas, despesas: t.despesas, economia: dinheiro(t.receitas - t.despesas) }; }
  if (quais.includes('patrimonio') || quais.includes('dividas')) {
    const [contas, carteira, dividas] = await Promise.all([col('contas'), col('carteira'), col('dividas')]);
    if (quais.includes('patrimonio')) out.patrimonio = patrimonio({ contas: contas.filter((k) => (k.moeda || 'BRL') === 'BRL').map((k) => ({ valor: k.saldo })), investimentos: carteira, dividas: dividas.map((d) => ({ valor: d.saldo })) });
    if (quais.includes('dividas')) out.dividas = { total: dinheiro(dividas.reduce((s, d) => s + (Number(d.saldo) || 0), 0)), quantidade: dividas.length };
  }
  if (quais.includes('metas')) {
    const [objs, carteira] = await Promise.all([col('objetivos'), col('carteira')]);
    out.metas = objs.map((o) => { const atual = dinheiro(carteira.filter((i) => i.objetivo_id === o.id).reduce((s, i) => s + (Number(i.valor) || 0), 0)); return { nome: o.nome, meta: o.meta, atual, percentual: o.meta > 0 ? Math.round((atual / o.meta) * 1000) / 10 : 0 }; });
  }
  return out;
}

function resumoAutonomo(lancs, mes, aliquota) {
  const pj = (lancs || []).filter((x) => x.perfil === 'pj' && String(x.data).startsWith(mes));
  const pf = (lancs || []).filter((x) => x.perfil !== 'pj' && String(x.data).startsWith(mes));
  const tj = totais(pj); const tf = totais(pf);
  const imposto = aliquota === null ? null : dinheiro(tj.receitas * aliquota / 100);
  return {
    mes,
    pj: { receitas: tj.receitas, despesas: tj.despesas, lucro: dinheiro(tj.receitas - tj.despesas), imposto_estimado: imposto, por_categoria: tj.por_categoria, qtd: pj.length },
    pf: { receitas: tf.receitas, despesas: tf.despesas, economia: dinheiro(tf.receitas - tf.despesas), qtd: pf.length },
    nota_imposto: imposto === null ? 'Informe a alíquota do seu regime para eu estimar o imposto; não presumo regime nem alíquota.' : 'Estimativa com a alíquota que você informou; confirme com seu contador.',
    aviso: 'PF e PJ ficam separados. Retirada da empresa para você (pró-labore, distribuição) deve ser lançada como receita pessoal e como despesa da empresa, nunca misturar no mesmo total.',
  };
}

async function agirFamilia(acao, body, c) {
  if (!['familia_criar', 'familia_convidar', 'familia_entrar', 'familia_compartilhar', 'familia_ver', 'familia_sair', 'familia_estado', 'autonomo_resumo', 'lanc_perfil'].includes(acao)) return null;
  const { uid, base, listar, deps, agoraIso } = c;
  const db = deps.db();
  const fams = db.collection('prumo_familias');
  const cfg = base.collection('config');
  const minha = async () => { const f = await ler(cfg.doc('familia')); if (!f || !f.familia_id) return null; const fam = await ler(fams.doc(f.familia_id)); return fam && fam.membros && fam.membros[uid] ? { id: f.familia_id, fam } : null; };
  switch (acao) {
    case 'familia_criar': {
      if (await minha()) return [409, { error: 'Você já está em um grupo familiar.' }];
      const nome = texto(body.nome, 60) || 'Minha família';
      const id = 'f' + crypto.randomBytes(8).toString('hex');
      await fams.doc(id).set({ nome, dono: uid, membros: { [uid]: { papel: 'dono', desde: agoraIso } }, criado_em: agoraIso });
      await cfg.doc('familia').set({ familia_id: id });
      return [200, { ok: true, familia_id: id, nome }];
    }
    case 'familia_convidar': {
      const m = await minha();
      if (!m) return [400, { error: 'Crie um grupo familiar primeiro.' }];
      if (m.fam.dono !== uid) return [403, { error: 'Só quem criou o grupo convida.' }];
      const cod = codigo();
      await fams.doc(m.id).collection('convites').doc(cod).set({ criado_em: agoraIso, usado: false });
      await db.collection('prumo_convites').doc(cod).set({ familia_id: m.id, criado_em: agoraIso, usado: false });
      return [200, { ok: true, codigo: cod, aviso: 'Passe o código só para quem você confia. Vale para uma pessoa.' }];
    }
    case 'familia_entrar': {
      if (await minha()) return [409, { error: 'Você já está em um grupo familiar.' }];
      const cod = texto(body.codigo, 20).toUpperCase();
      const conv = cod ? await ler(db.collection('prumo_convites').doc(cod)) : null;
      if (!conv || conv.usado) return [400, { error: 'Código inválido ou já usado.' }];
      const fam = await ler(fams.doc(conv.familia_id));
      if (!fam) return [400, { error: 'Código inválido ou já usado.' }];
      fam.membros[uid] = { papel: 'membro', desde: agoraIso };
      await fams.doc(conv.familia_id).set(fam);
      await db.collection('prumo_convites').doc(cod).set({ ...conv, usado: true, usado_em: agoraIso });
      await cfg.doc('familia').set({ familia_id: conv.familia_id });
      return [200, { ok: true, nome: fam.nome }];
    }
    case 'familia_compartilhar': {
      const m = await minha();
      if (!m) return [400, { error: 'Entre em um grupo familiar primeiro.' }];
      const lista = Array.isArray(body.secoes) ? body.secoes.filter((s) => SECOES[s]) : [];
      await cfg.doc('compartilhado').set({ secoes: [...new Set(lista)], atualizado_em: agoraIso });
      return [200, { ok: true, secoes: [...new Set(lista)] }];
    }
    case 'familia_estado': {
      const m = await minha();
      const comp = await ler(cfg.doc('compartilhado'));
      return [200, { em_familia: !!m, nome: m ? m.fam.nome : null, papel: m ? m.fam.membros[uid].papel : null, membros: m ? Object.keys(m.fam.membros).length : 0, secoes_disponiveis: SECOES, compartilhando: comp ? comp.secoes : [] }];
    }
    case 'familia_ver': {
      const m = await minha();
      if (!m) return [400, { error: 'Você não está em um grupo familiar.' }];
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const outros = Object.keys(m.fam.membros).filter((u) => u !== uid);
      const membros = [];
      for (const u of outros) {
        const baseU = db.collection('prumo_users').doc(u);
        const comp = await ler(baseU.collection('config').doc('compartilhado'));
        const quais = comp && Array.isArray(comp.secoes) ? comp.secoes.filter((s) => SECOES[s]) : [];
        membros.push({ rotulo: 'Membro ' + (membros.length + 1), papel: m.fam.membros[u].papel, compartilhando: quais, dados: quais.length ? await secoes(baseU, quais, mes) : null, nota: quais.length ? null : 'Esta pessoa ainda não compartilhou nada com a família.' });
      }
      return [200, { familia: m.fam.nome, membros }];
    }
    case 'familia_sair': {
      const m = await minha();
      if (!m) return [200, { ok: true }];
      if (m.fam.dono === uid && Object.keys(m.fam.membros).length > 1) return [400, { error: 'O dono só sai depois que os outros membros saírem.' }];
      delete m.fam.membros[uid];
      if (Object.keys(m.fam.membros).length) await fams.doc(m.id).set(m.fam); else await fams.doc(m.id).delete();
      await cfg.doc('familia').set({ familia_id: null });
      await cfg.doc('compartilhado').set({ secoes: [], atualizado_em: agoraIso });
      return [200, { ok: true }];
    }
    case 'lanc_perfil': {
      const id = texto(body.id, 80); const perfil = body.perfil === 'pj' ? 'pj' : body.perfil === 'pf' ? 'pf' : null;
      if (!id || !perfil) return [400, { error: 'Diga o lançamento e se é pf ou pj.' }];
      const ref = base.collection('lancamentos').doc(id); const l = await ler(ref);
      if (!l) return [404, { error: 'Lançamento não encontrado.' }];
      await ref.set({ ...l, perfil });
      return [200, { ok: true, perfil }];
    }
    case 'autonomo_resumo': {
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const al = body.aliquota_pct === undefined || body.aliquota_pct === '' ? null : numero(body.aliquota_pct);
      if (al !== null && (!Number.isFinite(al) || al < 0 || al > 100)) return [400, { error: 'A alíquota vai de 0 a 100 (%).' }];
      return [200, resumoAutonomo(await listar(base.collection('lancamentos')), mes, al)];
    }
    default: return null;
  }
}

module.exports = { agirFamilia, resumoAutonomo, secoes, SECOES };
