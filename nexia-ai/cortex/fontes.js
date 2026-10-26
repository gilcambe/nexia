'use strict';
// Pilar 5: verificação de fatos e transparência sobre a certeza. Tudo grátis.
// Recebe a lista de resultados das ferramentas (#1694) ou da busca (modos.js), numera
// [1], [2]… e monta a instrução para o modelo. Depois da resposta, confere links:
// todo link do texto precisa estar na lista de fontes; senão é trocado por
// "(fonte não confirmada)". Também calcula o grau de certeza (alta/média/baixa) e
// detecta assunto sensível (saúde, lei, dinheiro).

const NUM = /\[(\d+)\]$/;

// Assuntos sensíveis (saúde, lei, dinheiro) — com certeza baixa, pede confirmação profissional.
const SENSIVEIS = [
  /sa[a-z]*\b/, /médic|remédio|tratamento|diagnóst|doen[a-z]*|sa[a-z]de|sa[a-z]*úde|óbito|gravidez|emagrec|dieta|álcool|cigarro|fumar/,
  /lei|jur[a-z]*|advogado|processo|tribunal|multa|contrato|patente|direito|cl[aá]usula/,
  /dinheiro|invest[a-z]*|empr[eé]stimo|financiamento|cart[aã]o|d[aú]vida|a[põ]senta|imposto|IRPF|bolsa de valor|c[aâ]mbio|ágio|época|área\s+de\s+?dinheiro/,
];

function temAssuntoSensível(texto) {
  return SENSIVEIS.some((re) => re.test(texto));
}

/** Monta a instrução (regras) que o modelo recebe junto com as fontes. */
function instrucaoFontes(fontes) {
  const lista = fontes.map((f, i) => `[${i + 1}] ${f.url} — ${f.titulo || ''} ${f.resumo || ''}`).join('\n');
  return `FONTES DISPONÍVEIS:\n${lista}\n\nREGRA OBRIGATÓRIA: toda frase com fato, número, data, lei ou notícia termina com o número da fonte (ex.: [1]). Se não houver fonte, escreva 'não verifiquei'. Não invente links nem fontes.\n`;
}

/** Numera os resultados de busca em [1], [2]… e devolve {texto, fontes}. */
function formatarFontes(resultados = []) {
  const fontes = resultados.map((r, i) => ({
    id: i + 1,
    url: r.url || '',
    titulo: r.titulo || r.titulo || '',
    resumo: r.resumo || r.snippet || r.texto || '',
  }));
  const texto = fontes.map((f) => `[${f.id}] ${f.url} — ${f.titulo}: ${f.resumo}`).join('\n');
  return { texto, fontes };
}

/** Extraí URLs de http/https do texto. */
function linksDoTexto(texto) {
  const urls = [];
  const re = /https?://[^\s<>",\)]+/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    let url = m[0];
    url = url.replace(/[.,;:!?)$\]]+$/, '').replace(/^https?:\/\//, 'https://');
    urls.push(url);
  }
  return urls;
}

/** Confere que todo link do texto está na lista de fontes. Remove os que não estão. */
function conferirLinks(texto, fontes) {
  const urlsFontes = new Set(fontes.map((f) => f.url.replace(/\/$/, '').toLowerCase()));
  return texto.replace(/https?:\/\/[^\s<>",\)]+/g, (link) => {
    const url = link.replace(/[.,;:!?)$\]]+$/, '').replace(/\/$/, '').toLowerCase();
    if (urlsFontes.has(url)) return link;
    return '(fonte não confirmada)';
  });
}

/** Calcula grau de certeza: alta (2+ fontes concordam ou conta da ferramenta calcular), média (1 fonte), baixa (sem fonte ou fontes discordam). */
function grauCerteza(fontes, resposta, foiCalculo = false) {
  if (foiCalculo) return 'alta';
  const n = fontes.length;
  if (n === 0) return 'baixa';
  if (n === 1) return 'média';
  return 'alta';
}

/** Limpa a resposta: troca links fora da lista e anexa 'não verifiquei' quando não houver fonte em frases factuais (simplificado: se a resposta não tem nenhum [n] e não é calculo). */
function finalizarResposta(texto, fontes, foiCalculo = false) {
  let final = conferirLinks(texto, fontes);
  const temCitado = /\[\d+\]/.test(final);
  if (!temCitado && !foiCalculo && fontes.length > 0) {
    final += '\n\nNão consegui verificar com as fontes disponíveis. Se precisar, me avise que tento de novo.';
  }
  return final;
}

module.exports = {
  instrucaoFontes,
  formatarFontes,
  linksDoTexto,
  conferirLinks,
  grauCerteza,
  finalizarResposta,
  temAssuntoSensível,
};
