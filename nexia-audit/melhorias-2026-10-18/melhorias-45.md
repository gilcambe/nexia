# Melhoria 45: Login com Google no endereço do próprio produto

- **Status:** Implementado e configurado
- **Ação manual do dono:** Cadastrar a URL de redirecionamento do domínio próprio no Console do Google / Firebase.
- **Configuração de ambiente:** Definir `AUTH_DOMINIO_PROPRIO=1` e `FIREBASE_AUTH_PROXY_DOMAIN` no Cloudflare Worker / ambiente de produção.
- **Implementação:** O Cloudflare Worker repassa as requisições de `/__/auth/` e `/__/firebase/init.json` (`proxyAuth`) e utiliza o domínio próprio (`authDomainProprio`) ocultando `nexia-c8710.firebaseapp.com` na escolha de conta Google.
- **Justificativa:** Proporciona uma experiência profissional e sem referências a domínios de terceiros.

---

# Melhoria 46: Respostas diretas sem abrir issue

- **Status:** Implementado
- **Regra:** Perguntas ("como estamos?", "o que falta?") são respondidas na hora por um modelo rápido lendo a Central; só pedidos de código viram issue.
- **Por quê:** Pergunta não deve esperar fila.
- **Custo:** 0.
- **Justificativa:** Resposta imediata sem fila de issues para perguntas; apenas mudanças de código entram no fluxo de issue.

---

# Melhoria 47: Divisão automática de tarefa grande

- **Status:** Implementado (regra de processo)
- **Regra:** Pedido grande (já na 3ª falha) divide automaticamente em tarefas pequenas antes de executar. Antes de começar: estimativa na entrada. Se o pedido toca mais de 4 arquivos, dividir logo no começo.
- **Por quê:** Tarefas pequenas passam; tarefa grande que falha 3 vezes vira várias pequenas.
- **Custo:** 0.
- **Justificativa:** Tarefas pequenas passam na revisão e no teste; estimativa na entrada evita surpresa; divisão precoce de pedidos multi-arquivo evita falhas acumuladas.

