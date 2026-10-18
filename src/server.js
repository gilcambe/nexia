// Servidor da API NEXIA.
// Inicia o watcher de saúde ao subir o servidor.
import { startHealthWatcher } from './monitoring/healthWatcher.js';

// Watcher de saúde: polling a cada minuto, alerta por e-mail (Brevo) após duas
// falhas consecutivas e registra o evento na Central de monitoramento.
export const watcherInterval = startHealthWatcher(60000);

export default {
  watcherInterval,
};
