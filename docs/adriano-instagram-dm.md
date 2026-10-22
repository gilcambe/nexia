# Guia de Configuração — Resposta Automática no Instagram Direct (Adriano Blumer)

Este guia explica como configurar a resposta automática no Instagram Direct ("Private Reply") por palavras-chave em comentários de posts do Instagram do Adriano Blumer (`@adrianoblumer_nutri`).

---

## 1. Requisitos Prévios

1. **Conta Profissional do Instagram:** A conta `@adrianoblumer_nutri` deve ser do tipo **Profissional** (Comercial ou Criador de Conteúdo).
2. **Página do Facebook Conectada:** A conta do Instagram precisa estar vinculada a uma Página do Facebook administrada pela mesma conta.

---

## 2. Passos no Meta for Developers

### Passo 1: Criar o Aplicativo Meta
1. Acesse [developers.facebook.com](https://developers.facebook.com) e faça login.
2. Clique em **Meus Apps** → **Criar App**.
3. Selecione o tipo de aplicativo **Business** (Negócios) e preencha os dados básicos.

### Passo 2: Adicionar o Produto Instagram Graph API
1. No painel do App, adicione o produto **Instagram Graph API**.
2. Vincule a Página do Facebook conectada ao perfil `@adrianoblumer_nutri`.

### Passo 3: Permissões Necessárias e App Review
Para que o sistema consiga ler comentários e enviar mensagens privadas automáticas em produção para qualquer usuário, o aplicativo precisa passar pela revisão da Meta (**App Review**) para obter **Acesso Avançado** às permissões:
- `instagram_manage_comments` (para receber os eventos de comentários via webhook)
- `instagram_manage_messages` (para enviar mensagens no Direct em resposta aos comentários)

> **Importante (Modo de Desenvolvimento):** Antes da aprovação no App Review, o sistema funciona em modo de teste apenas para contas do Instagram que possuem função no app (administradores, desenvolvedores ou testadores cadastrados na aba *Funções do App*).

---

## 3. Configuração do Webhook

1. No painel do desenvolvedor Meta, vá em **Instagram** → **Configuração do Webhook**.
2. Clique em **Editar Subscrição do Webhook** e preencha:
   - **URL de Callback:** `https://<dominio-ou-cloudflare>/api/instagram-dm`
   - **Token de Verificação:** Digite uma senha/token seguro (este mesmo valor será salvo na variável `IG_VERIFY_TOKEN`).
3. Marque o evento **`comments`** para receber notificações de novos comentários.
4. Clique em **Verificar e Salvar**.

---

## 4. Variáveis de Ambiente na Cloudflare / Hosting

Cadastre as seguintes variáveis de ambiente no painel da Cloudflare (ou no ambiente de produção onde a API roda). **Nunca coloque estes valores diretamente no código nem em logs público.**

| Variável | Descrição | Exemplo / Onde encontrar |
| :--- | :--- | :--- |
| `META_APP_SECRET` | Chave secreta do aplicativo Meta para validar a assinatura do webhook (`X-Hub-Signature-256`) | Painel do App Meta → Configurações do App → Básico → Chave Secreta do App |
| `IG_VERIFY_TOKEN` | Token de verificação escolhido na configuração do webhook | O mesmo texto informado no campo "Token de Verificação" no webhook da Meta |
| `IG_PAGE_TOKEN` | Token de Acesso de Longa Duração da Página/Instagram com permissões ativas | Gerado no Token Generator do Meta Developers ou Graph API Explorer |
| `IG_USER_ID` | ID numérico da conta do Instagram Business/Criador | ID obtido via Meta Graph API (`GET /v19.0/me?fields=id,instagram_business_account`) |

---

## 5. Como Testar e Validar

1. **Painel do Nutricionista:** No painel do site do Adriano, cadastre as regras de palavras-chave (ex.: palavras `["consulta", "agendar"]`, mensagem `"Olá! Acesse o biolink para informações de consulta: https://biolink.website/nutriadriano"`).
2. **Teste em Post:** Com uma conta de teste (ou qualquer conta após aprovação da Meta), publique um comentário em um post do `@adrianoblumer_nutri` contendo uma das palavras cadastráveis (ex.: *"Quero saber sobre consulta"*).
3. **Verificação:** O autor do comentário receberá em poucos segundos uma mensagem privada no Instagram Direct com o texto e o link configurado.

---

## 6. Limites, Proteções Anti-Spam e Boas Práticas

- **Desduplicação por Comentário:** Cada comentário (`comment_id`) recebe no máximo 1 mensagem privada. O ID é registrado em `nutri_contas/adriano/dm_enviados/`.
- **Limite por Usuário (24 h):** Para evitar envio repetido ou spam, o sistema envia no máximo 1 DM a cada 24 horas para o mesmo perfil do Instagram (`from_user_id`).
- **Própria Conta Ignorada:** Comentários feitos pela própria conta `@adrianoblumer_nutri` são ignorados.
- **Janela e Políticas da Meta:** A resposta privada ("private reply") deve respeitar as diretrizes da Meta contra spam. Envie sempre links HTTPS diretos do perfil e mensagens informativas e respeitosas.
