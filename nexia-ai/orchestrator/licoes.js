'use strict';
// Livro de lições do Cortex (melhoria 7 da análise de 2026-10-07): erros reais que as tarefas já cometeram e
// foram corrigidos pela Claude. Todo agente que escreve código lê isto no começo de cada tarefa.
// Para acrescentar uma lição: uma linha curta no fim da lista, dizendo o erro e o jeito certo.
// (Arquivo JS e não .md porque o Worker não lê arquivos em tempo de execução.)
const LICOES = Object.freeze([
  'Não invente funções nem importações: antes de usar um módulo ou função, abra o arquivo que a define (github.get_file) e confira o nome e os parâmetros. Exemplo real: "router.complete" não existe; o roteador de modelos usa router.chat e listFor.',
  'Funções assíncronas pedem await. Exemplo real: verifyBearerToken sem await deixava qualquer pessoa passar sem login.',
  'Nada de exemplo fixo apresentado como resultado: se o pedido é um cardápio, treino ou cálculo, o código deve calcular a partir dos dados da pessoa. Exemplo real: um cardápio entregue com 3 refeições escritas à mão.',
  'Todo handler novo do servidor precisa ser registrado em cloudflare/functions.js e em lib/routes.js; sem isso a rota não existe no Worker.',
  'Em React/JSX não coloque um bloco novo dentro de um ternário (a ? x : y); coloque antes ou depois dele.',
  'Dados do Body Coach ficam em bodycoach_users/{uid}/{profile|meals|workouts|daily_readiness|progress_entries|medical_exams}; use getUserDoc/setUserDoc de lib/userData.ts e nunca importe de "@/mocks".',
  'No YAML de workflow, um "#" fora de aspas vira comentário e corta a expressão ${{ }}; coloque o valor inteiro entre aspas.',
  'Mudança pequena e exata funciona melhor que reescrever: faça só o que o pedido manda, nos arquivos que ele cita, e copie os trechos "find" exatamente como estão no arquivo.',
  'Todo workflow novo em .github/workflows entra no teste de detecção; todo arquivo novo de teste fica em tests/unit com final .test.js.',
]);

const TEXTO = `LIÇÕES APRENDIDAS (erros reais de tarefas anteriores; não repita):\n${LICOES.map(l => `- ${l}`).join('\n')}`;

module.exports = { LICOES, TEXTO };
