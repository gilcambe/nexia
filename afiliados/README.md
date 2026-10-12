# Manual do Robô de Ofertas – Afiliados

## 1. O que é
O Robô de Ofertas é um serviço que ajuda você a encontrar promoções e descontos em diversas lojas.
Ele funciona analisando milhares de produtos e selecionando as melhores oportunidades.
Como afiliado, você pode compartilhar esses descontos e ganhar comissões.

O objetivo do programa de afiliados é simples:
- Receber links de ofertas.
- Divulgar esses links em suas redes ou canais.
- Receber pagamento por cada venda gerada.

Tudo isso pode ser feito sem precisar de conhecimentos técnicos avançados.

## 2. Como usar pelo celular
O aplicativo do Robô de Ofertas está disponível para Android e iOS.
Você pode instalar a versão móvel diretamente da loja de aplicativos.

### 2.1 Instalação
1. Abra a loja de aplicativos do seu celular (Google Play ou App Store).
2. Procure por “Robô de Ofertas”.
3. Toque em “Instalar” e aguarde a conclusão.
4. Abra o aplicativo após a instalação.

### 2.2 Cadastro
- Na primeira abertura, você verá a tela de boas‑vindas.
- Toque em “Criar conta”.
- Preencha seu nome, e‑mail e crie uma senha.
- Confirme o e‑mail usando o link que será enviado.
- Faça login com as credenciais criadas.

### 2.3 Navegação básica
- Na barra inferior, você tem quatro ícones principais: Início, Ofertas, Meu link e Perfil.
- Toque em “Ofertas” para ver as promoções disponíveis.
- Use a busca no topo para encontrar um produto específico.
- Ao encontrar uma oferta interessante, toque em “Compartilhar”.
- Escolha entre copiar o link, enviar por WhatsApp, Instagram, ou outras apps.

### 2.4 Gerando seu link de afiliado
- No menu “Meu link”, você verá um link único associado à sua conta.
- Esse link pode ser usado em qualquer lugar: bio do Instagram, descrição de vídeo, e‑mail etc.
- Cada vez que alguém clicar e comprar, a comissão será creditada para você.

### 2.5 Recebendo notificações
- Ative as notificações nas configurações para ser avisado de novas ofertas.
- As notificações podem ser configuradas por categoria de produto.
- Você pode desativar notificações a qualquer momento nas preferências.

## 3. Lojas
O Robô de Ofertas trabalha com centenas de lojas parceiras.
Em elas são agrupadas por categorias para facilitar a navegação.

### 3.1 Principais categorias
- Tecnologia: smartphones, notebooks, acessórios.
- Moda: roupas, calçados, acessórios.
- Casa e cozinha: eletrodomésticos, utensílios, decoração.
- Saúde e beleza: cosméticos, suplementos, equipamentos.
- Esporte e lazer: bicicletas, equipamentos de academia, brinquedos.

### 3.2 Como encontrar uma loja
- Na tela “Ofertas”, toque na aba “Lojas”.
- Use a barra de busca para digitar o nome da loja.
- Selecione a loja para ver todas as promoções ativas.
- Cada loja exibe a taxa de comissão que você receberá.

### 3.3 Dicas para melhorar a performance
- Compartilhe ofertas de lojas que seu público conhece.
- Use imagens e descrições claras ao divulgar.
- Combine ofertas de diferentes categorias para alcançar mais pessoas.
- Atualize seus links regularmente para aproveitar novas promoções.

## 4. Redes e segredos

As redes e segredos são variáveis de ambiente que permitem que o Robô de Ofertas acesse serviços externos, como APIs de pagamento, integrações de e-mail, ou autenticação. Como fonte principal e por motivos de segurança contra commit acidental de credenciais em repositórios públicos, **recomenda-se encarecidamente utilizar o painel do deploy** (Cloudflare Workers Variables e Firebase Functions Config). Caso utilize um arquivo `.env` local para desenvolvimento, **certifique-se de que ele esteja incluído no `.gitignore`** e nunca compartilhado publicamente.

As chaves e tokens abaixo são apenas placeholders genéricos. **Nunca utilize valores reais de produção em exemplos nem faça commits com credenciais reais.**

| Variável / Rede | Descrição / Placeholder | Onde configurar |
|-----------------|-------------------------|-----------------|
| `PAYMENT_API_KEY` | `<PAYMENT_API_KEY>` | Painel Cloudflare / Firebase (ou `.env`) |
| `MAILGUN_API_KEY` | `<MAILGUN_API_KEY>` | Painel Cloudflare / Firebase (ou `.env`) |
| `WHATSAPP_TOKEN`  | `<WHATSAPP_TOKEN>`  | Painel Cloudflare / Firebase |

## 5. WhatsApp

Para compartilhar ofertas via WhatsApp, clique no botão “Compartilhar via WhatsApp” na página de oferta. O link abre o WhatsApp Web ou aplicativo com a mensagem pré‑preenchida contendo o título e link da oferta. 

Essa operação estritamente manual garante que o usuário veja e valide todo o conteúdo e a URL do destino antes de realizar o envio, evitando ataques de phishing e mantendo a segurança da plataforma. Antes de enviar qualquer mensagem com links de redirecionamento, verifique sempre se o domínio do link corresponde ao domínio oficial do parceiro para prevenir qualquer tentativa de engenharia social.

## Conclusão
Com o Robô de Ofertas, você tem uma ferramenta simples e poderosa para gerar renda extra.
Tudo pode ser feito diretamente do celular, sem precisar de um site ou blog.
Comece hoje, siga os passos acima e veja seus resultados crescerem.