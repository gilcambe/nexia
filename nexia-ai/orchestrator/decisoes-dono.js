'use strict';
// #824 (Melhoria C6): memória do Cortex = decisões do dono que valem para TODO pedido (agentes da fila e
// respostas diretas do app). Lida a cada pedido. Para acrescentar: uma linha curta no fim da lista.
// (JS e não .md porque o Worker não lê arquivos em tempo de execução; cortex-memory.md aponta para cá.)
const DECISOES = Object.freeze([
  'Nada pago: só planos grátis, sem cartão. Nunca proponha serviço, modelo ou plano que cobra.',
  'Ícone e logo de cada app ou site são os do PRÓPRIO produto ou cliente. A marca Kernex aparece só no selo "Feito com Kernex" e no site da Kernex.',
  'Português simples, frases curtas, sem jargão: o dono lê pelo celular.',
  'Não remova nada que já existe (função, tela, rota, texto, teste). Acrescente ou ajuste.',
  'Não mexa em firestore.rules/storage.rules publicadas, em segredos, DNS ou domínios. Nome novo de segredo vai em .env.example e nos workflows nexia-jobs.yml e deploy-cloudflare.yml.',
  'Nunca mande mensagem nem ligue para o WhatsApp de cliente.',
  'Apps no ar (Body Coach, Cortex/Central, Studio Lima, Bezsan) não podem quebrar: comportamento arriscado fica atrás de uma opção desligada por padrão.',
]);

const TEXTO = `DECISÕES DO DONO (valem para todo pedido; nunca contrarie):\n${DECISOES.map(d => `- ${d}`).join('\n')}`;

module.exports = { DECISOES, TEXTO };
