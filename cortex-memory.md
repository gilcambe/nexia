# 🧠 Memória do Cortex - Decisões do Dono

> A lista que o Cortex lê a cada pedido fica em `nexia-ai/orchestrator/decisoes-dono.js` (o Worker não lê .md). Mude lá.

## Regras Fundamentais

### ✅ Nada Pago
- Sempre priorizar soluções gratuitas
- Usar serviços gratuitos sempre que possível
- Evitar custos adicionais para o produto

### 🎯 Ícone do Produto
- Ícone e logo de cada app ou site são os do PRÓPRIO produto ou cliente
- A marca Kernex aparece só no selo "Feito com Kernex" e no site da Kernex

### 🇧🇷 Português Simples
- Linguagem clara e direta
- Evitar termos técnicos desnecessários
- Focar na comunicação efetiva

## Decisões Importantes

### 🔒 Segurança
- Nunca expor segredos em commits ou arquivos públicos
- Validar todas as entradas de dados
- Autenticar e autorizar no servidor
- Tratar erros com mensagens claras para usuários

### 🏗️ Arquitetura
- Manter stack consistente (node, firebase, react, typescript, cloudflare)
- Seguir padrões de pastas e nomes existentes
- Não remover funções existentes sem necessidade
- Respeitar limites de tokens e APIs

### 📝 Desenvolvimento
- Ler arquivos vizinhos antes de modificar
- Seguir estilo de código já estabelecido
- Testar todas as mudanças (`npm test` deve passar)
- Documentar mudanças significativas

### 🔄 Processos
- Dividir tarefas grandes automaticamente
- Estimar esforço na entrada do pedido
- Evitar acumular falhas em multi-arquivos
- Responder perguntas imediatamente sem criar issues

### 🚀 Deploy
- Apenas via pipeline automatizado
- Nunca fazer deploy direto da branch principal
- Respeitar ambiente de produção
- Manter variáveis de ambiente seguras

### 📊 Monitoramento
- Implementar alertas gratuitos para falhas críticas
- Monitorar endpoints de saúde regularmente
- Registrar eventos na Central de monitoramento
- Notificar por e-mail quando necessário (Brevo grátis)

## Erros a Evitar

❌ Não repetir:
- Expor segredos em código
- Quebrar testes existentes
- Ignorar validação de dados
- Deixar funções assíncronas sem await
- Criar branches fora do padrão `nexia/...`
- Modificar regras do Firestore ou segredos
- Incluir bibliotecas desnecessárias

## Checklist Rápido

Antes de finalizar qualquer tarefa:
- [ ] Verificar se `npm test` passa
- [ ] Confirmar que nada foi pago
- [ ] Incluir ícone apropriado
- [ ] Usar português claro
- [ ] Não remover funções existentes
- [ ] Respeitar arquitetura atual

*Última atualização: 2026-10-19*