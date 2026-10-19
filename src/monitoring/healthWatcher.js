import { BREVO_API_KEY } from '../config/environment'; // Assumindo que as variáveis de ambiente estão em ../config/environment
import { sendEmail } from '../notification/brevoClient'; // Assumindo que brevoClient exporta sendEmail
import { logError } from '../utils/logger'; // Assumindo um utilitário de log

let consecutiveFailures = 0;
const failureThreshold = 2;
const pollingInterval = 60000; // 1 minuto

export const startHealthWatcher = (healthCheckUrl, appName) => {
  setInterval(async () => {
    try {
      const response = await fetch(healthCheckUrl);
      if (!response.ok) {
        consecutiveFailures++;
        if (consecutiveFailures >= failureThreshold) {
          const subject = `Alerta de Queda: ${appName} - ${healthCheckUrl}`;
          const text = `O endpoint ${healthCheckUrl} falhou ${consecutiveFailures} vezes consecutivas. Verifique o status do ${appName}.`;
          const html = `<p>O endpoint <strong>${healthCheckUrl}</strong> falhou ${consecutiveFailures} vezes consecutivas. Verifique o status do ${appName}.</p>`;

          if (BREVO_API_KEY) {
            await sendEmail({
              to: 'seu-email@exemplo.com', // Substituir pelo e-mail de notificação real
              from: 'noreply@seudominio.com', // Substituir pelo e-mail remetente
              subject: subject,
              textContent: text,
              htmlContent: html,
            });
            console.log(`Alerta de queda enviado para ${healthCheckUrl}`);
          } else {
            console.warn('BREVO_API_KEY não configurada. Alerta de e-mail não enviado.');
          }
          // Resetar contagem após enviar alerta para evitar spam, ou implementar lógica mais complexa
          // consecutiveFailures = 0;
        }
      } else {
        consecutiveFailures = 0; // Resetar contagem se a verificação for bem-sucedida
      }
    } catch (error) {
      consecutiveFailures++;
      logError(`Erro ao verificar health check ${healthCheckUrl}: ${error.message}`);
      if (consecutiveFailures >= failureThreshold) {
        const subject = `Alerta de Queda: ${appName} - ${healthCheckUrl}`;
        const text = `O endpoint ${healthCheckUrl} falhou ${consecutiveFailures} vezes consecutivas com erro. Verifique o status do ${appName}.`;
        const html = `<p>O endpoint <strong>${healthCheckUrl}</strong> falhou ${consecutiveFailures} vezes consecutivas com erro. Verifique o status do ${appName}.</p><p>Erro: ${error.message}</p>`;

        if (BREVO_API_KEY) {
          await sendEmail({
            to: 'seu-email@exemplo.com', // Substituir pelo e-mail de notificação real
            from: 'noreply@seudominio.com', // Substituir pelo e-mail remetente
            subject: subject,
            textContent: text,
            htmlContent: html,
          });
          console.log(`Alerta de queda (erro) enviado para ${healthCheckUrl}`);
        } else {
          console.warn('BREVO_API_KEY não configurada. Alerta de e-mail não enviado.');
        }
        // Resetar contagem após enviar alerta
        // consecutiveFailures = 0;
      }
    }
  }, pollingInterval);

  console.log(`Health watcher iniciado para ${healthCheckUrl} com intervalo de ${pollingInterval / 1000}s.`);
};

export const resetConsecutiveFailures = () => {
  consecutiveFailures = 0;
};
