# Matriz de IAs grátis (Kernex)

Ordem Mestra fase 5 (#2719, parte #2847). Só entram provedores **sem cartão**. Os limites mudam sem aviso:
os números abaixo são **aproximados** e servem para comparar. Confira sempre no link da chave.
O robô `node scripts/checkFreeIAModels.js` (npm `ias:conferir`) confere toda semana se o modelo de teste ainda existe.

Última conferência desta tabela: 02/11/2026 (fontes públicas dos provedores; reconferir no link).

| Provedor (vaga na Central) | Modelo de teste | Limite grátis (aprox.) | Pede cartão? | Bom para | Onde pegar a chave |
|---|---|---|---|---|---|
| Google Gemini (`gemini`) | gemini-2.5-flash | poucas centenas de pedidos/dia, ~10 por minuto | Não | texto, código, imagem | https://aistudio.google.com/apikey |
| Groq (`groq`) | llama-3.3-70b-versatile | ~1.000 pedidos/dia, ~30 por minuto | Não | respostas rápidas, código | https://console.groq.com/keys |
| OpenRouter (`openrouter`) | modelos `:free` | ~50 pedidos/dia sem crédito, ~20 por minuto | Não | variedade de modelos | https://openrouter.ai/settings/keys |
| Mistral (`mistral`) | mistral-small-latest | plano grátis de teste, ~1 pedido/segundo | Não (pede telefone) | texto | https://console.mistral.ai/api-keys |
| Codestral (`codestral`) | codestral-latest | plano grátis, ~30 por minuto | Não (pede telefone) | código | https://console.mistral.ai/codestral |
| Cohere (`cohere`) | command-a-03-2025 | chave de teste, ~1.000 pedidos/mês | Não | texto, resumo | https://dashboard.cohere.com/api-keys |
| Hugging Face (`huggingface`) | Llama-3.3-70B-Instruct | créditos pequenos por mês | Não | testes leves | https://huggingface.co/settings/tokens |
| NVIDIA (`nvidia`) | meta/llama-3.3-70b-instruct | créditos de teste, ~40 por minuto | Não | código, texto | https://build.nvidia.com/settings/api-keys |
| Z.ai (`zai`) | glm-4.5-flash | modelo flash grátis | Não | código, texto | https://z.ai/manage-apikey/apikey-list |
| SambaNova (`sambanova`) | Meta-Llama-3.3-70B-Instruct | plano grátis com limite por minuto | Não | texto rápido | https://cloud.sambanova.ai/apis |
| Outra IA (`custom`) | o que você escolher | depende do site | só se o site não pedir | qualquer coisa compatível com OpenAI | site da IA |

## Regras
- Uma conta por provedor. Não criamos contas extras para fugir do limite (termos dos sites).
- Quando a cota do dia acaba (erro 429), o Cortex pula para a próxima vaga da Central, na ordem escolhida lá.
- Os créditos internos (pedidos, tokens e 429 por IA e por dia) ficam no D1 (`ia_cota/uso`, PR #2876).
