// Bateria de leitura do Kernex Finance com as IAs grátis reais (roda no GitHub Actions).
// Lê os prints FALSOS de tests/fixtures/kf-prints e compara com esperado.json. Sai com erro se algum falhar.
const fs = require('fs');
const path = require('path');
const p = require('../netlify/functions/prumo.js');
const docs = require('../netlify/functions/prumo-lib/documentos');

const DIR = path.join(__dirname, '../tests/fixtures/kf-prints');
const esperado = JSON.parse(fs.readFileSync(path.join(DIR, 'esperado.json'), 'utf8'));
const perto = (a, b) => Math.abs(a - b) <= Math.max(0.05, b * 0.01);
const soma = (l) => Math.round(l.reduce((s, x) => s + (Number(x.valor) || 0), 0) * 100) / 100;

(async () => {
  const linhas = []; let falhas = 0;
  for (const [nome, e] of Object.entries(esperado)) {
    const img = { mime: 'image/jpeg', data: fs.readFileSync(path.join(DIR, nome + '.jpg')).toString('base64') };
    const t0 = Date.now(); let ok = false; let det = '';
    try {
      if (e.modo === 'carteira') {
        const r = await p.lerPrint([img], p.deps);
        const s = soma((r && r.itens) || []);
        ok = !!r && perto(s, e.soma) && r.itens.length >= e.itens;
        det = `itens ${r ? r.itens.length : 0}/${e.itens}, soma ${s} (esperado ${e.soma}) ${r ? r.itens.map((i) => `${i.nome}=${i.valor}`).join('; ') : 'SEM LEITURA'}`;
      } else {
        const [j] = await docs.lerComVisao([img], p.deps);
        const n = ((j && j.lancamentos) || []).map((x) => docs.normalizarLancamento(x, j));
        const l = n.filter((x) => x.ok).map((x) => x.item);
        const fora = n.filter((x) => !x.ok).map((x) => x.motivo);
        const desp = soma(l.filter((x) => x.tipo === 'despesa'));
        const rec = soma(l.filter((x) => x.tipo === 'receita'));
        ok = !!j && (e.despesas == null || perto(desp, e.despesas)) && (e.receitas == null || perto(rec, e.receitas));
        det = `tipo ${j && j.tipo_documento}, lançamentos ${l.length}, despesas ${desp} (esperado ${e.despesas}), receitas ${rec}${e.receitas ? ` (esperado ${e.receitas})` : ''}${fora.length ? ` DESCARTADOS: ${fora.join(', ')}` : ''} ${l.map((x) => `${x.descricao || x.estabelecimento}=${x.valor}/${x.tipo}/${x.categoria}`).join('; ')}`;
      }
    } catch (err) { det = 'ERRO ' + String(err && err.message).slice(0, 200); }
    if (!ok) falhas++;
    linhas.push(`${ok ? 'OK   ' : 'FALHA'} ${nome} (${Math.round((Date.now() - t0) / 1000)} s): ${det}`);
    console.log(linhas[linhas.length - 1]);
  }
  const resumo = `\n== Kernex Finance: ${linhas.length - falhas} de ${linhas.length} prints lidos certo ==`;
  console.log(resumo);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['## Bateria de prints', '', ...linhas.map((l) => '- ' + l), resumo].join('\n') + '\n');
  process.exit(falhas ? 1 : 0);
})();
