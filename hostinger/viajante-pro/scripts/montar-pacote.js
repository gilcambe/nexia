'use strict';
// Monta a pasta de deploy da Hostinger (tudo que o app precisa, e nada além disso).
// Uso: node hostinger/viajante-pro/scripts/montar-pacote.js [pasta-destino]
// Padrão: dist/viajante-pro-hostinger/
// O workflow vp-hostinger-deploy.yml roda isto e envia a pasta para a branch deploy/hostinger-viajante,
// que é a branch ligada ao app Node.js na Hostinger (push -> publica).
const fs = require('node:fs');
const path = require('node:path');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..', '..');
const DEST = path.resolve(process.argv[2] || path.join(REPO, 'dist', 'viajante-pro-hostinger'));

function copiar(origem, destino) {
  const st = fs.statSync(origem);
  if (st.isDirectory()) {
    fs.mkdirSync(destino, { recursive: true });
    for (const f of fs.readdirSync(origem)) {
      if (f.startsWith('.') && f !== '.env.example') continue;
      copiar(path.join(origem, f), path.join(destino, f));
    }
  } else {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

// 1) o servidor
for (const f of ['package.json', 'server.js', '.env.example', 'lib', 'public', 'sql', 'scripts/verificar.js']) {
  copiar(path.join(APP, f), path.join(DEST, f));
}
// 2) o site e a API, do jeito que estão no repositório (sem nenhuma mudança)
for (const f of ['viajante-pro', 'core', 'netlify/functions/viajante-pro.js', 'netlify/functions/viajante-pro-painel.js', 'netlify/functions/viajante-pro-fase2.js', 'netlify/functions/leads.js', 'clientes/viajantepro.js', 'lib/routes.js']) {
  copiar(path.join(REPO, f), path.join(DEST, 'app', f));
}
fs.writeFileSync(path.join(DEST, 'LEIA-ME.txt'),
  'Pacote do Viajante Pro para a Hostinger (app Node.js).\n' +
  'Gerado automaticamente a partir de gilcambe/nexia (develop). NÃO edite aqui: edite no repositório.\n' +
  'Como publicar e configurar: MIGRACAO_HOSTINGER.md no repositório.\n');

// 3) conferência de segurança: nada de segredo no pacote
const proibidos = [/FIREBASE_SERVICE_ACCOUNT\s*[:=]\s*['"{]/, /xkeysib-[a-z0-9]/i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
function varrer(p) {
  for (const f of fs.readdirSync(p)) {
    const c = path.join(p, f);
    if (fs.statSync(c).isDirectory()) { varrer(c); continue; }
    if (f === '.env' || f === 'config.php') throw new Error('Arquivo proibido no pacote: ' + c);
    if (!/\.(js|json|html|txt|sql|md|css|webmanifest|example)$/.test(f)) continue;
    const t = fs.readFileSync(c, 'utf8');
    for (const re of proibidos) if (re.test(t)) throw new Error(`Possível segredo em ${c} (${re})`);
  }
}
varrer(DEST);
console.log('Pacote montado em ' + DEST);
