// Cliente de envio de e-mail via Brevo (conta gratuita).
// Requer a variável de ambiente BREVO_API_KEY.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendBrevoEmail({ to, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada');
  }

  const payload = {
    sender: { name: 'NEXIA Monitoramento', email: 'alertas@nexia.ai' },
    to: [{ email: to }],
    subject,
    textContent: text,
    htmlContent: html || text,
  };

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo ${response.status}: ${body}`);
  }

  return await response.json();
}
