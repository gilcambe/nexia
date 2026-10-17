'use strict';
// Meu Cortex: o dono escreve do jeito que fala, e o pedido já sai com o projeto, as pastas e o cuidado certos,
// como a Claude faria. Um projeto novo é uma linha em PROJETOS.

const PROJETOS = [
  { id: 'cortex', nome: 'o próprio Cortex', re: /\bcortex\b|\bfila\b|vigia|orquestrador|meu cortex/i,
    pastas: 'nexia-ai/, scripts/cortex-fila.js, scripts/vigia-cortex.js, .github/workflows/fila-cortex.yml, src/pages/meu-cortex/, netlify/functions/pedidos.js',
    cuidado: 'Não quebre a fila: ela precisa continuar rodando a cada 15 minutos. Rode os testes de tests/unit/orchestrator* e cortex*.' },
  { id: 'body-coach', nome: 'Body Coach', re: /body ?coach|\btreino|\bdieta|\baluno|\bcoach\b|personal|\bficha\b/i,
    pastas: 'apps/body-coach/src/, netlify/functions/body-coach/, netlify/functions/body-coach-ai.js, netlify/functions/body-coach-chat.js',
    cuidado: 'É o produto que vende: nada pode quebrar para quem já usa. Texto em português simples, bom no celular.' },
  { id: 'bezsan', nome: 'Bezsan Leilões', re: /bezsan|leil[aã]o|gilmar/i, pastas: 'sites/bezsan/, netlify/functions/leilao.js, netlify/functions/agenda.js', cuidado: 'Site de cliente no ar: mude só o que foi pedido.' },
  { id: 'studiolima', nome: 'Studio Lima', re: /studio ?lima|carol|est[eé]tica/i, pastas: 'sites/studiolima/, netlify/functions/agenda.js', cuidado: 'Site de cliente no ar: mude só o que foi pedido.' },
  { id: 'afiliados', nome: 'Achados (afiliados)', re: /afiliad|shopee|achados|ofertas?\b/i, pastas: 'afiliados/, .github/workflows/afiliados.yml', cuidado: 'Nada de chave no código; links de afiliado só pelos arquivos de configuração.' },
  { id: 'divulga', nome: 'Divulga', re: /divulga|instagram|facebook|\bposts?\b/i, pastas: 'divulga/, .github/workflows/divulga.yml', cuidado: 'Não poste nada de verdade em teste: use o modo ensaio.' },
  { id: 'central', nome: 'Central NEXIA', re: /\bcentral\b/i, pastas: 'src/pages/central/, netlify/functions/central.js, central/produtos.js', cuidado: 'Só o dono (master) entra.' },
];

function acharProjeto(texto) {
  const t = String(texto || '');
  return PROJETOS.find((p) => p.re.test(t)) || null;
}

const REGRAS = 'Regras do projeto (não reabrir): tudo grátis (Cloudflare, Firebase Spark, GitHub); nenhum segredo no código; '
  + 'branch nexia/..., PR contra develop; testes passando; não publicar regras do Firestore; / e /health continuam 200; '
  + 'não quebrar o Body Coach nem os sites de clientes.';

function montarPedido(texto, quem) {
  const t = String(texto || '').trim();
  const p = acharProjeto(t);
  const contexto = p
    ? `\n\n**Projeto: ${p.nome}.** Pastas prováveis (confira antes de mudar): ${p.pastas}.\n${p.cuidado}`
    : '\n\nProjeto não indicado: descubra pelo texto e pelos arquivos antes de mudar.';
  return {
    projeto: p ? p.id : null,
    titulo: t.split('\n')[0].slice(0, 90),
    labels: p ? ['cortex-fila', 'projeto-' + p.id] : ['cortex-fila'],
    body: `${t}${contexto}\n\n${REGRAS}\n\n_Pedido pelo Cortex no celular por ${quem}._`,
  };
}

module.exports = { PROJETOS, acharProjeto, montarPedido, REGRAS };
