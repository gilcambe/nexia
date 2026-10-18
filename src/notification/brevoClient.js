const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Envia e-mail transacional usando a conta gratuita do Brevo.
 * Requer a variável de ambiente BREVO_API_KEY.
 */
export async function enviarEmailBrevo({
  destinatario,
  assunto,
  conteudoHtml,
  remetente = { email: 'noreply@seudominio.com', nome: 'NEXIA Monitoramento' },
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada');
  }

  const corpo = {
    sender: remetente,
    to: [{ email: destinatario }],
    subject: assunto,
    htmlContent: conteudoHtml,
  };

  const resposta = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Brevo retornou ${resposta.status}: ${texto}`);
  }

  return await resposta.json();
}
