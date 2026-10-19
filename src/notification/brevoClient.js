class BrevoClient {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.baseUrl = 'https://api.brevo.com/v3';
  }

  async sendAlertEmail(subject, message) {
    if (!this.apiKey) {
      console.log('Brevo: BREVO_API_KEY não configurada, alerta apenas no console');
      console.log(`ALERTA: ${subject} - ${message}`);
      return { skipped: true, reason: 'no_api_key' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/smtp/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender: { name: 'NEXIA Quota Watcher', email: 'alerts@nexia.app' },
          to: [{ email: 'admin@nexia.app' }],
          subject: `[NEXIA] Alerta de cota: ${subject}`,
          textContent: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Brevo API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Falha ao enviar alerta por e-mail (Brevo):', error.message);
      throw error;
    }
  }
}

module.exports = new BrevoClient();
