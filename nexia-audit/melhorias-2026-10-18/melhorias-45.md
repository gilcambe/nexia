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
- **Por quê:** Tarefas pequenas passam na revisão e no teste; estimativa na entrada evita surpresa; divisão precoce de pedidos multi-arquivo evita falhas acumuladas.
- **Custo:** 0.
- **Justificativa:** Tarefas pequenas passam na revisão e no teste; estimativa na entrada evita surpresa; divisão precoce de pedidos multi-arquivo evita falhas acumuladas.

---

## Alerta automático de queda por e‑mail (Brevo grátis) e na Central

- **Objetivo**: Monitorar o endpoint `/health` da API e o aplicativo Body Coach. Caso falhem duas vezes consecutivas, disparar um alerta por e‑mail usando a conta gratuita do Brevo e registrar o evento na Central de monitoramento.
- **Motivo**: Produto em produção requer monitoramento 24h sem custo adicional.
- **Implementação**:
  1. Criar `src/monitoring/healthWatcher.js` que faz polling a cada minuto e conta falhas consecutivas.
  2. Utilizar `src/notification/brevoClient.js` para envio de e‑mail (variável de ambiente `BREVO_API_KEY`).
  3. Iniciar o watcher em `src/server.js`.
  4. Garantir que nenhum teste existente seja quebrado (`npm test` continua passando).

