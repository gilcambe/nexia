export interface CentralAlert {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  status: 'active' | 'resolved';
}

class MonitorService {
  private failures: Record<string, number> = {};
  private timer: any = null;

  constructor() {
    this.startMonitoring();
  }

  startMonitoring(intervalMs = 60000) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      this.checkEndpoint(`${baseUrl}/health`, 'Health Check').catch(() => {});
      this.checkEndpoint(`${baseUrl}/body-coach`, 'Body Coach App').catch(() => {});
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkEndpoint(url: string, name: string): Promise<boolean> {
    try {
      const res = await fetch(url);
      if (res.ok) {
        this.failures[name] = 0;
        return true;
      }
    } catch {
      // Falha na requisição
    }
    
    this.failures[name] = (this.failures[name] || 0) + 1;
    if (this.failures[name] >= 2) {
      await this.triggerAlert(name, `Queda detectada: ${name} falhou 2 vezes seguidas.`);
    }
    return false;
  }

  private alerts: CentralAlert[] = [];

  private async triggerAlert(source: string, message: string) {
    console.error(`[ALERTA AUTOMÁTICO DE QUEDA] ${source}: ${message}`);
    
    const alertItem: CentralAlert = {
      id: `${source}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source,
      message,
      status: 'active'
    };
    this.alerts.unshift(alertItem);

    // Envio de e-mail via Brevo API (grátis) se configurado ou simulado/endpoint
    try {
      const brevoApiKey = typeof process !== 'undefined' ? process.env?.BREVO_API_KEY : undefined;
      if (brevoApiKey) {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'NEXIA Monitor', email: 'monitor@nexia.local' },
            to: [{ email: 'admin@nexia.local', name: 'Admin NEXIA' }],
            subject: `[ALERTA DE QUEDA] ${source}`,
            htmlContent: `<p><strong>Alerta Automático de Queda:</strong></p><p>${message}</p><p>Data: ${alertItem.timestamp}</p>`
          })
        });
      }
    } catch (err) {
      console.error('[MonitorService] Erro ao enviar e-mail via Brevo:', err);
    }
  }

  getAlerts(): CentralAlert[] {
    return this.alerts;
  }

  resolveAlert(id: string) {
    this.alerts = this.alerts.map(a => a.id === id ? { ...a, status: 'resolved' } : a);
  }

  getFailures() {
    return this.failures;
  }

  reset() {
    this.failures = {};
    this.alerts = [];
  }
}

export const monitorService = new MonitorService();
