export interface CentralAlert {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  status: 'active' | 'resolved';
}

class MonitorService {
  private failures: Record<string, number> = {};

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

  private async triggerAlert(source: string, message: string) {
    console.error(`[ALERTA AUTOMÁTICO DE QUEDA] ${source}: ${message}`);
    // Integração Brevo grátis e registro na Central via API ou estado local
  }

  getFailures() {
    return this.failures;
  }
}

export const monitorService = new MonitorService();
