'use strict';
// VIABILIDADE (Fase 8, regra do dono 13/11/2026): "jamais aceitar projeto que o Cortex não dê conta, para não queimar o
// nome da empresa". Antes de toda proposta: compara o pedido com a Biblioteca (catálogo + Store) e com os prontos da
// web (prontos.json) e dá um NÍVEL:
//   pronto       → já temos (modelo clonável e módulos prontos): pode vender, prazo curto.
//   web          → falta pouco e há código pronto da web (licença ok) para cobrir: pode vender, prazo médio.
//   arriscado    → falta muito ou depende de servidor (custo): vender só escopo menor; o Comercial NÃO promete.
//   nao-fazemos  → fora do que o Cortex faz bem (pagamento próprio, ERP, app nativo, nota fiscal…): recusa educada.
// Também diz o que FALTA → o Buscador (buscador.js) recebe pelo mural. Puro: sem rede, sem IA.
const { carregar, sem } = require('../fabrica/catalogo');
const buscar = require('../fabrica/buscar');
const { prontosCitados } = require('../fabrica/contexto');

// Coisas que não aceitamos (ainda): o Cortex erra muito ou envolve risco legal/financeiro.
const FORA = [
  ['app nativo', 'aplicativo de loja (Play Store/App Store) feito do zero'], ['nota fiscal', 'emissão de nota fiscal'],
  ['erp', 'sistema de gestão completo (ERP)'], ['marketplace', 'marketplace com vários vendedores'],
  ['banco', 'sistema bancário'], ['criptomoeda', 'criptomoedas'], ['aposta', 'apostas'], ['jogo 3d', 'jogo 3D'],
  ['rede social', 'rede social própria'], ['multi empresa', 'sistema para várias empresas (SaaS) do zero'],
  ['inteligencia artificial propria', 'IA própria treinada'], ['telemedicina', 'telemedicina (exige regras do CFM)'],
];
const MAX_FALTAS_WEB = 2;

function analisar({ ramo = '', precisa = [], descricao = '' } = {}, { cat = carregar(), webDe = prontosCitados } = {}) {
  const texto = sem(`${ramo} ${(precisa || []).join(' ')} ${descricao}`);
  const motivos = [];
  const proibidos = FORA.filter(([k]) => texto.includes(sem(k)));
  if (proibidos.length) {
    return { nivel: 'nao-fazemos', podeVender: false, motivos: proibidos.map(([, nome]) => `Não fazemos ${nome}.`),
      resposta: `Obrigado pelo contato! Hoje não trabalhamos com ${proibidos.map(([, n]) => n).join(', ')}. Podemos fazer um site profissional com agendamento, pedidos e WhatsApp, se ajudar.`, faltam: [] };
  }
  const r = buscar.consultar({ nome: 'analise', ramo: ramo || 'outro', whatsapp: '5500000000000', precisa }, cat);
  if (r.erros && r.erros.length) return { nivel: 'arriscado', podeVender: false, motivos: r.erros, faltam: [], resposta: '' };
  const faltam = [...(r.faltam || []).map((f) => f.pedido), ...(r.parecidos || []).map((p) => p.pedido)];
  const nivel3 = r.nivel >= 3;
  // cada falta coberta por uma PEÇA pronta da web (roda no site, sem servidor)?
  const cobertura = faltam.map((f) => ({ falta: f, web: (webDe(`quero ${f} no site`) || []).filter((x) => x.tipo === 'peca').slice(0, 2) }));
  const descobertas = cobertura.filter((c) => !c.web.length).map((c) => c.falta);
  const modelo = r.modelo ? { id: r.modelo.id, nome: r.modelo.nome, clonavel: r.modelo.clonavel } : null;
  let nivel;
  if (nivel3) { nivel = 'arriscado'; motivos.push('Tem parte difícil (pagamento, financeiro ou parecido): só com escopo menor.'); }
  else if (modelo && modelo.clonavel && !faltam.length) { nivel = 'pronto'; motivos.push(`Modelo pronto: ${modelo.nome}.`); }
  else if (faltam.length <= MAX_FALTAS_WEB && !descobertas.length) { nivel = 'web'; motivos.push(`Falta ${faltam.join(', ') || 'pouco'}; há código pronto da web para cobrir.`); }
  else { nivel = 'arriscado'; if (descobertas.length) motivos.push(`Sem pronto confiável para: ${descobertas.join(', ')}.`); if (!modelo) motivos.push('Nenhum modelo parecido na Biblioteca.'); if (faltam.length > MAX_FALTAS_WEB) motivos.push(`Faltam ${faltam.length} partes.`); }
  return {
    nivel, podeVender: nivel === 'pronto' || nivel === 'web', motivos, modelo, prontos: (r.prontos || []).map((m) => m.nome), faltam,
    cobertura: cobertura.map((c) => ({ falta: c.falta, web: c.web.map((x) => x.repo) })), descobertas,
    minutos: nivel === 'pronto' ? r.minutos : null,
    resposta: nivel === 'arriscado' ? 'Para entregar com qualidade, propomos começar com uma versão menor (site + agendamento/pedidos pelo WhatsApp) e evoluir depois.' : '',
  };
}

module.exports = { analisar, FORA, MAX_FALTAS_WEB };
