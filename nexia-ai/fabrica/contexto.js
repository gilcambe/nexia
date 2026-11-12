'use strict';
// M6 (12/11/2026): o Cortex consulta a Biblioteca ANTES de planejar. Se o pedido é criar site/sistema/app,
// o Architect recebe o modelo pronto e os módulos que já existem (com onde estão) e a regra:
// clonar o que existe, criar só o que falta e registrar o módulo novo na Biblioteca.
const { carregar, sem } = require('./catalogo');
const { nichosDoRamo } = require('./buscar');

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
  const pontua = mo => (mo.nichos.some(n => nichos.includes(n)) ? 10 : 0) + mo.modulos.filter(x => ids.has(x)).length * 2 + (mo.clonavel ? 1 : 0);
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
  linhas.push('Planeje SÓ o que falta. Se criar um módulo reutilizável novo, inclua no plano uma entrada nova em nexia-ai/fabrica/catalogo.json (id, nome, faz, apelidos, nichos, nivel, pronto, origem, onde), sem dado pessoal.');
  return linhas.join('\n');
}

module.exports = { contextoBiblioteca, modulosCitados, PEDIDO_NOVO };
