'use strict';
// Splash: lembretes para o cliente (saldo a pagar e "falta pouco para a sua festa").
// O envio automático pelo WhatsApp é pago; aqui o painel monta a lista e a mensagem, e a dona envia com 1 toque.

const MSG_ANTES = 'Oi {nome}! 🎉 {quando} a sua festa no {unidade} ({data})! Estamos preparando tudo com muito carinho para você e seus convidados. Qualquer dúvida é só me chamar! 🏊☀️';
const MSG_SALDO = 'Oi {nome}! 💛 Passando para lembrar do saldo da sua reserva no {unidade} ({data}): {saldo}. {pix}Qualquer dúvida estou aqui. Obrigada!';

const MSG_AVALIACAO = 'Oi {nome}! 💛 Foi um prazer receber você e seus convidados no {unidade}! Sua opinião é muito importante para nós. Pode deixar uma avaliaçãozinha rapidinho? {link} Obrigada! 🏊';

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const R = n => 'R$ ' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');

function limparLembretes(l) {
  l = l && typeof l === 'object' ? l : {};
  const a = l.antes || {}, s = l.saldo || {};
  return {
    ativo: l.ativo === true,
    push: l.push !== false,
    antes: { ativo: a.ativo !== false, dias: Number(a.dias) === 2 ? 2 : 1 },
    saldo: { ativo: s.ativo !== false, dias: Math.min(Math.max(Math.round(Number(s.dias) || 3), 1), 30) },
    avaliacao: { ativo: !!(l.avaliacao && l.avaliacao.ativo === true), dias: Math.min(Math.max(Math.round(Number(l.avaliacao && l.avaliacao.dias) || 1), 1), 7) },
    msg_avaliacao: str(l.msg_avaliacao, 600) || MSG_AVALIACAO,
    msg_antes: str(l.msg_antes, 600) || MSG_ANTES,
    msg_saldo: str(l.msg_saldo, 600) || MSG_SALDO,
  };
}

const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 86400000);
const somaPag = r => (Array.isArray(r.pagamentos) ? r.pagamentos : []).reduce((t, p) => t + (Number(p.valor) || 0), 0);

function preencher(tpl, campos) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (campos[k] !== undefined ? campos[k] : m)).replace(/\s{2,}/g, ' ').trim();
}

/** Lista o que precisa ser enviado hoje (nada que já foi marcado como enviado). */
function devidos(reservas, cfg, hoje) {
  const L = cfg.lembretes;
  if (!L || !L.ativo) return [];
  const out = [];
  for (const r of reservas) {
    if (!['confirmado', 'concluido'].includes(r.status) || !r.data || !r.whatsapp) continue;
    const falta = diasEntre(hoje, r.data);
    if (falta < 0) {
      // depois da festa: pede a avaliação (por até 7 dias)
      const env0 = r.lembretes_enviados || {};
      if (L.avaliacao.ativo && -falta >= L.avaliacao.dias && -falta <= 7 && !env0.avaliacao) {
        const [, m0, d0] = r.data.split('-');
        out.push({ id: r.id, tipo: 'avaliacao', chave: 'avaliacao', data: r.data, nome: r.nome, whatsapp: r.whatsapp, unidade_nome: r.unidade_nome || '', falta,
          mensagem: preencher(L.msg_avaliacao, { nome: String(r.nome || '').split(' ')[0] || 'tudo bem', data: `${d0}/${m0}`, unidade: r.unidade_nome || 'Splash' }) });
      }
      continue;
    }
    if (r.status !== 'confirmado') continue;
    const enviados = r.lembretes_enviados || {};
    const [, m, d] = r.data.split('-');
    const base = {
      nome: String(r.nome || '').split(' ')[0] || 'tudo bem',
      data: `${d}/${m}`,
      unidade: r.unidade_nome || 'Splash',
    };
    const saldo = Math.max(0, (Number(r.valor_total) || 0) - somaPag(r));
    if (L.antes.ativo && falta <= L.antes.dias && !enviados.antes) {
      out.push({ id: r.id, tipo: 'antes', chave: 'antes', data: r.data, nome: r.nome, whatsapp: r.whatsapp, unidade_nome: r.unidade_nome || '', falta,
        mensagem: preencher(L.msg_antes, { ...base, quando: falta === 0 ? 'Hoje é o dia da' : falta === 1 ? 'Falta 1 dia para' : 'Faltam ' + falta + ' dias para' }) });
    }
    if (L.saldo.ativo && saldo > 0.009 && falta <= L.saldo.dias && !enviados.saldo) {
      const px = cfg.pix && cfg.pix.chave ? `Pix: ${cfg.pix.chave}${cfg.pix.titular ? ' (' + cfg.pix.titular + ')' : ''}. ` : '';
      out.push({ id: r.id, tipo: 'saldo', chave: 'saldo', data: r.data, nome: r.nome, whatsapp: r.whatsapp, unidade_nome: r.unidade_nome || '', falta, saldo: Math.round(saldo * 100) / 100,
        mensagem: preencher(L.msg_saldo, { ...base, saldo: R(saldo), pix: px }) });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

async function reservasAtivas(col) {
  const out = [];
  for (const st of ['confirmado', 'concluido']) { const sn = await col.where('status', '==', st).get(); sn.docs.forEach(d => out.push({ id: d.id, ...d.data() })); }
  return out;
}

/** Todo dia às 9h (Brasília): avisa a dona no celular quantos lembretes esperam. Roda no cron do Worker. */
async function rodar(db, at) {
  const t = new Date(at);
  if (t.getUTCHours() !== 12 || t.getUTCMinutes() >= 5) return { skipped: 'fora do horário' };
  const { montarConfig, COLLECTION, agoraBr } = require('../locacao.js');
  const push = require('../body-coach/push.js');
  const hoje = agoraBr(at).data;
  const contas = await db.collection(COLLECTION).get();
  let avisos = 0;
  for (const c of contas.docs) {
    try {
      const dados = c.data() || {};
      const cfg = montarConfig(dados, dados.config);
      if (!cfg.lembretes.ativo || !cfg.lembretes.push) continue;
      const lista = devidos(await reservasAtivas(c.ref.collection('reservas')), cfg, hoje);
      if (!lista.length) continue;
      const subs = await c.ref.collection('push').get();
      for (const s of subs.docs) {
        const st = await push.enviarUm(db, s.data(), { titulo: 'Lembretes para enviar', corpo: `Você tem ${lista.length} lembrete(s) de cliente para enviar hoje. Toque para ver.`, url: './', tag: 'lembretes' }).catch(() => 0);
        if (st === 404 || st === 410) await s.ref.delete().catch(() => {});
        else if (st >= 200 && st < 300) avisos++;
      }
    } catch { /* uma conta com problema não derruba as outras */ }
  }
  return { avisos };
}

module.exports = { limparLembretes, devidos, rodar, reservasAtivas, MSG_AVALIACAO, MSG_ANTES, MSG_SALDO };
