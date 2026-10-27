# Guia: Ollama de reserva para o Cortex (leigo)

Este guia mostra como deixar um computador com Ollama como IA de reserva **só para a fila interna do Cortex** (programar, revisar). Nunca para clientes.

## O que você vai precisar

- Um computador Windows ligado quando quiser usar a reserva.
- Conta no GitHub (para colocar os segredos).
- Conta no Cloudflare (grátis) para o túnel.

## Passo 1 — Instalar o Ollama no Windows

1. Acesse https://ollama.com e baixe o instalador para Windows.
2. Execute o instalador e siga as telas (só clicar em Avançar).
3. Depois de instalado, o Ollama roda em segundo plano na porta 11434.

## Passo 2 — Baixar o modelo

Abra o Prompt de Comando ou PowerShell e rode:

```powershell
ollama pull qwen2.5-coder:7b
```

Isso baixa o modelo de código (cerca de 5 GB). Aguarde terminar.

## Passo 3 — Expor o Ollama com Cloudflare Tunnel

Como o computador está em casa/escritório, o Cortex não consegue acessá-lo direto. O túnel grátis do Cloudflare resolve isso.

1. No painel do Cloudflare (dash.cloudflare.com), crie um túnel (Cloudflare Tunnel).
2. Instale o `cloudflared` no Windows seguindo as instruções do painel.
3. Configure o túnel para apontar um endereço público (ex.: `https://seu-tunnel.cloudflare.com`) para `http://localhost:11434`.
4. Anote a URL pública do túnel (ex.: `https://seu-tunnel.cloudflare.com/v1`).
5. O Cloudflare gera um token do túnel. Guarde-o (não precisa colocar no GitHub, só no `cloudflared`).

## Passo 4 — Colocar os 3 segredos no GitHub

No repositório do NEXIA, acesse Settings → Secrets and variables → Actions e adicione:

| Segredo | Valor exemplo |
|---------|---------------|
| `OLLAMA_URL` | `https://seu-tunnel.cloudflare.com/v1` |
| `OLLAMA_TOKEN` | (token do túnel, se exigido pelo seu Cloudflare; senão deixe vazio) |
| `OLLAMA_MODELO` | `qwen2.5-coder:7b` |

Se `OLLAMA_URL` estiver vazio, o provedor Ollama **não existe** e nada muda no Cortex.

## Como saber se está funcionando

Acesse no navegador a URL do túnel seguida de `/api/tags`, por exemplo:

```
https://seu-tunnel.cloudflare.com/api/tags
```

Deve retornar uma lista JSON com o modelo `qwen2.5-coder:7b`.

## Regras importantes

- Este provedor serve **apenas jobs internos** do Cortex (programar, revisar).
- Nunca aparece no chat de clientes.
- Se o computador desligar, a fila do Cortex pula o Ollama após 5 segundos e segue normalmente.

---

*Feito com Kernex* — IA grátis de reserva, sem cartão.
