#!/usr/bin/env node
// Homologação (#3269): grava o resultado num check-run "Homologação — resultado" do commit,
// para a Central ler (verde/vermelho por produto) sem baixar artifact. Não bloqueia nada sozinho
// (conclusão neutral): quem bloqueia é o job "Homologação".
'use strict';
const fs = require('fs');
const path = require('path');

/** Versão curta do resultado (cabe no limite de 65535 caracteres do check-run). */
function compactar(r) {
  const produtos = {};
  for (const [nome, d] of Object.entries(r.produtos || {})) {
    produtos[nome] = { status: d.status, total: d.total, verdes: d.verdes,
      falhas: (d.casos || []).filter((c) => c.status !== 'verde').slice(0, 30).map((c) => ({ id: c.id, status: c.status, titulo: String(c.titulo || '').slice(0, 160), origem: c.origem || null, log: String(c.log || '').slice(-600) })) };
  }
  return { quando: r.quando, commit: r.commit, aprovado: r.aprovado, produtos };
}

async function publicar({ token, repo, sha, raiz = path.resolve(__dirname, '..', '..'), fetchFn = fetch } = {}) {
  const r = JSON.parse(fs.readFileSync(path.join(raiz, 'homologacao-resultado.json'), 'utf8'));
  const md = fs.existsSync(path.join(raiz, 'homologacao-resumo.md')) ? fs.readFileSync(path.join(raiz, 'homologacao-resumo.md'), 'utf8') : '';
  const corpo = { name: 'Homologação — resultado', head_sha: sha, status: 'completed', conclusion: 'neutral',
    output: { title: r.aprovado ? 'APROVADO' : 'REPROVADO', summary: md.slice(0, 60000), text: JSON.stringify(compactar(r)).slice(0, 65000) } };
  const res = await fetchFn(`https://api.github.com/repos/${repo}/check-runs`, { method: 'POST', body: JSON.stringify(corpo),
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'kernex-homologacao' } });
  if (!res.ok) throw new Error('GitHub respondeu ' + res.status);
  return corpo;
}

if (require.main === module) {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, HOMOLOGACAO_SHA, GITHUB_SHA } = process.env;
  publicar({ token, repo, sha: HOMOLOGACAO_SHA || GITHUB_SHA })
    .then(() => console.log('Resultado gravado para a Central.'))
    .catch((e) => { console.log('Não consegui gravar o resultado para a Central (' + e.message + '). O portão continua valendo.'); });
}
module.exports = { compactar, publicar };
