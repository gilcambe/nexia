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
  'Use só o que o projeto já usa: antes de criar arquivo, confira com github.list_dir que a pasta e o framework existem. Exemplo real: um Answer.vue criado numa pasta que não existe (o projeto não usa Vue) e arquivos src/models com Mongoose/Express, que o projeto também não usa.',
  'Mudança no roteador de modelos (nexia-ai/model-router) ou no chat do Cortex mexe no que está no ar: mude o mínimo, mantenha o formato de chamada e de resposta, rode os testes do model-router e diga no PR que precisa do teste do chat ao vivo. Exemplo real: o PR #1898 forçou tools: true no openai-compatible.js e derrubou o chat.',
  'Ação pública (que o cliente usa sem senha) fica ANTES da checagem de token do painel no handler; depois dela, só ações da agência. Exemplo real: app-viagem e o chat do viajante (#2619) ficaram depois da checagem e o app nunca abria a viagem.',
  'Página nova precisa funcionar de ponta a ponta antes de marcar a tarefa como feita: chamar a API real (/api/...), ter rota em lib/routes.js e não chamar funções que não existem. Exemplo real: vp-editar.html (#2630) foi marcada feita chamando obterUsuario/obterConteudo, que não existem, sem rota e sem falar com a API.',
  'Se a mesma parte falhou 3 vezes, não tente a 4ª igual: divida em pedaços menores, copie uma página parecida que já funciona (ex.: vp-cotacoes.html para páginas de painel do Viajante Pro) ou peça ajuda. Exemplo real: #2623 ficou 11 tentativas presa.',
  'Mensagens de chat precisam de ordem estável: grave um número crescente (ordem) além da data, porque duas mensagens podem ter o mesmo milissegundo; e para "só as novas" filtre pelo id da última, não use startAfter com id em orderBy de data.',
  'Entregue só o que a tarefa pede, nos arquivos que ela cita. Exemplo real: para #2717 (motivos da fila na Central) o PR #2835 criou um workflow nexia-pipeline.yml que ninguém pediu; isso conta como falha.',
]);

const TEXTO = `LIÇÕES APRENDIDAS (erros reais de tarefas anteriores; não repita):\n${LICOES.map(l => `- ${l}`).join('\n')}`;

module.exports = { LICOES, TEXTO };
