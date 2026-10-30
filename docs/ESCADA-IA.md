# Escada de trabalho das IAs (regra do dono, 26/10/2026)

**Ordem obrigatória, sempre:**

1. **Cortex primeiro.** Todo pedido (issue `cortex-fila` ou prompt direto no chat do Cortex) começa no Cortex, com a cadeia de IAs grátis dele (Groq → Gemini → Codestral → NVIDIA → Workers AI → Mistral → OpenRouter free → Z.ai → LLM7 → Ollama do PC).
2. **IAs grátis ajudantes depois.** Se o Cortex falhar ou travar, entram ajudantes grátis, um de cada vez: Jules (Google, 15 por dia) e Gemini CLI no GitHub Actions (chave `GEMINI_API_KEY`). Eles corrigem e abrem o PR.
3. **Claude Code por último.** Só quando o Cortex falhou **e** a cota do dia dos ajudantes grátis acabou (ou eles falharam 2 vezes). O Claude termina aquela tarefa, abre o PR e **se retira**. Quando a cota grátis volta (virada do dia), as tarefas que o Claude ainda não pegou voltam para o degrau 2.

Nada pago em nenhum degrau. O Claude usa a assinatura que o dono já tem, nunca chave paga por uso.
Contas web de chat (ChatGPT, Claude.ai, Gemini web) **não** entram na automação: robô logando em conta web quebra os termos e pode banir a conta. Elas só entram à mão, pelo botão **📦 Continuar em outra IA** da Central.

## Rótulos da escada (GitHub)

| Degrau | Rótulo | Quem age |
|---|---|---|
| 1 | `cortex-fila` (e `cortex-travado` quando falha) | Cortex |
| 2 | `degrau-gratis` + `jules-enviado` ou `gemini-cli` | Jules ou Gemini CLI |
| 3 | `vez-do-claude` | Claude Code |
| fim | `so-humano` | só o dono decide (chave, regra, algo irreversível) |

Cada vez que a tarefa sobe ou desce de degrau, a escada comenta na issue: **"🪜 Degrau N: quem, por quê, cota que restava"**. Assim fica registrado quem fez o quê.

## O que já roda sozinho (26/10/2026)
- **Revisor grátis** (`scripts/revisor-gratis.js`, a cada 20 min): PR do Cortex ou do Jules com CI verde é revisado por 2 IAs grátis de provedores diferentes. Aprovou → `automerge`. Recusou → `revisor-recusou`, o motivo vai para a issue e a tarefa sobe de degrau. Workflows, regras do Firestore e segredos nunca são aprovados por ele. Desliga com a variável `REVISOR_GRATIS=0`.
- **Escada do Jules** (`cloudflare/jules-auto.js`, a cada 15 min): Jules sem PR em 1 h volta ao Cortex; 2ª falha vai para `vez-do-claude`.
- **Claude (degrau 3)**: tarefa agendada a cada 2 h; só age se existir issue `vez-do-claude`. O dono liga e desliga pelo botão da Central.

## O Claude se retira sozinho
- Antes de pegar uma tarefa `vez-do-claude`, o Claude confere o placar de cota (`nexia-ai/model-router/cota.js`). Se algum ajudante grátis já tem cota de novo, devolve a tarefa ao degrau 2 e não escreve código.
- Ao terminar, o Claude escreve uma **lição** curta (erro do Cortex + jeito certo) para `nexia-ai/orchestrator/licoes.js`. É assim que o Cortex aprende e o Claude é chamado cada vez menos.
- Teto: no máximo 5 tarefas do Claude por dia, para não gastar o limite da assinatura do dono.

## Meta e troca de fase
- **Fase A (agora):** o Claude também revisa PRs e testa, como hoje.
- **Fase B:** quando o teste humano do Cortex der **nota 9,5 ou mais por 7 dias seguidos** e 90% das tarefas da semana forem feitas só pelo degrau 1, revisão e teste passam para as IAs grátis (revisor grátis no PR + teste humano automático). O Claude fica só no degrau 3, como reserva.
- A Central mostra o placar: % de tarefas por degrau na semana, nota do teste humano e a cota restante de cada IA.

## Para o prompt direto no chat do Cortex

Mesma escada em tempo real: o Cortex responde; se a resposta falhar (erro de ferramenta, teste vermelho, nota baixa do revisor), uma IA grátis maior (NVIDIA ou Gemini 2.5) refaz a parte que falhou; se as cotas grátis acabaram, o Cortex cria a issue `vez-do-claude` e avisa o dono.

Fluxo de resgate: ao falhar, o Cortex tenta uma única vez com o modelo maior (NVIDIA NIM ou Gemini 2.5). Se essa tentativa falhar, cria a issue com o rótulo `vez-do-claude` e marca o campo `resolvidoPor`. Toda essa etapa só roda quando a variável de controle **CORTEX_RESGATE** estiver ligada.

## Regra final de aprendizado
O Cortex deve aprender com cada tarefa que falhou, registrando a lição para reduzir chamadas a Jules/Claude.

## Tarefas de escopo grande

- Tarefas que modificam **mais de 1 arquivo** ou têm **mais de ~50 linhas** de código/markdown são classificadas como **`cortex-jules`**.
- Essas tarefas **não passam pelas 12 tentativas automáticas** do Cortex (degrau 1). Elas sobem imediatamente para o degrau 2 (`degrau-gratis` + `jules-enviado` ou `gemini-cli`) ou para o degrau 3 (`vez-do-claude`), pulando a automação de tentativas múltiplas.
- O rótulo `cortex-jules` deve ser adicionado automaticamente ou manualmente pelo Cortex quando o escopo for detectado como maior que o limite.
