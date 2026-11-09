# Homologação Kernex

Regra do dono (09/11/2026): **nenhuma versão de nenhum projeto sai sem a homologação verde.**

- O job **Homologação** roda dentro do CI em todo PR e em todo push na develop. O deploy automático só acontece com o CI verde, e o merge automático exige o check "Homologação" verde.
- Rodar no PC: `node scripts/homologacao/rodar.js` (ou `--produto=kernex-finance`). Resultado em `homologacao-resultado.json` e `homologacao-resumo.md`.
- Casos: cada arquivo de `tests/unit` vira um caso do produto dele, e os casos do catálogo `homologacao/catalogo/*.json` (bugs do dono e casos obrigatórios).
- Status: VERDE; INSTÁVEL (falhou 1 vez e passou na 2ª, ou caso não obrigatório sem teste: não bloqueia, mas aparece); VERMELHO e FALTA TESTE (bloqueiam).
- **Todo bug que o dono relatar vira um caso no catálogo com teste que falha no código antigo e passa no novo, no mesmo PR da correção.**
- GSD Lab (repo privado) tem o próprio portão no repo dele (workflow Homologacao); aqui só aparece o status.
