import { sendEmail } from '../notification/brevoClient';

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

          const brevoApiKey = process.env.BREVO_API_KEY;
          const notificationEmailTo = process.env.NOTIFICATION_EMAIL_TO;
          const notificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;

          if (brevoApiKey && notificationEmailTo && notificationEmailFrom) {
            await sendEmail({
              to: notificationEmailTo,
              from: notificationEmailFrom,
              subject: subject,
              textContent: text,
              htmlContent: html,
            });
            console.log(`Alerta de queda enviado para ${healthCheckUrl}`);
          } else {
            console.warn('BREVO_API_KEY, NOTIFICATION_EMAIL_TO ou NOTIFICATION_EMAIL_FROM não configuradas. Alerta de e-mail não enviado.');
          }
        }
      } else {
        consecutiveFailures = 0;
      }
    } catch (error) {
      consecutiveFailures++;
      console.error(`Erro ao verificar health check ${healthCheckUrl}: ${error.message}`);
      if (consecutiveFailures >= failureThreshold) {
        const subject = `Alerta de Queda: ${appName} - ${healthCheckUrl}`;
        const text = `O endpoint ${healthCheckUrl} falhou ${consecutiveFailures} vezes consecutivas com erro. Verifique o status do ${appName}.`;
        const html = `<p>O endpoint <strong>${healthCheckUrl}</strong> falhou ${consecutiveFailures} vezes consecutivas com erro. Verifique o status do ${appName}.</p><p>Erro: ${error.message}</p>`;

        const brevoApiKey = process.env.BREVO_API_KEY;
        const notificationEmailTo = process.env.NOTIFICATION_EMAIL_TO;
        const notificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;

        if (brevoApiKey && notificationEmailTo && notificationEmailFrom) {
          await sendEmail({
            to: notificationEmailTo,
            from: notificationEmailFrom,
            subject: subject,
            textContent: text,
            htmlContent: html,
          });
          console.log(`Alerta de queda (erro) enviado para ${healthCheckUrl}`);
        } else {
          console.warn('BREVO_API_KEY, NOTIFICATION_EMAIL_TO ou NOTIFICATION_EMAIL_FROM não configuradas. Alerta de e-mail não enviado.');
        }
      }
    }
  }, pollingInterval);

  console.log(`Health watcher iniciado para ${healthCheckUrl} com intervalo de ${pollingInterval / 1000}s.`);
};

export const resetConsecutiveFailures = () => {
  consecutiveFailures = 0;
};
