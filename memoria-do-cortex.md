# Memória do Cortex - Decisões do Dono

Este arquivo contém as decisões e regras fundamentais do projeto, lido a cada pedido para evitar repetir erros já corrigidos.

## Regras Fundamentais

### 1. Tudo é Gratuito
- **Regra:** Nenhuma funcionalidade pode ter custo pago
- **Por quê:** Manter o produto acessível para todos
- **Exemplo:** Uso de Brevo (gratuito) para notificações em vez de serviços pagos

### 2. Experiência Profissional
- **Regra:** Sem referências a domínios de terceiros
- **Implementação:** Login com Google no endereço do próprio produto
- **Configuração:** `AUTH_DOMINIO_PROPRIO=1` e `FIREBASE_AUTH_PROXY_DOMAIN`

### 3. Resposta Imediata
- **Regra:** Perguntas são respondidas na hora, sem abrir issue
- **Aplicação:** Perguntas como "como estamos?" ou "o que falta?" são respondidas imediatamente
- **Custo:** 0 (sem fila para perguntas)
- **Apenas pedidos de código viram issue"

### 4. Divisão de Tarefas
- **Regra:** Tarefas grandes são divididas automaticamente em pequenas
- **Critério:** 3ª falha ou toque em mais de 4 arquivos
- **Por quê:** Tarefas pequenas passam na revisão e teste
- **Processo:** Estimativa na entrada, divisão precoce de pedidos multi-arquivo

### 5. Monitoramento 24h
- **Objetivo:** Monitorar endpoints e aplicativo
- **Ferramenta:** Health watcher com alerta por e-mail (Brevo grátis)
- **Implementação:** Polling a cada minuto, conta falhas consecutivas
- **Registro:** Eventos na Central de monitoramento

## Decisões de Arquitetura

### Stack Tecnológica
- **Frontend:** React + TypeScript + TailwindCSS
- **Backend:** Node.js + Express
- **Deploy:** Cloudflare
- **Banco de dados:** Firebase (Firestore, Storage) + Cloudflare D1
- **Autenticação:** Firebase com domínio próprio

### Princípios de Design
- **Semântico:** HTML5 semântico para acessibilidade
- **Responsivo:** Mobile-first design
- **Performance:** Lazy loading, otimização de imagens
- **Segurança:** Nunca expor segredos, validação de entrada

## Fluxos de Trabalho

### Desenvolvimento
1. Estimativa na entrada do pedido
2. Divisão automática de tarefas grandes
3. Implementação seguindo padrões existentes
4. Testes obrigatórios (`npm test` deve passar)
5. Revisão de código

### Monitoramento
1. Health check a cada minuto
2. Alerta após 2 falhas consecutivas
3. Notificação por e-mail (Brevo)
4. Registro na Central

## Regras de Negócio

### Autenticação
- Domínio próprio para login
- Proxy de autenticação via Cloudflare
- Sem referências a nexia-c8710.firebaseapp.com

### Notificações
- Apenas serviços gratuitos
- Brevo para e-mails
- Central para eventos internos

### Processo
- Perguntas → resposta imediata
- Pedidos de código → issue
- Tarefas grandes → divisão automática
- Estimativas → na entrada

## Histórico de Decisões

- **Melhoria 45:** Login com Google no domínio próprio
- **Melhoria 46:** Respostas diretas sem abrir issue
- **Melhoria 47:** Divisão automática de tarefas grandes
- **Alerta automático:** Monitoramento 24h com Brevo grátis

---
*Última atualização: 2026-10-19*