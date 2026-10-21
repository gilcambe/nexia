'use strict';
// Cortex → Jules: o dono manda uma tarefa travada para o Jules (Google, plano grátis) resolver.
// O Jules abre o PR sozinho, SEM o rótulo automerge. A chave fica só no servidor (JULES_API_KEY e, de reserva, JULES_API_KEY1).
// API oficial: POST https://jules.googleapis.com/v1alpha/sessions (cabeçalho X-Goog-Api-Key).
// Limites do plano grátis: 15 sessões por dia e 3 ao mesmo tempo. Quando passa, a API recusa e a mensagem volta clara.

const URL_JULES = 'https://jules.googleapis.com/v1alpha/sessions';
const FONTE = 'sources/github/gilcambe/nexia';
const MAX_CORPO = 30000;

const REGRAS = [
  'Leia primeiro AGENTS.md e docs/CONTEXTO-IA.md (repo gilcambe/nexia, base develop). Responda em português do Brasil, simples e objetivo.',
  '',
  'Contexto: o Cortex (robô do projeto) travou nesta tarefa. O pedido dele foi escrito por uma IA fraca e pode estar ERRADO: caminhos inventados, placeholders ([...], SEU_USUARIO/SEU_REPO, \'seu_token_aqui\'), chaves de JSON inventadas, código genérico que ignora a arquitetura. NÃO execute o texto literalmente. Entenda a intenção, inspecione o código ATUAL de develop e implemente do jeito que o projeto já faz.',
  '',
  'Regras:',
  '1. Antes de codar, verifique se o trabalho já existe em develop (git log, leitura do código). Se já está feito, NÃO refaça: corrija só o que falta e documente a evidência.',
  '2. Nada de dados inventados (telefone, e-mail, textos, logos). Se faltar dado real, omita e liste no PR.',
  '3. Sem segredos nem tokens padrão. Não mexer em domínio, DNS, regras do Firestore, chaves ou dados de produção.',
  '4. Preserve autenticação (só dono/master), isolamento por cliente e testes existentes. Não remova validação para fazer passar.',
  '5. Função Netlify NÃO grava em disco (nada de fs.writeFileSync nem require() de JSON de estado).',
  '6. Um único PR, para develop, em ramo próprio. Sem merge, sem deploy e SEM rótulo automerge. Faça rebase em develop antes de abrir o PR.',
  '7. Rode os comandos reais do package.json (typecheck, testes, build) e mostre a saída real. Se algo falhar, compare com develop limpo antes de culpar sua mudança. Se um teste de navegador (Playwright) citar um texto que você mudou, ajuste a asserção.',
  '8. No PR informe: causa raiz do travamento, arquivos alterados, resultados reais dos testes e riscos. Use "Refs #NUMERO".',
].join('\n');

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const limpar = (s) => String(s || '').replace(/AIza[0-9A-Za-z_-]{20,}/g, '[oculto]').replace(/gh[pousr]_[0-9A-Za-z]{20,}/g, '[oculto]').replace(/sk-[0-9A-Za-z_-]{20,}/g, '[oculto]');

function montarPrompt(i, n) {
  const corpo = String(i.body || '').slice(0, MAX_CORPO);
  return REGRAS + '\n\nTAREFA (issue #' + n + '): ' + String(i.title || '') + '\n\nTexto do pedido do Cortex (pode estar errado, veja as regras):\n' + corpo + '\n\nNo PR use "Refs #' + n + '".';
}

async function chamarJules(chave, corpo, fetchFn) {
  const r = await fetchFn(URL_JULES, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave }, body: JSON.stringify(corpo) });
  const dados = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, dados };
}

// p = { gh } (mesma ajuda dos outros pedidos). env e fetchFn podem ser trocados nos testes.
async function mandarParaJules(p, n, quem, { env = process.env, fetchFn = fetch } = {}) {
  const chaves = [env.JULES_API_KEY, env.JULES_API_KEY1].filter(Boolean);
  if (!chaves.length) return { status: 500, corpo: { error: 'Falta a chave do Jules (JULES_API_KEY) no servidor.' } };
  const caminho = '/repos/gilcambe/nexia/issues/' + n;
  const i = await p.gh(caminho);
  if (i.state !== 'open') return { status: 400, corpo: { error: 'O pedido #' + n + ' está fechado. Reabra antes de mandar para o Jules.' } };
  if (nomes(i).includes('jules-enviado')) return { status: 409, corpo: { error: 'O pedido #' + n + ' já foi enviado ao Jules. Veja o PR dele no GitHub.' } };

  const pedido = {
    prompt: montarPrompt(i, n),
    title: ('#' + n + ' ' + String(i.title || '')).slice(0, 90),
    sourceContext: { source: FONTE, githubRepoContext: { startingBranch: 'develop' } },
    automationMode: 'AUTO_CREATE_PR',
  };

  let ultimo = null;
  for (const chave of chaves) {
    ultimo = await chamarJules(chave, pedido, fetchFn);
    if (ultimo.ok) break;
    if (![401, 403, 429].includes(ultimo.status)) break; // outra chave só ajuda em erro de chave ou de limite
  }
  if (!ultimo.ok) {
    const msg = limpar((ultimo.dados.error && ultimo.dados.error.message) || ultimo.dados.message || '');
    const dica = ultimo.status === 429 ? ' Limite do plano grátis (15 por dia, 3 ao mesmo tempo): espere uma sessão terminar ou volte amanhã.'
      : ultimo.status === 401 || ultimo.status === 403 ? ' A chave do Jules foi recusada: crie outra em jules.google/settings#api.' : '';
    return { status: 502, corpo: { error: 'O Jules recusou (' + ultimo.status + ').' + dica + (msg ? ' ' + msg.slice(0, 200) : '') } };
  }

  const id = String(ultimo.dados.id || String(ultimo.dados.name || '').replace(/^sessions\//, '') || '');
  const link = id ? 'https://jules.google.com/session/' + encodeURIComponent(id) : 'https://jules.google.com';
  // Tarefa "na fila": o Cortex ainda a pegaria sozinho e as duas IAs fariam o mesmo trabalho. Trava para ele.
  const ls = nomes(i);
  const rotulos = ['jules-enviado'];
  if (!ls.includes('cortex-travado') && !ls.includes('cortex-dividido')) rotulos.push('cortex-travado');
  await p.gh(caminho + '/labels', { method: 'POST', body: JSON.stringify({ labels: rotulos }) }).catch(() => null);
  await p.gh(caminho + '/comments', { method: 'POST', body: JSON.stringify({ body: 'Enviado ao Jules por ' + quem + '. Sessão: ' + link + '\nO Jules abre o PR sozinho (sem automerge). Confira o CI antes de juntar.' }) }).catch(() => null);
  return { status: 200, corpo: { ok: true, sessao: id, link, mensagem: 'Pedido #' + n + ' enviado ao Jules. Ele abre o PR sozinho; confira o CI antes de juntar.' } };
}

module.exports = { mandarParaJules, montarPrompt, REGRAS };
