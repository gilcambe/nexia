'use strict';
// Ferramentas da Central (Fase 6, 13/11/2026) — CONTRATO para a tela:
//   POST acao=ferramentas-consultor { pergunta, tela?, contexto? }
//        → { resposta, modelo } : o "Consultor ?" explica em português simples, com passos numerados.
//        Só IAs GRÁTIS (FREE.fast do roteador): Claude fica de fora (regra do dono: Claude é a única paga, usada o mínimo).
//        Sem nenhuma IA grátis disponível: 503 { error } com o que fazer.
const { FREE } = require('../../../nexia-ai/orchestrator/models');

const SISTEMA = [
  'Você é o Consultor da Central KERNEX. O dono é leigo: responda em português do Brasil, simples, sem termos técnicos.',
  'Máximo 8 linhas. Quando for "como fazer", use passos numerados curtos (1., 2., 3.) com o nome exato do botão ou tela.',
  'Telas da Central: Início, Pedir, Projetos, Clientes e modelos, Fábrica, Kernex Store, Vendas, Empresa, Máquinas, IA & Cortex, Tarefas, Arquivos, Publicações, Homologação, Cofre, Relatórios, Configurações.',
  'Regras da KERNEX: tudo grátis; dinheiro, contrato, envio em massa e publicar em produção só com OK do dono; nunca aceitar projeto que o Cortex não dá conta (use "Dá para fazer?" na tela Empresa).',
  'Nunca peça nem mostre senhas, chaves ou tokens. Se não souber, diga que não sabe e sugira abrir um pedido na tela Pedir.',
].join('\n');

const limpar = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function consultor({ pergunta, tela, contexto }, { router, modelos = FREE.fast } = {}) {
  const p = limpar(pergunta, 600);
  if (p.length < 3) return { status: 400, corpo: { error: 'Escreva a sua dúvida.' } };
  if (!router) router = require('../../../nexia-ai/model-router').getRouter();
  const lista = modelos.filter((d) => { try { const c = router.capabilities(d); return c && c.available !== false; } catch { return false; } });
  const msg = `${tela ? `Estou na tela "${limpar(tela, 40)}".${contexto ? ' ' + limpar(contexto, 300) : ''}\n` : ''}Minha dúvida: ${p}`;
  for (const d of lista.slice(0, 4)) {
    try {
      const r = await router.chat(d, { system: SISTEMA, messages: [{ role: 'user', content: msg }], maxTokens: 500, temperature: 0.3 });
      const texto = limpar(r && r.text, 2000) ? String(r.text).trim().slice(0, 2000) : '';
      if (texto) return { status: 200, corpo: { resposta: texto, modelo: `${d.provider}/${d.model}` } };
    } catch { /* tenta a próxima IA grátis */ }
  }
  return { status: 503, corpo: { error: 'Nenhuma IA grátis respondeu agora. Tente de novo em 1 minuto; se continuar, veja a tela "IA & Cortex".' } };
}

async function rota({ acao, body = {} }, deps = {}) {
  if (acao === 'ferramentas-consultor') return consultor(body, deps);
  return null;
}

module.exports = { rota, consultor, SISTEMA };
