'use strict';
// E-mail pelo SMTP da Hostinger, sem mexer na API.
// A API (viajante-pro.js e leads.js) chama a API HTTP do Brevo com fetch().
// Este adaptador intercepta SÓ essas chamadas e manda o e-mail pelo SMTP (nodemailer).
// Qualquer outro fetch passa direto.

const BREVO = 'https://api.brevo.com/v3/';

function criarTransporte(env) {
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch {
    throw new Error('Pacote nodemailer não instalado. Rode "npm install" na pasta do app.');
  }
  const porta = Number(env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

// enviar(msg) pode ser trocado nos testes.
function instalarSmtp(env, opcoes = {}) {
  if (!env.SMTP_HOST || !env.SMTP_USER) return false;
  const remetente = env.SMTP_FROM || env.SMTP_USER;
  // A API só tenta mandar e-mail quando há "chave do Brevo"; aqui ela vira só um sinal de "e-mail ligado".
  if (!env.BREVO_API_KEY) env.BREVO_API_KEY = 'smtp-hostinger';
  if (!env.BREVO_SENDER) env.BREVO_SENDER = remetente;

  let transporte = null;
  const enviar = opcoes.enviar || (async msg => {
    if (!transporte) transporte = criarTransporte(env);
    return transporte.sendMail(msg);
  });

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async function fetchComSmtp(url, init = {}) {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    if (!u.startsWith(BREVO)) return fetchOriginal(url, init);

    if (u.startsWith(BREVO + 'senders')) {
      return resposta(200, { senders: [{ id: 1, name: 'Viajante Pro', email: remetente, active: true }] });
    }
    if (u.startsWith(BREVO + 'smtp/email') && String(init.method || 'GET').toUpperCase() === 'POST') {
      let p;
      try { p = JSON.parse(init.body || '{}'); } catch { return resposta(400, { message: 'JSON inválido' }); }
      const nomeRem = (p.sender && p.sender.name) || 'Viajante Pro';
      const para = (p.to || []).map(t => (t.name ? `"${String(t.name).replace(/"/g, '')}" <${t.email}>` : t.email));
      try {
        const info = await enviar({
          from: `"${String(nomeRem).replace(/"/g, '')}" <${remetente}>`,
          to: para,
          subject: p.subject || '(sem assunto)',
          html: p.htmlContent || undefined,
          text: p.textContent || undefined,
          replyTo: p.replyTo && p.replyTo.email ? p.replyTo.email : undefined,
        });
        return resposta(201, { messageId: (info && info.messageId) || `<smtp-${Date.now()}@viajante.pro>` });
      } catch (e) {
        console.error('[email] falha no SMTP:', e && e.message);
        return resposta(502, { message: 'Falha no SMTP' });
      }
    }
    // Outras rotas do Brevo (estatísticas etc.) não existem no SMTP.
    return resposta(404, { message: 'Não disponível no SMTP da Hostinger' });
  };
  globalThis.fetch.__original = fetchOriginal;
  return true;
}

module.exports = { instalarSmtp };
