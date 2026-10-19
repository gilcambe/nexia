import { BREVO_API_KEY } from '../config/environment'; // Assumindo que as variáveis de ambiente estão em ../config/environment

export const sendEmail = async ({ to, from, subject, textContent, htmlContent }) => {
  if (!BREVO_API_KEY) {
    console.warn('BREVO_API_KEY não está configurada. Não é possível enviar e-mail.');
    return { success: false, message: 'API Key não configurada' };
  }

  const endpoint = 'https://api.brevo.com/v3/smtp/email';

  const emailData = {
    to: [{ email: to }],
    from: { email: from },
    subject: subject,
    textContent: textContent,
    htmlContent: htmlContent,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro ao enviar e-mail via Brevo:', response.status, errorData);
      return { success: false, message: errorData.message || 'Erro desconhecido do Brevo' };
    }

    const data = await response.json();
    console.log('E-mail enviado com sucesso via Brevo:', data);
    return { success: true, data: data };

  } catch (error) {
    console.error('Erro de rede ou de requisição ao enviar e-mail via Brevo:', error);
    return { success: false, message: error.message };
  }
};
