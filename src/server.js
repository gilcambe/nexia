import express from 'express';
import { startHealthWatcher } from './monitoring/healthWatcher';
// Importar outras dependências conforme necessário

const app = express();
const port = process.env.PORT || 3000;

// Configurações do Body Coach (exemplo)
const BODY_COACH_HEALTH_URL = process.env.BODY_COACH_HEALTH_URL || 'http://localhost:3001/health'; // URL do health check do Body Coach
const APP_NAME_BODY_COACH = 'Body Coach';

// Iniciar o health watcher para o Body Coach
startHealthWatcher(BODY_COACH_HEALTH_URL, APP_NAME_BODY_COACH);

// Rotas da API principal
app.get('/', (req, res) => {
  res.send('Servidor principal rodando!');
});

// Endpoint de health check básico para o servidor principal (opcional)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Outras rotas e configurações da aplicação...

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

// Exportar app para testes ou deploy serverless (ex: Cloudflare Workers)
export default app;

// --- NOTAS ---
// 1. As variáveis de ambiente (BREVO_API_KEY, BODY_COACH_HEALTH_URL) devem ser configuradas corretamente no ambiente de produção (Cloudflare).
// 2. O e-mail de notificação ('seu-email@exemplo.com') e o e-mail remetente ('noreply@seudominio.com') em healthWatcher.js precisam ser definidos.
// 3. A importação de '../config/environment' e '../utils/logger' são suposições. Ajuste os caminhos conforme a estrutura real do projeto.
// 4. Para o Body Coach, assumi que ele expõe um endpoint /health e que sua URL está em BODY_COACH_HEALTH_URL.
