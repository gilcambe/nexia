'use strict';
/**
 * Kernex Finance, fase 15 (lado do usuário): aba Ajuda, LGPD e limite de leituras por plano.
 * - Mensagens usuário↔administração em prumo_users/{uid}/mensagens.
 * - Exportar e apagar MEUS dados (só do próprio uid; nunca de outra pessoa).
 * - Autorizar o suporte por um prazo (acesso excepcional), sempre registrado em auditoria.
 * - Limite de leituras de documento/print por mês, conforme o plano que o master define.
 */
const COLECOES = ['carteira', 'cartoes', 'cofres', 'conexoes', 'config', 'contas', 'dividas', 'dividendos', 'gastos', 'historico', 'holerites',
  'lancamentos', 'limites', 'listas', 'milhas_compras', 'milhas_promos', 'objetivos', 'orcamento', 'pontos', 'mensagens', 'auditoria',
  'documentos', 'investimentos', 'familia', 'impostos', 'alertas', 'bancos', 'milhas'];
const PLANOS = { gratis: 60, pro: 600, master: Infinity };
const texto = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Conta uma leitura (doc_ler/ler_print) no mês; recusa se passou do limite do plano. */
async function contarLeitura(base, agoraIso, n = 1) {
  const mes = agoraIso.slice(0, 7);
  const [u, s] = await Promise.all([base.get(), base.collection('config').doc('uso').get()]);
  if (!u || !u.exists) await base.set({ plano: 'gratis', criado_em: agoraIso });
  const plano = (u && u.exists && u.data() && u.data().plano) || 'gratis';
  const limite = PLANOS[plano] != null ? PLANOS[plano] : PLANOS.gratis;
  const atual = s && s.exists && s.data() && s.data().mes === mes ? Number(s.data().leituras) || 0 : 0;
  if (atual + n > limite) return { ok: false, plano, limite, usadas: atual };
  await base.collection('config').doc('uso').set({ mes, leituras: atual + n, atualizado_em: agoraIso });
  return { ok: true, plano, limite, usadas: atual + n };
}
const msgLimite = (r) => `Você já usou as ${r.limite} leituras do plano ${r.plano} neste mês. Fale com a gente na aba Ajuda para aumentar.`;

async function agirAjuda(acao, body, c) {
  if (!['ajuda_enviar', 'ajuda_listar', 'meus_dados_exportar', 'meus_dados_apagar', 'suporte_autorizar', 'meu_plano'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const auditar = (evento, extra = {}) => base.collection('auditoria').doc(novoId()).set({ evento, em: agoraIso, ...extra });
  switch (acao) {
    case 'ajuda_enviar': {
      const t = texto(body.texto, 1500);
      if (!t) return [400, { error: 'Escreva sua mensagem.' }];
      const id = novoId();
      const u = await base.get(); if (!u || !u.exists) await base.set({ plano: 'gratis', criado_em: agoraIso });
      await base.collection('mensagens').doc(id).set({ de: 'usuario', texto: t, em: agoraIso, status: 'aberta' });
      return [200, { ok: true, id }];
    }
    case 'ajuda_listar': {
      const [msgs, sup] = await Promise.all([listar(base.collection('mensagens')), base.collection('config').doc('suporte').get()]);
      const ate = sup && sup.exists && sup.data() ? sup.data().ate || null : null;
      return [200, { mensagens: msgs.sort((a, b) => String(a.em).localeCompare(String(b.em))), suporte_ate: ate && ate > agoraIso ? ate : null }];
    }
    case 'meus_dados_exportar': {
      const colecoes = {};
      for (const n of COLECOES) { const l = await listar(base.collection(n)); if (l.length) colecoes[n] = l; }
      await auditar('exportou_dados');
      return [200, { exportado_em: agoraIso, app: 'Kernex Finance', colecoes }];
    }
    case 'meus_dados_apagar': {
      if (body.confirmacao !== 'APAGAR') return [400, { error: 'Para apagar tudo, escreva APAGAR.' }];
      let apagados = 0;
      for (const n of COLECOES) {
        const col = base.collection(n);
        for (const d of await listar(col)) { await col.doc(d.id).delete(); apagados++; }
      }
      if (typeof base.delete === 'function') await base.delete().catch(() => {});
      return [200, { ok: true, apagados }];
    }
    case 'suporte_autorizar': {
      const horas = Number(body.horas);
      if (![0, 24, 72].includes(horas)) return [400, { error: 'Escolha 24 horas, 72 horas ou cancelar.' }];
      const ate = horas ? new Date(Date.parse(agoraIso) + horas * 3600e3).toISOString() : null;
      await base.collection('config').doc('suporte').set({ ate, em: agoraIso });
      await auditar(horas ? 'autorizou_suporte' : 'cancelou_suporte', { ate });
      return [200, { ok: true, suporte_ate: ate }];
    }
    case 'meu_plano': {
      const [u, s] = await Promise.all([base.get(), base.collection('config').doc('uso').get()]);
      if (!u || !u.exists) await base.set({ plano: 'gratis', criado_em: agoraIso });
      const plano = (u && u.exists && u.data() && u.data().plano) || 'gratis';
      const mes = agoraIso.slice(0, 7);
      const usadas = s && s.exists && s.data() && s.data().mes === mes ? Number(s.data().leituras) || 0 : 0;
      return [200, { plano, limite: PLANOS[plano] === Infinity ? null : PLANOS[plano], usadas }];
    }
  }
  return null;
}
module.exports = { agirAjuda, contarLeitura, msgLimite, COLECOES, PLANOS };
