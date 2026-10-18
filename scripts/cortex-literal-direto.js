'use strict';
// Cópia literal sem IA: pedido "Copie EXATAMENTE `caminho` ```código```" vira commit + PR direto pela API do GitHub.
// Os modelos grátis cortavam ou reescreviam o código e a tarefa travava; aqui o arquivo é gravado byte a byte.
// Não conclui a tarefa sozinho: no ciclo seguinte, com o arquivo igual na develop, ela é fechada como feita.
const { arquivosLiterais, temEdicaoExtra } = require('../nexia-ai/orchestrator/literal');

const MAX_POR_CICLO = 3;
const nomes = i => (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));

// Só pedidos 100% literais: nada de editar arquivo existente e nada em .github (o token da fila não grava workflows).
function arquivosDiretos(issue) {
  const body = String(issue.body || '');
  const arqs = arquivosLiterais(body);
  if (!arqs.length || temEdicaoExtra(body)) return [];
  if (arqs.some(a => a.path.startsWith('.github/'))) return [];
  return arqs;
}

async function processarDiretos({ issues, abertosPRs, lerArquivo, gravar, abrirPR, concluir, comentar }) {
  const tratados = new Set(); // a fila normal não despacha estas tarefas
  let criados = 0;
  for (const i of issues) {
    const ls = nomes(i);
    if (i.pull_request || ls.includes('cortex-dividido') || ls.includes('cortex-rodando')) continue;
    const arqs = arquivosDiretos(i);
    if (!arqs.length) continue;
    tratados.add(i.number);
    if (abertosPRs.some(p => String((p.head || {}).ref || '').startsWith(`nexia/direto-${i.number}-`))) continue; // PR já a caminho
    const mudar = [];
    for (const a of arqs) {
      const atual = await lerArquivo(a.path);
      if (!atual || atual.content !== a.content) mudar.push({ ...a, sha: atual && atual.sha });
    }
    if (!mudar.length) { await concluir(i.number); continue; }
    if (criados >= MAX_POR_CICLO) continue;
    const ramo = `nexia/direto-${i.number}-${Date.now().toString(36)}`;
    await gravar(ramo, mudar, `Cópia literal do pedido #${i.number}: ${mudar.map(m => m.path).join(', ')}`);
    const pr = await abrirPR(ramo, i, mudar);
    await comentar(i.number, `Gravei ${mudar.length} arquivo(s) direto, sem IA (cópia exata): PR #${pr}. A tarefa fecha sozinha quando entrar na develop.`);
    criados++;
  }
  return tratados;
}

module.exports = { arquivosDiretos, processarDiretos, MAX_POR_CICLO };
