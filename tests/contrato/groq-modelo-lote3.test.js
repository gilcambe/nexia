'use strict';
// Lote 3 de 3 do contrato da troca do modelo morto do Groq (ver groq-modelo-comum.js).
require('./groq-modelo-comum')(['netlify/functions/multi-model-engine.js', 'netlify/functions/sentinel.js', 'netlify/functions/strike-engine.js', 'netlify/functions/swarm.js']);
