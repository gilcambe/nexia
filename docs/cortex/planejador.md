# Como funciona o Planejador de Tarefas do Cortex

O Planejador é a inteligência do Cortex que transforma um pedido grande em várias partes pequenas, para o trabalho ser mais rápido e eficiente. Ele usa o arquivo `scripts/cortex-plano.js` para organizar tudo.

### Como um pedido é dividido

Quando você faz um pedido grande, o Planejador do Cortex quebra o trabalho em partes pequenas:

1.  **Até 8 partes**: Seu pedido é dividido em no máximo 8 partes menores.
2.  **Limites por parte**: Cada parte tem regras claras:
    *   Pode mexer em no máximo **3 arquivos**
    *   Pode mudar até **400 linhas** de código ou texto (somando o que é adicionado e o que é apagado)
3.  **Dependências**: Cada parte diz de quais outras partes ela precisa. Por exemplo, se uma parte precisa de uma página que outra vai criar, ela depende dessa parte.
4.  **Critério de "pronto"**: Cada parte tem um jeito claro de saber quando terminou. Pode ser um teste que passou ou algo visível no site.

### Como o trabalho é executado

*   **Pistas paralelas**: Partes que não dependem uma da outra podem rodar ao mesmo tempo, como carros em diferentes pistas. Imagine 6 pistas de corrida: o Cortex pode até 6 partes ao mesmo tempo, cada uma em sua "pista", desde que não mexam nos mesmos arquivos.
*   **Esperando as dependências**: Se uma parte precisa do resultado de outra, ela espera a parte anterior terminar e o código dela (o "PR" - Pull Request) ser aprovado e juntado na branch principal (`develop`). Essa espera dura no máximo **6 horas**.
*   **Sem conflitos**: Duas partes nunca mexem no mesmo arquivo ao mesmo tempo, para evitar erros.

### Quando a IA tem dificuldades

Se a IA que cria o plano não conseguir entender seu pedido, o Cortex usa um "plano simples". Nesse caso:
- Cada parte cuida de um arquivo específico do seu pedido
- Todas as partes rodam ao mesmo tempo, sem dependências
- Se você citou 5 arquivos, serão criadas 5 partes, cada uma cuidando de um arquivo
- Isso evita que o plano fique travado e garante que o trabalho comece rápido

### Detalhes do planejador (em `scripts/cortex-plano.js`)

O planejador funciona assim:

1.  **Classifica o pedido**: Verifica se é grande, médio ou pequeno, pelo texto, arquivos citados e tamanho deles.
2.  **Cria as partes**: Divide em até 8 partes, cada uma com seus limites de arquivos e linhas.
3.  **Define dependências**: Cada parte indica quais outras partes ela precisa para funcionar.
4.  **Executa em paralelo**: Partes sem dependência rodam juntas em pistas diferentes, mas sem mexer nos mesmos arquivos.

**Importante**: Tudo isso é controlado pelo arquivo `scripts/cortex-plano.js`, que funciona como o "cérebro" do planejador, garantindo que seu pedido seja executado de forma organizada e eficiente.