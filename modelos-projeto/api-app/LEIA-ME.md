# {{nome}}
API grátis na Cloudflare (Worker) com a página "{{titulo}}" em `publico/index.html`.
Rotas: `GET /saude`, `GET /itens` e `POST /itens` (corpo: `{ "texto": "..." }`).
Os itens ficam na memória do Worker: servem para testar; para guardar de vez, ligue um banco.
Publicar: `npx wrangler deploy` (nome do serviço: {{slug}}).
