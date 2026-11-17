'use strict';
// Lote 1 de 3 do contrato da troca do modelo morto do Groq (ver groq-modelo-comum.js).
require('./groq-modelo-comum')(['netlify/functions/account-recovery.js', 'netlify/functions/ads-engine.js', 'netlify/functions/agents.js', 'netlify/functions/agents/business_agent.js', 'netlify/functions/agents/dev_agent.js', 'netlify/functions/agents/security_agent.js']);
