'use strict';
// KERNEX Empresa Autônoma (Fase 8, 13/11/2026). As ÁREAS da empresa e os "funcionários" (agentes de IA) de cada uma.
// Regra do dono: mínimo 3 por área, cada um numa IA/cota diferente (se um cai ou erra, os outros seguem; um revisa o
// outro). "precisaOk" = o que NUNCA sai sem o toque do dono (dinheiro, contrato final, envio, produção).
// Puro (sem rede): a Central e o Diretor leem daqui.

// Cadeias de IA (do roteador): cada agente começa por uma diferente para espalhar a cota.
const IA = { openrouter: 'openrouter', groq: 'groq', gemini: 'agy', cloudflare: 'cloudflare', zai: 'zai', local: 'maquinas' };

const AREAS = [
  { id: 'diretoria', nome: 'Diretoria', icone: 'casa', faz: 'Organiza o trabalho de todas as áreas, cobra prazos e te manda o resumo às 8h e às 18h.',
    precisaOk: ['preço e estratégia'],
    agentes: [['Diretor', IA.gemini], ['Vice-diretor', IA.openrouter], ['Auditor', IA.groq]] },
  { id: 'prospeccao', nome: 'Prospecção', icone: 'busca', faz: 'Procura negócios sem site (ramo e cidade) e prepara a primeira mensagem.',
    precisaOk: ['enviar a 1ª mensagem (você aprova o lote)'],
    agentes: [['Caçador', IA.openrouter], ['Qualificador', IA.groq], ['Redator de abordagem', IA.zai]] },
  { id: 'marketing', nome: 'Marketing', icone: 'grafico', faz: 'Posta nas redes da KERNEX, cuida do Google (SEO) e mede o alcance.',
    precisaOk: ['campanha nova', 'tema sensível'],
    agentes: [['Criador de posts', IA.gemini], ['SEO', IA.openrouter], ['Analista de alcance', IA.cloudflare]] },
  { id: 'comercial', nome: 'Comercial', icone: 'troca', faz: 'Responde quem pediu orçamento, faz a proposta e acompanha até fechar.',
    precisaOk: ['desconto ou preço fora da tabela'],
    agentes: [['Vendedor', IA.gemini], ['Orçamentista', IA.groq], ['Follow-up', IA.openrouter]] },
  { id: 'viabilidade', nome: 'Viabilidade', icone: 'check', faz: 'Antes de toda proposta: o Cortex dá conta? Se não der, recusa com educação (regra do dono).',
    precisaOk: [],
    agentes: [['Analista técnico', IA.gemini], ['Conferente da Biblioteca', IA.groq], ['Revisor de risco', IA.openrouter]] },
  { id: 'buscador', nome: 'Buscador de módulos', icone: 'busca', faz: 'Quando o Cortex não tem um módulo, procura código pronto na internet (licença conferida) e traz.',
    precisaOk: ['sistema que precisa de servidor (custo)'],
    agentes: [['Pesquisador', IA.openrouter], ['Conferente de licença', IA.groq], ['Catalogador', IA.zai]] },
  { id: 'juridico', nome: 'Jurídico e contratos', icone: 'cadeado', faz: 'Preenche o contrato do modelo revisado, termos e privacidade (LGPD) dos sites.',
    precisaOk: ['contrato final (sempre)'],
    agentes: [['Redator de contrato', IA.gemini], ['Revisor LGPD', IA.openrouter], ['Conferente', IA.groq]] },
  { id: 'producao', nome: 'Produção (Cortex)', icone: 'foguete', faz: 'Cria e altera sites e sistemas, com prévia e testes.',
    precisaOk: ['publicar no ar'],
    agentes: [['Arquiteto', IA.gemini], ['Programador', IA.groq], ['Revisor', IA.openrouter]] },
  { id: 'suporte', nome: 'Suporte', icone: 'sino', faz: 'Atende os clientes e abre ajuste quando precisa.',
    precisaOk: ['reclamação séria', 'reembolso'],
    agentes: [['Atendente', IA.openrouter], ['Técnico', IA.groq], ['Ouvidor', IA.zai]] },
  { id: 'financeiro', nome: 'Financeiro', icone: 'grafico', faz: 'Gera Pix, lembra vencimentos, vê quem atrasou e confere que o gasto é R$ 0.',
    precisaOk: ['mexer em dinheiro (sempre)', 'estorno', 'desconto'],
    agentes: [['Cobrador', IA.groq], ['Tesoureiro', IA.openrouter], ['Auditor de gastos', IA.cloudflare]] },
  { id: 'ti', nome: 'T.I. e operações', icone: 'servidor', faz: 'Vigia sites, cotas das IAs, backups e segurança; avisa "como resolver".',
    precisaOk: ['criar chave ou conta'],
    agentes: [['Vigia', IA.cloudflare], ['Bombeiro', IA.groq], ['Guardião de cotas', IA.openrouter]] },
  { id: 'rh', nome: 'RH e qualidade', icone: 'lista', faz: 'Avalia cada agente (acertos, erros, custo) e troca a IA que vai mal.',
    precisaOk: [],
    agentes: [['Avaliador', IA.openrouter], ['Treinador', IA.gemini], ['Ouvidor interno', IA.groq]] },
  { id: 'consultor', nome: 'Consultor do dono', icone: 'ia', faz: 'Te explica tudo em linguagem simples e dá dicas.',
    precisaOk: [],
    agentes: [['Consultor', IA.gemini], ['Explicador', IA.openrouter], ['Professor', IA.groq]] },
].map((a) => ({ ...a, agentes: a.agentes.map(([nome, ia], i) => ({ id: `${a.id}-${i + 1}`, nome, ia, area: a.id })) }));

const MINIMO_POR_AREA = 3;
const area = (id) => AREAS.find((a) => a.id === id) || null;

module.exports = { AREAS, MINIMO_POR_AREA, area, IA };
