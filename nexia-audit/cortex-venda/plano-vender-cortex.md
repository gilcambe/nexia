# Plano: Venda do Cortex para Clientes

## Visão Geral
Implementar sistema de acesso controlado para clientes do Cortex, onde cada cliente só pode acessar seus próprios dados em `cortexClientes/{uid}/...`

## Dependências
- "Cortex Venda 1"

## Arquivos Criados
- `lib/cortex-cliente.js` - Helper para validação de tokens e acesso
- `cloudflare/app.js` - Rotas `/api/cortex-cliente/*` com validação
- `tests/unit/cortex-cliente.test.js` - Testes unitários

## Requisitos
1. Toda rota nova `/api/cortex-cliente/*` confere token Firebase
2. Acesso apenas a `cortexClientes/{uid}/...` (dados do próprio cliente)
3. Sem firebase-admin (usar JWT parsing simples)
4. Regras do Firestore só no PR (publicação pelo dono)

## Cenários de Teste
- Cliente A tenta acessar dados do cliente B → 403
- Sem token → 401
- Token válido com uid correspondente → 200

## Implementação
### lib/cortex-cliente.js
- `validateFirebaseToken(token)` - Valida formato e extrai uid
- `validateClientToken(request)` - Extrai token do header Authorization
- `uidDoCaminho(pathname)` - Extrai uid do caminho da rota
- `validarAcessoCliente(request, pathname)` - Valida token e confere uid

### cloudflare/app.js
- Importa `validarAcessoCliente` de `../lib/cortex-cliente`
- Rotas `/api/cortex-cliente/*` usam o middleware
- Retorna 401/403 conforme erro

## Status
- ✅ Implementação básica
- ✅ Validação de token
- ✅ Controle de acesso por uid
- ❌ Testes unitários
- ❌ Integração com Firestore
