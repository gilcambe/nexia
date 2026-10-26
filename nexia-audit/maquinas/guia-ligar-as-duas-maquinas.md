# Guia: ligar as duas máquinas do Cortex (sem túnel, sem domínio, sem abrir porta)

Este guia faz o PC do dono virar "máquina do Cortex": **o PC chama o Cortex** (só saída de internet), pega uma tarefa leve, roda no Ollama local e devolve o resultado.

Não precisa de runner próprio do GitHub nem de túnel `trycloudflare`.

## Máquinas

| PC | Caminho | Modelo | RAM |
|----|---------|--------|-----|
| PC1 | `C:\NEXIA` | `qwen2.5:1.5b` | 8 GB |
| PC2 | `DESKTOP-PN2IG2Q` | `qwen2.5:3b` | 16 GB |

## Como funciona (cada PC)

1. O agente (`agente.ps1`) roda em segundo plano.
2. A cada 15 s envia um **pulso** (nome, CPU, RAM, modelos, Ollama ok) para `POST /nexia/maquinas/pulso`.
3. Pede uma tarefa em `GET /nexia/maquinas/tarefa?nome=`.
4. Se houver tarefa pendente, chama `http://localhost:11434/v1/chat/completions` no Ollama local.
5. Devolve o resultado em `POST /nexia/maquinas/resultado`.
6. Aguarda 15 s e repete.

As rotas são protegidas pelo segredo `NEXIA_MAQUINA_TOKEN` (cabeçalho `Authorization: Bearer`).

O instalador (`instalar.ps1`) cria uma tarefa agendada do Windows que dispara **ao ligar o PC**.

## Arquivos

- `tools/agente-maquina/agente.ps1` — agente (PowerShell puro, nada para instalar).
- `tools/agente-maquina/agente.config.json` — configuração ao lado do script.
- `tools/agente-maquina/instalar.ps1` — instala a tarefa agendada.
- `tools/agente-maquina/README.md` — este guia.

## Rotas do Worker (protegidas por `NEXIA_MAQUINA_TOKEN`)

### `POST /nexia/maquinas/pulso`
Recebe `{ nome, cpu, ramTotal, ramLivre, modelos[], ollamaOk }` e salva na tabela D1 `maquinas` (com `visto_em`).

### `GET /nexia/maquinas/tarefa?nome=`
Entrega 1 tarefa pendente da tabela `tarefas_locais` (status `pendente` → `rodando`) ou 204.

### `POST /nexia/maquinas/resultado`
Grava `{ id, texto, ms, tokens }` (status `feito`) ou erro.

### `GET /nexia/maquinas` (só admin)
Lista as máquinas para o card "Máquinas" da Central.

## Provedor `local` no roteador
Em vez de chamar URL externa, o roteador enfileira em `tarefas_locais` e espera até 90 s. Se nenhuma máquina teve pulso nos últimos 2 min, a tarefa é pulada na hora. Só para classes internas leves (classificar, resumir, título). Nunca chat de cliente, nunca código.

## Instalação em cada PC

1. Copie `tools/agente-maquina/` para o PC.
2. Edite `agente.config.json` com `NEXIA_URL`, `NEXIA_MAQUINA_TOKEN`, `NEXIA_MAQUINA_NOME` e `NEXIA_MODELO`.
3. Rode `instalar.ps1` (PowerShell como administrador).
4. Confirme que o Ollama está rodando em `localhost:11434` com o modelo configurado.

## Central — card "Máquinas"
Lê `GET /nexia/maquinas` (só admin) e mostra: nome, online/offline, CPU, RAM livre, modelo, tarefas feitas hoje.

---
*Feito com Kernex — máquina do Cortex, sem túnel, sem domínio, sem porta aberta.*
