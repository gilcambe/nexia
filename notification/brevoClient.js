'use strict';
/**
 * Cliente Brevo (SMTP API) — envio de e-mail de alerta.
 * Requer a variável de ambiente BREVO_API_KEY (conta gratuita do Brevo).
 */
const fetch = require('node-fetch');

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada');
  }
  if (!to) {
    throw new Error('Destinatário (to) não informado');
  }

  const body = {
    sender: { name: 'NEXIA Monitoramento', email: 'nao-responda@nexia.app' },
    to: [{ email: to }],
    subject,
    textContent: text || '',
    htmlContent: html || '',
  };

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Brevo ${res.status}: ${txt}`);
  }
  return await res.json();
}

module.exports = { sendEmail };
