# Escada de trabalho das IAs (regra do dono, 26/10/2026)

**Ordem obrigatória, sempre:**

1. **Cortex primeiro.** Todo pedido (issue `cortex-fila` ou prompt direto no chat do Cortex) começa no Cortex, com a cadeia de IAs grátis dele (Groq → Gemini → Codestral → NVIDIA → Workers AI → Mistral → OpenRouter free → Z.ai → LLM7 → Ollama do PC).
   - **Regra de multi-arquivo (27/10/2026):** O Cortex atua no planejamento, divisão de tarefas, conferência de CI, validação de provas e avisos. Tarefas pequenas (1 arquivo) são executadas diretamente pelas IAs grátis do Cortex. Tarefas que mexem em **mais de 1 arquivo** ou alteram mais de ~50 linhas vão direto para o **Jules** (`cortex-jules`), sem gastar tentativas nas IAs menores. Se a cota diária do Jules (15) estiver esgotada, a tarefa aguarda na fila em vez de retroceder para IAs menores.
2. **IAs grátis ajudantes depois.** Se o Cortex falhar ou travar (ou se a tarefa tiver múltiplos arquivos), entram ajudantes grátis, um de cada vez: Jules (Google, 15 por dia) e Gemini CLI no GitHub Actions (chave `GEMINI_API_KEY`). Eles corrigem e abrem o PR.
3. **Claude Code por último.** Só quando o Cortex falhou **e** a cota do dia dos ajudantes grátis acabou (ou eles falharam 2 vezes). O Claude termina aquela tarefa, abre o PR e **se retira**. Quando a cota grátis volta (virada do dia), as tarefas que o Claude ainda não pegou voltam para o degrau 2.

Nada pago em nenhum degrau. O Claude usa a assinatura que o dono já tem, nunca chave paga por uso.
Contas web de chat (ChatGPT, Claude.ai, Gemini web) **não** entram na automação: robô logando em conta web quebra os termos e pode banir a conta. Elas só entram à mão, pelo botão **📦 Continuar em outra IA** da Central.

## Rótulos da escada (GitHub)

| Degrau | Rótulo | Quem age |
|---|---|---|
| 1 | `cortex-fila` (e `cortex-travado` quando falha) | Cortex |
| 2 | `degrau-gratis` + `jules-enviado` ou `gemini-cli` ou `cortex-jules` | Jules ou Gemini CLI |
| 3 | `vez-do-claude` | Claude Code |
| fim | `so-humano` | só o dono decide (chave, regra, algo irreversível) |

Cada vez que a tarefa sobe ou desce de degrau, a escada comenta na issue: **"🪜 Degrau N: quem, por quê, cota que restava