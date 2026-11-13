'use strict';
// M6 (12/11/2026): o Cortex consulta a Biblioteca ANTES de planejar. Se o pedido é criar site/sistema/app,
// o Architect recebe o modelo pronto e os módulos que já existem (com onde estão) e a regra:
// clonar o que existe, criar só o que falta e registrar o módulo novo na Biblioteca.
const { carregar, sem } = require('./catalogo');
const { nichosDoRamo } = require('./buscar');

// 13/11: sistemas e peças prontos da web (MIT/Apache conferidos) — nexia-ai/fabrica/prontos.json
let _prontos = null;
const prontosJson = () => (_prontos = _prontos || require('./prontos.json'));

/** Prontos da web que servem ao pedido (por palavra da categoria). Peças (rodam no site) antes de sistemas (precisam de servidor). */
function prontosCitados(texto, p = prontosJson()) {
  const t = ` ${sem(texto)} `;
  const cats = Object.entries(p.palavras || {}).filter(([, ps]) => ps.some((w) => t.includes(` ${sem(w)}`))).map(([c]) => c);
  return (p.prontos || []).filter((x) => cats.includes(x.categoria))
    .sort((a, b) => (a.tipo === 'peca' ? 0 : 1) - (b.tipo === 'peca' ? 0 : 1) || b.estrelas - a.estrelas).slice(0, 6);
}

const PEDIDO_NOVO = /\b(quero|queria|preciso|precisa|cri[ae]r?|crie|fa[cz]a|fazer|monte|montar|novo|nova|gerar|gere|clon[ae]r?)\b[\s\S]{0,80}\b(site|sistema|landing|app|aplicativo|pagina|plataforma|loja|agenda|painel)\b/;

/** Módulos citados no texto (id, nome ou apelido com 4+ letras). */
function modulosCitados(texto, cat) {
  const t = ` ${sem(texto)} `;
  const tem = (s) => { const x = sem(s); return x.length >= 4 && t.includes(x); };
  return (cat.modulos || []).filter(m => [m.id, m.nome, ...(m.apelidos || [])].some(tem));
}

/** Texto para o prompt do Architect; '' quando o pedido não é de sistema novo. */
function contextoBiblioteca(goal, cat = carregar()) {
  const g = sem(goal || '');
  if (!PEDIDO_NOVO.test(g)) return '';
  const nichos = nichosDoRamo(g, cat).filter(n => (cat.modelos || []).some(m => m.nichos.includes(n)) || Object.keys(cat.ramos || {}).includes(n));
  const citados = modulosCitados(g, cat);
  const ids = new Set(citados.map(m => m.id));
  const pontua = mo => mo.nichos.filter(n => nichos.includes(n)).length * 10 + mo.modulos.filter(x => ids.has(x)).length * 2 + (mo.clonavel ? 1 : 0);
  const modelo = (cat.modelos || []).map(mo => ({ mo, p: pontua(mo) })).filter(x => x.p >= 3).sort((a, b) => b.p - a.p).map(x => x.mo)[0] || null;
  const doModelo = modelo ? (cat.modulos || []).filter(m => modelo.modulos.includes(m.id)) : [];
  const prontos = [...new Map([...doModelo, ...citados].map(m => [m.id, m])).values()];
  const linhas = ['BIBLIOTECA KERNEX (nexia-ai/fabrica/catalogo.json): consulte antes de criar. Não recrie o que já existe.'];
  if (modelo) {
    linhas.push(modelo.clonavel
      ? `Modelo pronto e CLONÁVEL: ${modelo.id} (${modelo.nome}). Site inteiro desse ramo = clonar pela Fábrica (kernex-clientes/scripts/novo-projeto.js --modelo ${modelo.id}), sem escrever código; só personalize nome, fotos e dados.`
      : `Projeto parecido já existe: ${modelo.id} (${modelo.nome}). Reaproveite as partes dele.`);
  }
  if (prontos.length) linhas.push('Módulos que já existem (copie/adapte daqui):', ...prontos.slice(0, 12).map(m => `- ${m.id}: ${m.faz || m.nome}${m.onde ? ` (onde: ${m.onde})` : ''}`));
  const web = prontosCitados(g);
  if (web.length) linhas.push('Código PRONTO da web com licença conferida (copie/adapte em vez de escrever do zero; mantenha o LICENSE e o crédito):',
    ...web.map((x) => `- ${x.repo} (${x.licenca}, ${x.estrelas}⭐): ${x.uso}. ${x.tipo === 'peca' ? 'Peça: roda dentro do site (arquivo local, sem CDN).' : 'Sistema: precisa de servidor próprio (custo) → só com OK do dono.'} ${x.url}`));
  linhas.push('Planeje SÓ o que falta. Se criar um módulo reutilizável novo, inclua no plano uma entrada nova em nexia-ai/fabrica/catalogo.json (id, nome, faz, apelidos, nichos, nivel, pronto, origem, onde), sem dado pessoal.');
  return linhas.join('\n');
}

module.exports = { contextoBiblioteca, modulosCitados, prontosCitados, PEDIDO_NOVO };
