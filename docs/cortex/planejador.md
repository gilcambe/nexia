# Como funciona o Planejador de Tarefas do Cortex

O Planejador é a inteligência do Cortex que transforma um pedido grande em várias partes pequenas, para o trabalho ser mais rápido e eficiente. Ele usa o arquivo `scripts/cortex-plano.js` para organizar tudo.

### Como um pedido é dividido

Quando você faz um pedido grande, o Planejador do Cortex faz o seguinte:

1.  **Divide em partes pequenas**: Seu pedido é quebrado em até 8 partes. Cada parte é um pedacinho do trabalho total.
2.  **Limites por parte**: Para garantir que cada parte seja rápida e gerenciável:
    *   Cada parte mexe em no máximo **3 arquivos**.
    *   Cada parte pode ter até **400 linhas** de código ou texto mudadas (somando o que foi adicionado e o que foi apagado).
3.  **Dependências**: Cada parte indica de quais outras partes ela depende. Por exemplo, uma parte que adiciona um botão pode depender de uma parte anterior que criou a página onde esse botão vai estar.
4.  **Critério de "pronto"**: Para cada parte, é definido um critério claro para saber quando ela está finalizada. Geralmente, é um teste que passou ou um resultado visível no site ou sistema.

### Como o trabalho é executado

*   **Pistas de trabalho**: Partes que não dependem uma da outra podem rodar ao mesmo tempo, como carros em pistas diferentes. O Cortex pode usar até **6 pistas** para acelerar o trabalho.
*   **Esperando as dependências**: Se uma parte depende de outra, ela espera a parte anterior ser concluída e o código dela (o "PR" - Pull Request) ser aprovado e entrar na branch principal (`develop`). Essa espera tem um limite de **6 horas** para não atrasar o projeto.
*   **Sem bagunça**: Duas partes nunca vão mexer no mesmo arquivo ao mesmo tempo. Isso evita conflitos e erros no código.

### Quando a inteligência artificial tem dificuldades

Se a IA que cria o plano completo não conseguir ou não entender bem o pedido, o Cortex tem um "plano simples". Nesse caso, ele divide o trabalho em partes onde cada parte cuida de um arquivo citado no seu pedido, e todas essas partes rodam ao mesmo tempo.

### Como o plano é criado (detalhes técnicos)

O planejador é implementado no arquivo `scripts/cortex-plano.js` e funciona da seguinte forma:

1.  **Classificação do pedido**: O sistema verifica se o pedido é grande, médio ou pequeno com base no texto, nos arquivos citados e no tamanho deles.
2.  **Divisão em partes**: Pedidos grandes são divididos em até 8 partes, cada uma com:
    *   Até **3 arquivos** para modificar
    *   Até **400 linhas** mudadas (acréscimos + exclusões)
    *   Uma lista das partes de que depende
    *   Um critério claro de quando a parte está "pronta"
3.  **Dependências**: Cada parte indica de quais outras partes ela depende. Por exemplo, uma parte que adiciona um botão pode depender de uma parte anterior que criou a página onde esse botão vai estar.
4.  **Execução paralela**: Partes sem dependência mútua rodam ao mesmo tempo em pistas diferentes (até 6 pistas), mas duas partes nunca mexem no mesmo arquivo ao mesmo tempo.