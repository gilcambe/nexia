# Manual do Robô de Ofertas – Afiliados

## 1. O que é
O Robô de Ofertas é um assistente inteligente que ajuda afiliados a encontrar, divulgar e ganhar comissões em promoções de lojas online.

- **Encontrar**: pesquisa automática de ofertas em milhares de lojas.
- **Compartilhar**: gera links de afiliado prontos para redes sociais, blogs ou mensagens.
- **Ganhar**: recebe comissão por cada venda que vier pelo seu link.

## 2. Como usar pelo celular
Siga os passos abaixo para começar a usar no seu smartphone.

### 2.1 Instalação
- Abra a Google Play ou App Store.
- Procure por **Robô de Ofertas** e toque em **Instalar**.
- Aguarde a conclusão e abra o aplicativo.

### 2.2 Cadastro
- Toque em **Criar conta**.
- Preencha seu e‑mail, senha e nome completo.
- Confirme o e‑mail através do link enviado.
- Faça login.

### 2.3 Navegação
- A barra inferior contém: Início, Ofertas, Meu link, Perfil.
- Em **Ofertas**, use a busca ou filtros por categoria.
- Em **Meu link**, copie o link exclusivo para compartilhar.

### 2.4 Notificações
- Ative nas configurações para receber alertas de novas promoções.

## 3. Lojas
O aplicativo agrupa lojas por categorias para facilitar a escolha.

### 3.1 Encontrar lojas
- Na aba **Lojas**, navegue ou pesquise pelo nome.
- Cada loja mostra a comissão percentual e o número de produtos.

### 3.2 Dicas de divulgação
- Selecione lojas populares na sua nicho.
- Use imagens nítidas e descrições curtas.
- Atualize os links semanalmente para evitar expirados.

## 4. Redes e segredos
Configure as variáveis de ambiente para que o robô funcione corretamente.

### 4.1 PAYMENT_API_KEY
- Chave de pagamento da plataforma de afiliados.
- Exemplo: `pk_live_xxx`.

### 4.2 MAILGUN_API_KEY
- Chave de API do Mailgun para envio de e‑mails.
- Exemplo: `key-xxxx`.

### 4.3 WHATSAPP_TOKEN
- Token de acesso ao WhatsApp Business API.
- Exemplo: `token-xxxx`.

## 5. WhatsApp
Compartilhe ofertas diretamente no WhatsApp com segurança.

### 5.1 Compartilhar
- Selecione a oferta e toque em **Compartilhar via WhatsApp**.
- O aplicativo abre o WhatsApp com mensagem pré‑preenchida.
- Revise a mensagem antes de enviar.

### 5.2 Segurança
- Mensagem é gerada apenas no seu dispositivo.
- Nenhum dado sensível é enviado ao servidor.

## 6. Regras para não ser bloqueado
Mantenha sua conta e canais ativos seguindo estas regras:

- Não envie links repetidos em grupos.
- Evite spam e mensagens excessivas.
- Respeite as políticas de cada plataforma.
- Identifique claramente os links de afiliado quando exigido.
- Não use bots ou automação não autorizada.
- Verifique periodicamente as diretrizes de cada rede.

## 7. Trocar o nome do site, os temas ou os limites
Você pode personalizar o robô de forma simples:

### 7.1 Nome do site
- Abra o arquivo `src/config/site.ts`.
- Modifique a propriedade `title`.
- Salve e reinicie o servidor.

### 7.2 Temas
- No arquivo `src/styles/theme.css` ajuste cores e fontes.
- Use variáveis CSS para troca rápida.

### 7.3 Limites
- Ajuste as variáveis `MAX_REQUESTS` e `LIMIT_SHARE` no arquivo de ambiente.
- Reinicie o servidor para aplicar as mudanças.

### 7.4 Deploy
Para publicar as alterações, execute o pipeline de CI/CD ou faça upload manual no Cloudflare Workers.

## FAQ
Se precisar de ajuda, acesse a seção de perguntas frequentes no site ou entre em contato com o suporte.

## Licença
Este manual está sob licença MIT. Todos os direitos reservados.


## 1. O que é
O Robô de Ofertas ajuda você a encontrar promoções em diversas lojas para compartilhar e ganhar comissões:
- Receba links de ofertas.
- Divulgue em suas redes ou canais.
- Ganhe por cada venda gerada sem complicação.

## 2. Como usar pelo celular
Instale o app para Android ou iOS pela loja de aplicativos.
- Instalação: Abra a Google Play ou App Store, procure “Robô de Ofertas” e instale.
- Cadastro: Toque em “Criar conta”, preencha seus dados, confirme o e-mail e faça login.
- Navegação: Use a barra inferior (Início, Ofertas, Meu link, Perfil) para buscar e compartilhar ofertas.
- Link de afiliado: No menu “Meu link”, copie seu link exclusivo para usar na bio ou mensagens.
- Notificações: Ative alertas para receber avisos de novas promoções por categoria.

## 3. Lojas
O aplicativo conta com centenas de lojas parceiras organizadas por categorias como Tecnologia, Moda, Casa, Saúde e Esporte.
- Encontre lojas na aba “Lojas” e confira a comissão de cada uma.
- Dicas: Divulgue lojas conhecidas, use imagens claras e atualize seus links regularmente.

## 4. Redes e segredos
Configure as variáveis de ambiente necessárias (`.env`, Cloudflare Workers ou Firebase Functions):
- PAYMENT_API_KEY (`pk_live_xxx`)
- MAILGUN_API_KEY (`key-xxxx`)
- WHATSAPP_TOKEN (`token-xxxx`)

## 5. WhatsApp
Clique em “Compartilhar via WhatsApp” na página da oferta para abrir o app ou WhatsApp Web com mensagem pré-preenchida, garantindo segurança e revisão antes do envio.

## 6. Regras para não ser bloqueado
Para manter sua conta e canais seguros e ativos:
- Não envie links repetidos ou spam em grupos.
- Respeite as políticas e termos de cada plataforma.
- Identifique claramente os links de afiliado quando exigido.
- Não utilize métodos automáticos ou bots não autorizados.

## 7. Trocar o nome do site, os temas ou os limites
Personalize o Robô de Ofertas facilmente:
- Nome do site: Altere o título e exibições no arquivo de configuração.
- Temas: Personalize cores e fontes editando as variáveis CSS e estilos.
- Limites: Ajuste cotas de requisições e compartilhamento nas variáveis de ambiente.