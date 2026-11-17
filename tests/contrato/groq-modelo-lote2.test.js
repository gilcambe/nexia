'use strict';
// Lote 2 de 3 do contrato da troca do modelo morto do Groq (ver groq-modelo-comum.js).
require('./groq-modelo-comum')(['netlify/functions/ai-financial.js', 'netlify/functions/ai-sales-agent.js', 'netlify/functions/central/ia-vagas.js', 'netlify/functions/churn-predictor.js', 'netlify/functions/cortex-agent.js', 'netlify/functions/internal-agents.js']);
