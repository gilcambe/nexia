'use strict';
/**
 * Kernex Finance, fase 14: alertas. A pessoa liga e desliga CADA tipo; desligado nunca aparece nem sai por e-mail.
 * Canais grátis: dentro do app (PWA) e e-mail (só para o endereço que ela mesma informou).
 * WhatsApp: só guarda o consentimento; não envia nada (o número 5511999994185 é proibido pelo AGENTS.md).
 */
const cartoes = require('./cartoes');
const fin = require('./financas');
const { totais } = require('./motor');

const TIPOS = {
  conta_vencer: 'Conta ou fatura vencendo em até 3 dias',
  orcamento_80: 'Orçamento (limite de categoria) em 80% ou mais',
  cobranca_suspeita: 'Cobrança repetida para você conferir',
  milhas_vencer: 'Pontos ou milhas vencendo em até 30 dias',
};
const NUMERO_PROIBIDO = '5511999994185';
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const padrao = () => ({ tipos: Object.fromEntries(Object.keys(TIPOS).map((k) => [k, true])), canais: { app: true, email: false }, email_para: null, whatsapp: { consentimento: false, numero: null } });

function mesclar(salvo) {
  const p = padrao();
  if (!salvo) return p;
  for (const k of Object.keys(TIPOS)) if (salvo.tipos && typeof salvo.tipos[k] === 'boolean') p.tipos[k] = salvo.tipos[k];
  if (salvo.canais) { p.canais.app = salvo.canais.app !== false; p.canais.email = salvo.canais.email === true; }
  p.email_para = salvo.email_para || null;
  p.whatsapp = { consentimento: !!(salvo.whatsapp && salvo.whatsapp.consentimento), numero: (salvo.whatsapp && salvo.whatsapp.numero) || null };
  return p;
}

/** Tabela de eventos: cada função devolve alertas do dono; só roda se o tipo estiver ligado. */
function gerar(cfg, dados, agoraIso) {
  const out = [];
  const mes = agoraIso.slice(0, 7); const dia = new Date(agoraIso).getUTCDate();
  const on = (t) => cfg.tipos[t] === true;
  if (on('conta_vencer')) {
    for (const k of dados.cartoes) { if (!k.dia_vencimento) continue; const em = (k.dia_vencimento - dia + 31) % 31; if (em <= 3) out.push({ tipo: 'conta_vencer', texto: `Fatura do ${k.nome} vence ${em === 0 ? 'hoje' : em === 1 ? 'amanhã' : 'em ' + em + ' dias'}.` }); }
    for (const d of dados.dividas) { if (!d.dia_vencimento) continue; const em = (d.dia_vencimento - dia + 31) % 31; if (em <= 3) out.push({ tipo: 'conta_vencer', texto: `Parcela de ${d.credor} vence ${em === 0 ? 'hoje' : em === 1 ? 'amanhã' : 'em ' + em + ' dias'}.` }); }
  }
  if (on('orcamento_80')) {
    const t = totais(dados.lancs.filter((x) => x.perfil !== 'pj' && String(x.data).startsWith(mes)));
    for (const l of fin.consumoLimites(dados.limites, t.por_categoria)) if (l.status !== 'ok') out.push({ tipo: 'orcamento_80', texto: `${l.categoria}: ${l.pct}% do limite do mês${l.status === 'estourado' ? ' (estourado)' : ''}.` });
  }
  if (on('cobranca_suspeita')) {
    for (const s of cartoes.cobrancasSuspeitas(dados.lancs).filter((x) => String(x.lancamento.data).startsWith(mes) && x.motivo.startsWith('cobrança repetida'))) out.push({ tipo: 'cobranca_suspeita', texto: `Possível cobrança repetida em ${s.lancamento.descricao} (${s.lancamento.data}).` });
  }
  if (on('milhas_vencer')) {
    const hoje = Date.parse(agoraIso.slice(0, 10));
    for (const p of dados.pontos) { if (!p.validade || !(p.saldo > 0)) continue; const d = Math.round((Date.parse(p.validade) - hoje) / 86400000); if (d >= 0 && d <= 30) out.push({ tipo: 'milhas_vencer', texto: `${p.saldo.toLocaleString('pt-BR')} pontos ${p.programa} vencem em ${d} dia(s).` }); }
  }
  return out;
}

function validarConfig(b, atual) {
  const cfg = mesclar(atual);
  if (b.tipos && typeof b.tipos === 'object') for (const k of Object.keys(TIPOS)) if (typeof b.tipos[k] === 'boolean') cfg.tipos[k] = b.tipos[k];
  if (b.canais && typeof b.canais === 'object') { if (typeof b.canais.app === 'boolean') cfg.canais.app = b.canais.app; if (typeof b.canais.email === 'boolean') cfg.canais.email = b.canais.email; }
  if (b.email_para !== undefined) {
    const e = texto(b.email_para, 254).toLowerCase();
    if (e && !EMAIL.test(e)) return { ok: false, erro: 'Esse e-mail não parece certo.' };
    cfg.email_para = e || null;
  }
  if (cfg.canais.email && !cfg.email_para) return { ok: false, erro: 'Para ligar o e-mail, informe o seu endereço.' };
  if (b.whatsapp && typeof b.whatsapp === 'object') {
    const consent = b.whatsapp.consentimento === true;
    const num = soDigitos(b.whatsapp.numero);
    if (num.includes(NUMERO_PROIBIDO)) return { ok: false, erro: 'Esse número não pode ser usado.' };
    if (consent && (num.length < 10 || num.length > 13)) return { ok: false, erro: 'Para autorizar o WhatsApp informe o seu número com DDD.' };
    cfg.whatsapp = consent ? { consentimento: true, numero: num } : { consentimento: false, numero: null };
  }
  return { ok: true, cfg };
}

async function enviarEmail(deps, { to, assunto, texto: corpo }) {
  if (typeof deps.enviarEmail === 'function') return deps.enviarEmail({ to, assunto, texto: corpo });
  const key = process.env.BREVO_API_KEY; const de = process.env.BREVO_SENDER;
  if (!key || !de) return { ok: false, motivo: 'O envio de e-mail ainda não está configurado.' };
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { accept: 'application/json', 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { name: 'Kernex Finance', email: de }, to: [{ email: to }], subject: assunto, textContent: corpo }) });
    return r.ok ? { ok: true } : { ok: false, motivo: 'O provedor de e-mail recusou (' + r.status + ').' };
  } catch { return { ok: false, motivo: 'Não consegui falar com o provedor de e-mail.' }; }
}

async function agirAlertas(acao, body, c) {
  if (!['alertas_config', 'alertas_salvar', 'alertas_listar', 'alertas_enviar_email'].includes(acao)) return null;
  const { base, listar, agoraIso, deps } = c;
  const ler = async () => { const s = await base.collection('config').doc('alertas').get(); return s && s.exists ? s.data() : null; };
  switch (acao) {
    case 'alertas_config': return [200, { config: mesclar(await ler()), tipos: TIPOS }];
    case 'alertas_salvar': {
      const v = validarConfig(body, await ler());
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('config').doc('alertas').set({ ...v.cfg, atualizado_em: agoraIso });
      return [200, { ok: true, config: v.cfg }];
    }
    case 'alertas_listar': case 'alertas_enviar_email': {
      const cfg = mesclar(await ler());
      const [cart, dividas, lancs, limites, pontos] = await Promise.all(['cartoes', 'dividas', 'lancamentos', 'limites', 'pontos'].map((k) => listar(base.collection(k))));
      const alertas = cfg.canais.app || acao === 'alertas_enviar_email' ? gerar(cfg, { cartoes: cart, dividas, lancs, limites, pontos }, agoraIso) : [];
      if (acao === 'alertas_listar') return [200, { alertas, canais: cfg.canais }];
      if (!cfg.canais.email || !cfg.email_para) return [400, { error: 'O e-mail está desligado. Ligue e informe seu endereço primeiro.' }];
      if (!alertas.length) return [200, { ok: true, enviados: 0, mensagem: 'Nenhum alerta ligado precisa de atenção agora; não mandei e-mail.' }];
      const r = await enviarEmail(deps, { to: cfg.email_para, assunto: `Kernex Finance: ${alertas.length} alerta(s)`, texto: alertas.map((a) => '• ' + a.texto).join('\n') + '\n\nVocê controla esses alertas no app, aba Alertas.' });
      return r.ok ? [200, { ok: true, enviados: alertas.length }] : [503, { error: r.motivo }];
    }
    default: return null;
  }
}

// E-mail diário: passa por cada pessoa que LIGOU o e-mail e informou o endereço. Manda no máximo 1 por dia,
// só se houver alerta ligado precisando de atenção. Sem provedor de e-mail configurado não finge que mandou.
async function enviarDiario(db, agoraIso, deps = {}) {
  const listar = async (col) => { const s = await col.get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); };
  const dia = agoraIso.slice(0, 10);
  const r = { pessoas: 0, enviados: 0, sem_alerta: 0, ja_hoje: 0, falhas: 0, motivo: null };
  for (const u of await listar(db.collection('prumo_users'))) {
    const base = db.collection('prumo_users').doc(u.id);
    const snap = await base.collection('config').doc('alertas').get();
    const cfg = mesclar(snap && snap.exists ? snap.data() : null);
    if (!cfg.canais.email || !cfg.email_para) continue;
    r.pessoas++;
    const marca = await base.collection('config').doc('alertas_email').get();
    if (marca && marca.exists && marca.data() && marca.data().dia === dia) { r.ja_hoje++; continue; }
    const [cartoes, dividas, lancs, limites, pontos] = await Promise.all(['cartoes', 'dividas', 'lancamentos', 'limites', 'pontos'].map((k) => listar(base.collection(k))));
    const alertas = gerar(cfg, { cartoes, dividas, lancs, limites, pontos }, agoraIso);
    if (!alertas.length) { r.sem_alerta++; continue; }
    const e = await enviarEmail(deps, { to: cfg.email_para, assunto: `Kernex Finance: ${alertas.length} alerta(s) de hoje`, texto: alertas.map((a) => '• ' + a.texto).join('\n') + '\n\nVocê controla esses alertas no app, aba Alertas.' });
    if (e.ok) { r.enviados++; await base.collection('config').doc('alertas_email').set({ dia, em: agoraIso, alertas: alertas.length }); } else { r.falhas++; r.motivo = e.motivo; }
  }
  return r;
}

module.exports = { enviarDiario, agirAlertas, gerar, mesclar, validarConfig, TIPOS };
