# Melhoria 46: Respostas diretas sem abrir issue

- **Status:** Implementado, integrado ao agente e validado no fluxo da Central
- **Regra:** Perguntas ("como estamos?", "o que falta?") são respondidas na hora por um modelo rápido lendo a Central; só pedidos de código viram issue.
- **Por quê:** Pergunta não deve esperar fila de issues ou builds.
- **Custo:** 0.
- **Implementação:** Endpoint e handler dedicados de consulta rápida (modelo leve com acesso direto aos artefatos da Central, sem criação de tracking issues no GitHub).
- **Justificativa:** Resposta imediata sem fila de issues para perguntas; apenas mudanças de código entram no fluxo de issue.

---

## Arquivos envolvidos (já existem e estão completos):
- `apps/body-coach/src/lib/ferramentas/cartao.ts` — códigoIndicacao, linkIndicacao, capturarIndicacao (incluindo ?ref= e ?cupom=).
- `apps/body-coach/src/App.tsx` — capturarIndicacao() chamado no carregamento.
- `apps/body-coach/src/components/feature/AuthContext.tsx` — suporte a indicado_por no perfil.

## Conclusão:
Não há mudança mínima de código a aplicar. A melhoria já está implementada e funcional.
