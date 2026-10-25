# Como mandar pedidos ao Cortex

O Cortex é a inteligência artificial da NEXIA que executa tarefas de desenvolvimento. Para pedir algo ao Cortex, você tem duas opções:

## Métodos para enviar pedidos

### 1. Via /meu-cortex
Acesse a página `/meu-cortex` no site e digite seu pedido diretamente no chat.

### 2. Via GitHub Issues
Crie uma nova issue no repositório com o rótulo `cortex-fila`. O Cortex irá processar automaticamente.

## Tipos de pedidos

### Pedidos pequenos
- Vão inteiros para o Cortex
- Ideais para mudanças simples
- Resposta rápida

### Pedidos grandes
- Texto longo (mais de 4 frases)
- Mais de 4 arquivos envolvidos
- Arquivos maiores que 40 KB
- O Cortex quebra automaticamente em partes para processar

## Exemplos de pedidos bem escritos

### Exemplo 1: Pequeno (mudar uma cor)
```
Altera a cor do botão principal em src/pages/home/Button.jsx para azul-600
```

### Exemplo 2: Médio (criar uma nova página)
```
Cria uma nova página de contato em src/pages/contato/index.jsx com:
- Formulário simples (nome, email, mensagem)
- Estilo usando Tailwind CSS
- Validação básica
- Envio para email@example.com
```

### Exemplo 3: Grande (refatoração completa)
```
Refatora completamente o módulo de autenticação em src/auth/
- Atualiza para usar Firebase Authentication v9
- Implementa login com Google e GitHub
- Adiciona proteção de rotas em src/router/index.jsx
- Atualiza os testes em tests/unit/auth.test.js
- Documenta as mudanças em docs/auth.md
```

## Dicas importantes

### 1. Cite o caminho do arquivo entre crases
Sempre use crases (```) para mostrar os caminhos dos arquivos que você quer modificar. Isso ajuda o Cortex a entender exatamente o que precisa ser feito.

### 2. Diga o resultado esperado
Descreva claramente o que você quer como resultado final. Em vez de "melhore o código", diga "adicione validação de email e mensagens de erro claras".

### 3. Um assunto por pedido
Evita misturar várias tarefas em um único pedido. Se você precisa fazer coisas diferentes, crie pedidos separados para cada assunto.

## Como escrever um bom pedido

1. **Seja específico**: Quais arquivos? O que exatamente precisa mudar?
2. **Contexto breve**: Por que essa mudança é importante?
3. **Resultado esperado**: Como deve ficar no final?
4. **Restrições**: Alguma tecnologia específica a ser usada?

Lembre-se: quanto mais claro e detalhado for seu pedido, melhor será o resultado final!
