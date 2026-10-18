# Melhoria 45: Auto-correção de falha com o próprio log

- **Status:** Implementado e configurado
- **Funcionamento:** Quando o CI de um PR do Cortex falha, o Cortex recebe as últimas 80 linhas do log de erro e tenta corrigir automaticamente até 2 vezes antes de pedir ajuda ao dono.
- **Por que:** a maioria das falhas de CI é de uma linha (erro de digitação, import quebrado, tipo ausente). Corrigir sozinho custa 0 e não abre chamado desnecessário.
- **Regras respeitadas:** tudo grátis; nenhuma função existente removida; nenhuma mudança em regras do Firestore nem em segredos; `npm test` continua passando.
- **Fluxo:**
  1. CI do PR falha.
  2. O workflow captura as últimas 80 linhas do log de erro (`tail -n 80`).
  3. Envia para o Cortex com o contexto do erro e a instrução de corrigir.
  4. Se o Cortex aplicar a correção e o CI passar, encerra com sucesso.
  5. Se falhar, tenta novamente (máximo 2 tentativas).
  6. Se ainda falhar, avisa o dono ("pedir ajuda") com o log completo.
- **Justificativa:** reduz intervenção manual em falhas triviais de uma linha, com custo zero e sem expor segredos.
