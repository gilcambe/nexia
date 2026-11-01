# Cortex Qualidade Q3: nunca travar, troca de IA se a resposta não começar em 4 s

Plano: `nexia-audit/cortex-venda/plano-vender-cortex.md`. Prioridade zero: qualidade.

Tarefa, na rota `cortex-chat` e no roteador (`nexia-ai/model-router`, `nexia-ai/orchestrator/runtime.js`):
- se a primeira palavra não chegar em 4 s, cancelar (AbortController) e tentar o próximo provedor, sem a pessoa perceber;
- se a resposta parar no meio por mais de 8 s, continuar com outro provedor a partir do que já foi escrito;
- tempo máximo total de 60 s, depois disso mensagem clara "não consegui agora, tente de novo" com botão, nunca tela parada;
- provedor que falhou 3 vezes seguidas fica de castigo por 5 min (guardar no placar compartilhado, não só na execução);
- o app mostra "pensando..." em até 300 ms após enviar.

Pronto quando: testes com provedores falsos (um lento, um que cai no meio, um que dá 429) provam que a pessoa sempre recebe resposta ou a mensagem clara, em até 60 s.
