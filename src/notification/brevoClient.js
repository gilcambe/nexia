'use strict';
/**
 * Cliente de notificação via Brevo (conta gratuita).
 * Envia e-mail de alerta usando a variável de ambiente BREVO_API_KEY.
 */

const https = require('https');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'alertas@nexia.app';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'NEXIA Monitoramento';
const TO_EMAIL = process.env.BREVO_TO_EMAIL || 'suporte@nexia.app';

/**
 * Envia e-mail de alerta através da API do Brevo.
 * @param {{subject: string, html?: string, text?: string}} params
 */
function sendAlertEmail(params) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      reject(new Error('BREVO_API_KEY não definida'));
      return;
    }

    const payload = JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: TO_EMAIL }],
      subject: params.subject || 'Alerta NEXIA',
      htmlContent: params.html || '',
      textContent: params.text || '',
    });

    const req = https.request(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`Brevo retornou ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout ao chamar Brevo'));
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendAlertEmail,
};
