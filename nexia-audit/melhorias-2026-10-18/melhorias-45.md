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

# Melhoria 47: Cache semântico de respostas e de leitura de arquivos

- **Status:** Proposto
- **Regra:** Mesma pergunta/contexto em até 24 h reaproveita a resposta armazenada. A chave é um hash normalizado da pergunta + contexto.
- **Por quê:** Rapidez na resposta e economia de cota de modelo/leitura.
- **Custo:** 0 (usa KV/D1 gratuitos do Cloudflare).
- **Justificativa:** Evita chamadas desnecessárias ao modelo e leituras repetidas de arquivos para perguntas/conteúdos idênticos dentro de um dia.

