'use strict';
// Cortex no celular (/meu-cortex): os pedidos do Cortex são as issues "cortex-fila" do GitHub.
// O histórico fica guardado lá para sempre, de graça, e não depende da Claude.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com';

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (i) => Math.max(0, parseInt((i.body || '').match(/tentativas:\s*(\d+)/i)?.[1] || '0', 10));
