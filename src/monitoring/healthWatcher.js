const { fetch } = require('node-fetch');
const { setInterval } = require('timers');
const brevoClient = require('../notification/brevoClient');

class HealthWatcher {
  constructor() {
    this.apiFailures = 0;
    this.bodyCoachFailures = 0;
    this.maxFailures = 2;
    this.checkInterval = 60000; // 1 minuto
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('HealthWatcher iniciado - monitorando a cada 60 segundos');
    
    // Executa imediatamente o primeiro check
    await this.performChecks();
    
    // Configura o intervalo
    this.intervalId = setInterval(async () => {
      await this.performChecks();
    }, this.checkInterval);
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('HealthWatcher parado');
  }

  async performChecks() {
    try {
      await this.checkApiHealth();
      await this.checkBodyCoachHealth();
    } catch (error) {
      console.error('Erro durante os checks de saúde:', error);
    }
  }

  async checkApiHealth() {
    try {
      const response = await fetch(`${process.env.NEXIA_APP_URL || 'http://localhost:3000'}/health`, {
        timeout: 5000
      });
      
      if (response.ok) {
        this.apiFailures = 0;
        console.log('Check de saúde da API: OK');
      } else {
        this.apiFailures++;
        console.log(`Check de saúde da API: Falha (${this.apiFailures}/${this.maxFailures})`);
        
        if (this.apiFailures >= this.maxFailures) {
          await this.handleHealthFailure('API');
        }
      }
    } catch (error) {
      this.apiFailures++;
      console.log(`Check de saúde da API: Erro (${this.apiFailures}/${this.maxFailures})`, error.message);
      
      if (this.apiFailures >= this.maxFailures) {
        await this.handleHealthFailure('API');
      }
    }
  }

  async checkBodyCoachHealth() {
    try {
      const response = await fetch(`${process.env.NEXIA_APP_URL || 'http://localhost:3000'}/api/body-coach/health`, {
        timeout: 5000
      });
      
      if (response.ok) {
        this.bodyCoachFailures = 0;
        console.log('Check de saúde do Body Coach: OK');
      } else {
        this.bodyCoachFailures++;
        console.log(`Check de saúde do Body Coach: Falha (${this.bodyCoachFailures}/${this.maxFailures})`);
        
        if (this.bodyCoachFailures >= this.maxFailures) {
          await this.handleHealthFailure('Body Coach');
        }
      }
    } catch (error) {
      this.bodyCoachFailures++;
      console.log(`Check de saúde do Body Coach: Erro (${this.bodyCoachFailures}/${this.maxFailures})`, error.message);
      
      if (this.bodyCoachFailures >= this.maxFailures) {
        await this.handleHealthFailure('Body Coach');
      }
    }
  }

  async handleHealthFailure(service) {
    console.log(`${service} falhou ${this.maxFailures} vezes consecutivas - enviando alerta`);
    
    try {
      await brevoClient.sendAlertEmail(service);
      console.log(`Alerta enviado para ${service}`);
    } catch (error) {
      console.error('Falha ao enviar alerta por e-mail:', error);
    }
    
    // Registra o evento na Central de monitoramento
    this.logToCentral(`ALERTA: ${service} está inativo após ${this.maxFailures} falhas consecutivas`);
  }

  logToCentral(message) {
    // Aqui seria implementada a lógica para registrar na Central de monitoramento
    // Por enquanto, apenas logamos no console
    console.log(`[CENTRAL] ${new Date().toISOString()}: ${message}`);
  }
}

module.exports = new HealthWatcher();