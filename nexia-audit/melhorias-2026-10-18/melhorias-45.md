# Melhoria 45: Login com Google no endereço do próprio produto

- **Status:** Pronto para configuração
- **Ação manual do dono:** Cadastrar a URL de redirecionamento do domínio próprio no Console do Google / Firebase.
- **Configuração de ambiente:** Definir a variável `AUTH_DOMINIO_PROPRIO=1` no Cloudflare Worker / ambiente de produção.
- **Justificativa:** Oculta `nexia-c8710.firebaseapp.com` na escolha de conta Google, proporcionando uma experiência profissional.
