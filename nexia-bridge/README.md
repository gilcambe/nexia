# NEXIA Bridge

Servidor MCP local (Fase 7). Roda no seu computador e deixa o Claude (Claude Code ou Claude Desktop) ler e alterar a pasta de um projeto com as proteções da spec §8. Fala só por stdio com o cliente MCP: não abre porta, não recebe conexão de fora e não precisa de nenhuma chave.

Requisito: Node 20 ou mais novo. Não tem dependências além do Node.

## 1. Configurar

1. Copie `bridge.example.json` para um lugar **fora** das pastas de projeto, por exemplo `C:/Users/SEU_USUARIO/.nexia-bridge/bridge.json`.
2. Preencha:
   - `stateDir`: pasta onde o Bridge guarda o log e as aprovações. Tem que ficar fora de todos os workspaces.
   - `projects[].project_id`: o id do projeto no Vault (aparece em `/projetos`).
   - `projects[].roots`: pastas que o Claude pode acessar, em caminho absoluto. O Bridge recusa a raiz do disco, a pasta do usuário inteira e qualquer pasta acima dela.
   - `projects[].mode`: `read-only`, `write-confirm` (padrão recomendado) ou `autonomous`.
   - `commands.allow` / `commands.deny`: executáveis extras liberados ou bloqueados.
   - `passEnv`: variáveis de ambiente com nome de segredo que os comandos podem receber (por padrão, `*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*` etc. são removidas).
3. Confira:

```
NEXIA_BRIDGE_CONFIG=C:/Users/SEU_USUARIO/.nexia-bridge/bridge.json node nexia-bridge/bin/nexia-bridge.js check
```

## 2. Ligar no Claude

**Claude Code** (na pasta do projeto):

```
claude mcp add nexia-bridge --env NEXIA_BRIDGE_CONFIG=C:/Users/SEU_USUARIO/.nexia-bridge/bridge.json -- node D:/Projetos/nexia/nexia-bridge/bin/nexia-bridge.js serve
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nexia-bridge": {
      "command": "node",
      "args": ["D:/Projetos/nexia/nexia-bridge/bin/nexia-bridge.js", "serve"],
      "env": { "NEXIA_BRIDGE_CONFIG": "C:/Users/SEU_USUARIO/.nexia-bridge/bridge.json" }
    }
  }
}
```

## 3. Ferramentas

| Ferramenta | O que faz | Classe |
|---|---|---|
| `bridge_projects` | lista os projetos configurados | leitura |
| `workspace_list` | lista arquivos (até 3 níveis; `node_modules`, `.git` etc. não são abertos) | leitura |
| `workspace_read` | lê um arquivo (até 1 MB; secrets com forma conhecida são redigidos) | leitura |
| `workspace_write` | cria ou altera um arquivo | escrita |
| `workspace_delete` | apaga um arquivo (nunca pasta) | apagar |
| `terminal_run` | roda um comando sem shell dentro do workspace | depende do comando |
| `git_status`, `git_diff` | estado e diferenças (sem arquivos sensíveis) | leitura |
| `git_commit` | commita (nunca leva `.env` e afins) | escrita |

Comandos: leitura (`git status`, `ls`...) e testes (`npm test`, `npm run lint/build/typecheck`) são a classe "leitura"/"teste". Shell, `node -e`, `rm -r`, `git reset --hard`, `git push --force` são "perigosos" e sempre pedem pessoa. Deploy e publicação (`firebase deploy`, `wrangler deploy`, `npm publish`, `gcloud`, `aws`...), `sudo` e afins são **negados**: deploy passa pelo pipeline com aprovação, nunca pelo terminal.

## 4. Modos

| Classe | read-only | write-confirm | autonomous |
|---|---|---|---|
| leitura | roda | roda | roda |
| teste | bloqueado | roda | roda |
| escrita de arquivo / commit | bloqueado | pede pessoa | roda |
| comando que altera arquivos | bloqueado | pede pessoa | pede pessoa |
| apagar | bloqueado | pede pessoa | pede pessoa |
| perigoso | bloqueado | pede pessoa | pede pessoa |
| negado | negado | negado | negado |

Em todos os modos: `.env`, chaves, certificados e arquivos de credencial nunca são lidos nem escritos; nada sai da pasta configurada (nem por `..`, nem por symlink, nem por caminho de rede).

## 5. Como funciona a aprovação

- **Se o cliente suporta perguntar à pessoa** (MCP elicitation), o Bridge pergunta direto na janela do Claude. A resposta não passa pelo modelo.
- **Se não suporta**, a ferramenta devolve `confirmation_required` com um `confirmation_id`. O código de aprovação aparece **só** no terminal/log do Bridge, nunca para o modelo. Para aprovar:

```
NEXIA_BRIDGE_CONFIG=... node nexia-bridge/bin/nexia-bridge.js approve <id> <CÓDIGO>
```

  Depois peça ao Claude para repetir a operação. O pedido vale 15 minutos, serve uma vez e só para exatamente a mesma operação. Código errado cancela o pedido.

> **Importante:** a aprovação protege contra o modelo agindo sozinho **pelo Bridge**. Se o mesmo Claude também tiver terminal livre na sua máquina (por exemplo o Bash do Claude Code sem restrição), ele poderia ler o log do Bridge ou a pasta `stateDir`. Nesse caso, negue ao Claude Code o acesso à `stateDir` e aos logs de MCP nas permissões dele, ou use o Bridge pelo Claude Desktop.

## 6. Registro

Cada chamada vira uma linha em `<stateDir>/bridge-log.jsonl` com data, ferramenta, projeto, caminho ou comando (redigido), pasta, resultado, decisão e o cliente que pediu. Nunca guarda conteúdo de arquivo nem saída de comando.

```
NEXIA_BRIDGE_CONFIG=... node nexia-bridge/bin/nexia-bridge.js log 50
```

## 7. Enviar o registro para o NEXIA (opcional)

Assim as operações do seu computador aparecem na tela **Auditoria** do NEXIA, junto com o resto.

1. No NEXIA, abra **Auditoria**, escreva um nome (ex.: "Notebook do Gil") e clique em **Criar token**. Copie o token na hora: ele não aparece de novo.
2. No computador onde o Bridge roda, crie a variável de ambiente `NEXIA_BRIDGE_TOKEN` com esse token. No Windows (PowerShell):
   `[Environment]::SetEnvironmentVariable("NEXIA_BRIDGE_TOKEN", "cole-o-token-aqui", "User")`
3. No `bridge.json`, acrescente o endereço do NEXIA: `"vault": { "url": "https://seu-dominio" }`.
4. Reinicie o Claude. Dois segundos depois de cada operação o Bridge envia o que falta. Para enviar na mão: `node nexia-bridge/bin/nexia-bridge.js sync`.

Se a internet cair, nada se perde: o envio continua de onde parou. Perdeu o computador? Clique em **Revogar** no token, na mesma tela.
