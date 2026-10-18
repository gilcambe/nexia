# Melhoria 45: Contexto do projeto no prompt (mapa + arquivos prováveis)

- **Status:** Implementado
- **Objetivo:** Antes de agir, o Cortex busca por palavras do pedido (ripgrep) e entrega só os 5 a 8 arquivos relevantes e o MAPA.md, evitando que o modelo fraco leia arquivos sem editar (NO_CHANGES ×12).
- **Custo:** 0 (busca com ripgrep local, sem chamadas extras de modelo).
- **Arquivos entregues:** até 8 arquivos relevantes + MAPA.md.
- **Fluxo:**
  1. Receber o pedido do usuário.
  2. Extrair palavras-chave do pedido.
  3. Executar ripgrep nos arquivos do repositório buscando essas palavras.
  4. Selecionar os 5 a 8 arquivos mais relevantes.
  5. Entregar o MAPA.md com a visão geral do projeto.
  6. Apenas então propor ou aplicar edições nos arquivos relevantes.
- **Regras de ouro:**
  - Todas as melhorias são gratuitas (sem serviços pagos).
  - Nenhuma função existente é removida.
  - Não mexer em regras do Firestore.
  - Não mexer em segredos (variáveis de ambiente, tokens, chaves).
  - `npm test` deve passar após as mudanças.
- **Arquivo de referência:** `nexia-audit/melhorias-2026-10-18/melhorias-45.md` (esta lista completa).
- **MAPA do projeto:** `MAPA.md` na raiz do repositório.
