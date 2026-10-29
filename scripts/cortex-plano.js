'use strict';
// Planejador do Cortex (pedido do dono, 25/10/2026): "se eu mandar um prompt grande, ele já identifica e quebra em
// tarefas pequenas para nunca travar, com qualidade e rapidez, e executa mais de uma por vez".
// Tudo aqui é função pura (sem rede): a fila (scripts/cortex-fila.js) usa para
//   1) classificar o pedido (pequeno, médio, grande) pelo texto, pelos arquivos citados e pelo tamanho deles;
//   2) montar um PLANO: partes pequenas, cada uma com os arquivos que pode mexer, de quais partes depende e quando está pronta;
//   3) decidir quais partes já podem rodar JUNTAS (sem dependência pendente e sem mexer no mesmo arquivo de outra);
//   4) mandar ao Jules as partes grandes demais para a IA grátis;
//   5) conferir o PR de cada parte (só os arquivos do plano, poucas linhas) e medir o tempo de cada uma.
// O plano vai no corpo de cada parte, num comentário HTML que a IA executora ignora: <!-- cortex-plano {...} -->.

const ARQ_GRANDE = 40 * 1024;      // mesmo corte do get_file em partes (#1479): acima disso a IA grátis só lê pedaços
const MAX_PARTES = 8;
const MAX_ARQ_PARTE = 3;
const MAX_LINHAS_PARTE = 400;      // linhas acrescentadas + apagadas que uma parte pode mudar sem ir para revisão
// Pedido do dono (25/10/2026): nada pode ficar horas esperando. O Cortex roda a cada 15 min e o auto-merge a cada 30 min,
// então 1 h e 20 min já são folga de sobra — nunca mais 3 h nem 6 h.
const ESPERA_PR_MAX_H = 1;         // dependente espera o PR da parte anterior entrar no máximo isto (a fila nunca para)
const JULES_DESISTE_MIN = 20;      // parte marcada para o Jules que ele não aceitou (lote ocupado) volta ao Cortex rápido
const EXT = '(?:js|mjs|cjs|ts|tsx|jsx|css|html|json|md|yml|yaml|svg|webmanifest)';

const arquivosCitados = corpo => [...new Set((String(corpo || '').match(new RegExp(`[\\w./-]+\\.${EXT}\\b`, 'g')) || [])
  .map(c => c.replace(/^\.?\//, '')).filter(c => c.includes('/') && !c.includes('..') && !/^https?:/.test(c)))];

// Palavras de pedido grande: tela/sistema/módulo novo, "todas as telas", vários passos numerados.
const SINAIS_GRANDE = /\b(sistema|m[oó]dulo|tela|p[aá]gina|painel|fluxo|integra[cç][aã]o|refator\w*|migra\w*)\s+(nov[oa]|inteir[oa]|complet[oa])|\btodas?\s+as\s+(telas|p[aá]ginas|abas)|\bdo zero\b/i;

// Classifica o pedido. tamanhos = { 'caminho': bytes } dos arquivos citados que existem na develop (opcional).
function classificar({ corpo = '', tamanhos = {} } = {}) {
  const texto = String(corpo);
  const arquivos = arquivosCitados(texto);
  const grandes = arquivos.filter(a => (tamanhos[a] || 0) > ARQ_GRANDE);
  const passos = (texto.match(/^\s*(?:\d+[.)]|[-*•])\s+\S/gm) || []).length;
  const motivos = [];
  if (texto.length > 2500) motivos.push(`texto longo (${texto.length} letras)`);
  if (arquivos.length > 4) motivos.push(`${arquivos.length} arquivos citados`);
  if (passos >= 6) motivos.push(`${passos} passos`);
  if (SINAIS_GRANDE.test(texto)) motivos.push('pede algo novo e inteiro');
  if (grandes.length) motivos.push(`arquivo grande: ${grandes.join(', ')}`);
  // Grande = precisa de plano. Médio = um sinal só, sem arquivo grande (ainda vai inteiro). Pequeno = nenhum sinal.
  const pontos = motivos.length + (texto.length > 6000 ? 1 : 0) + (arquivos.length > 8 ? 1 : 0);
  const tamanho = pontos >= 2 || (pontos === 1 && !grandes.length && (texto.length > 2500 || arquivos.length > 4)) ? 'grande' : pontos === 1 ? 'medio' : 'pequeno';
  return { tamanho, motivos, arquivos, grandes };
}

const SISTEMA_PLANO = [
  'Você é o planejador do Cortex. Recebe um pedido de programação grande e devolve um PLANO de partes pequenas.',
  `Regras: de 2 a ${MAX_PARTES} partes; cada parte mexe em no máximo ${MAX_ARQ_PARTE} arquivos e cabe em uma rodada (menos de ${MAX_LINHAS_PARTE} linhas mudadas);`,
  'cada parte é completa por si só (a IA que executa NÃO vê as outras): copie do pedido tudo o que ela precisa (nomes, textos, caminhos exatos);',
  'duas partes que mexem no mesmo arquivo NÃO podem ser independentes: a segunda depende da primeira;',
  'partes que não dependem uma da outra rodam ao mesmo tempo, então só ponha dependência quando uma usa o que a outra cria;',
  'marque "grande": true só se a parte precisar ler ou mudar um arquivo enorme ou criar uma tela inteira (vai para outra IA mais forte).',
  'Responda SOMENTE com um array JSON, sem markdown, no formato:',
  '[{"titulo":"curto","tarefa":"o que fazer, completo","arquivos":["caminho/exato.js"],"depende":[],"pronto":"como saber que terminou (teste ou resultado visível)","grande":false}]',
  '"depende" lista os números (começando em 1) das partes ANTERIORES de que esta precisa.',
].join(' ');

// Confere e normaliza o plano da IA. Devolve null se algo estiver fora das regras (a fila tenta outro modelo ou o plano simples).
function validarPlano(arr) {
  if (!Array.isArray(arr) || arr.length < 2 || arr.length > MAX_PARTES) return null;
  const partes = [];
  for (let k = 0; k < arr.length; k++) {
    const p = arr[k] || {};
    const tarefa = String(p.tarefa || '').trim();
    const arquivos = [...new Set((Array.isArray(p.arquivos) ? p.arquivos : []).map(a => String(a).trim().replace(/^\.?\//, '')))].filter(Boolean);
    const depende = [...new Set((Array.isArray(p.depende) ? p.depende : []).map(Number))];
    if (tarefa.length < 30 || tarefa.length > 3000) return null;
    if (!arquivos.length || arquivos.length > MAX_ARQ_PARTE || arquivos.some(a => a.includes('..') || a.startsWith('/'))) return null;
    if (depende.some(d => !Number.isInteger(d) || d < 1 || d > k)) return null;   // só partes anteriores: nunca há ciclo
    const pronto = String(p.pronto || '').trim();
    if (pronto.length < 10) return null;
    partes.push({ titulo: String(p.titulo || `Parte ${k + 1}`).trim().slice(0, 60), tarefa, arquivos, depende, pronto: pronto.slice(0, 300), grande: p.grande === true });
  }
  // Mesmo arquivo em duas partes sem ligação entre elas = conflito de merge garantido. Liga a de baixo à de cima.
  for (let k = 0; k < partes.length; k++) for (let j = 0; j < k; j++) {
    if (partes[k].arquivos.some(a => partes[j].arquivos.includes(a)) && !partes[k].depende.includes(j + 1)) partes[k].depende.push(j + 1);
  }
  partes.forEach(p => p.depende.sort((a, b) => a - b));
  return partes;
}

// Plano sem IA (todas as IAs grátis falharam): uma parte por arquivo citado, todas ao mesmo tempo. Nunca devolve vazio
// quando há 2+ arquivos; com menos, devolve null e a tarefa segue inteira (comportamento antigo).
function planoSimples(corpo, arquivos = arquivosCitados(corpo)) {
  if (arquivos.length < 2) return null;
  // Um arquivo por parte; com mais de MAX_PARTES arquivos, reparte em grupos do mesmo tamanho.
  const porGrupo = Math.ceil(arquivos.length / MAX_PARTES);
  const grupos = [];
  for (let k = 0; k < arquivos.length; k += porGrupo) grupos.push(arquivos.slice(k, k + porGrupo));
  const base = String(corpo).trim().slice(0, 2400);
  return grupos.map(g => ({
    titulo: `Arquivos ${g.map(a => a.split('/').pop()).join(', ')}`.slice(0, 60),
    tarefa: `${base}\n\nNESTA PARTE faça só o que o pedido acima pede para ${g.map(a => '`' + a + '`').join(', ')}. Outras partes cuidam dos outros arquivos ao mesmo tempo.`,
    arquivos: g, depende: [], pronto: `${g.join(', ')} com a mudança pedida e os testes do projeto passando`, grande: false,
  }));
}

// Partes antigas (texto puro, do divisor de antes): viram plano em sequência, como sempre rodaram.
const planoDeTextos = textos => textos.map((t, k) => ({ titulo: `Parte ${k + 1}`, tarefa: t, arquivos: arquivosCitados(t).slice(0, MAX_ARQ_PARTE), depende: k ? [k] : [], pronto: 'o que esta parte pede, com os testes passando', grande: false }));

// Parte grande para a IA grátis vai direto ao Jules: a IA marcou, ou ela mexe em arquivo enorme.
const vaiParaJules = (parte, tamanhos = {}) => parte.grande === true || parte.arquivos.some(a => (tamanhos[a] || 0) > ARQ_GRANDE * 2);

const MARCA = 'cortex-plano';
function cabecalho(meta) { return `<!-- ${MARCA} ${JSON.stringify(meta)} -->`; }
function lerPlano(corpo) {
  const m = new RegExp(`<!-- ${MARCA} (\\{[\\s\\S]*?\\}) -->`).exec(String(corpo || ''));
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return o && typeof o.pai === 'number' && Array.isArray(o.depende) ? o : null; } catch { return null; }
}

// Corpo da issue de cada parte: o cabeçalho com o plano + o pedido + limites claros para a IA executora.
// partes = o plano inteiro: os arquivos das partes de que esta depende vão no cabeçalho (antes), para esperar o PR delas
// entrar mesmo depois que a issue da parte anterior já fechou.
function corpoDaParte(parte, k, n, pai, partes = []) {
  const antes = [...new Set(parte.depende.flatMap(d => (partes[d - 1] || {}).arquivos || []))];
  const meta = { pai, k, n, depende: parte.depende, arquivos: parte.arquivos, antes, pronto: parte.pronto, limite: MAX_LINHAS_PARTE };
  return [
    cabecalho(meta),
    parte.tarefa,
    '',
    `Arquivos desta parte (mexa SÓ neles): ${parte.arquivos.map(a => '`' + a + '`').join(', ')}.`,
    `Pronto quando: ${parte.pronto}.`,
    `Limite: até ${MAX_LINHAS_PARTE} linhas mudadas. Arquivo grande: leia por trechos (start_line/end_line ou find) e mude só o trecho.`,
    parte.depende.length ? `Esta parte vem depois de: ${parte.depende.map(d => `parte ${d}`).join(', ')} (já estão na develop quando ela rodar).` : 'Esta parte roda ao mesmo tempo que outras; não mexa em arquivos fora da lista.',
  ].join('\n').slice(0, 3900);   // a API do Cortex recusa pedido acima de 4000 letras
}

// Pode rodar agora? Espera só as partes de que depende (não todas as anteriores, como antes) e o PR delas entrar.
// irmas = issues abertas da fila; prs = [{ arquivos: [...], criadoEm }] PRs nexia/* abertos.
function dependenciasProntas(i, irmas, prs = [], agora = Date.now(), nomes = x => (x.labels || []).map(l => l.name || l)) {
  const meta = lerPlano(i.body);
  if (!meta) return null;   // sem plano: a fila usa a regra antiga (parte k espera as anteriores)
  for (const d of meta.depende) {
    const dep = irmas.find(o => o !== i && (m => m && m.pai === meta.pai && m.k === d)(lerPlano(o.body)));
    // Dependência aberta e não concluída segura. Travada não segura para sempre (regra do dono: a fila nunca para).
    if (dep && !nomes(dep).includes('cortex-feito') && !nomes(dep).includes('cortex-travado')) return false;
  }
  // Fusão em ordem: o PR da parte anterior (arquivos dela) ainda aberto e recente = espera ele entrar.
  // Só os arquivos das partes de que depende: os próprios arquivos não entram, senão o rascunho que a própria parte
  // abriu numa tentativa anterior a seguraria por 6 h (teste real de #1538, PR #1549 segurava #1541).
  const precisa = new Set(meta.antes || []);
  return !prs.some(pr => (agora - Date.parse(pr.criadoEm || 0)) / 36e5 < ESPERA_PR_MAX_H && (pr.arquivos || []).some(a => precisa.has(a)));
}

// Duas partes rodando ao mesmo tempo nunca mexem no mesmo arquivo (evita conflito na hora de juntar os PRs).
function conflitaCom(i, rodando) {
  const meta = lerPlano(i.body);
  if (!meta) return false;
  return rodando.some(o => (m => m && m.arquivos.some(a => meta.arquivos.includes(a)))(lerPlano(o.body)));
}

// Revisão do PR de uma parte: só os arquivos do plano (mais testes) e dentro do limite de linhas.
// files = lista do GitHub /pulls/N/files ({ filename, additions, deletions }).
function revisarDiff(meta, files) {
  const problemas = [];
  if (!meta || !Array.isArray(files)) return problemas;
  const fora = files.map(f => f.filename).filter(f => !meta.arquivos.includes(f) && !/^tests?\//.test(f) && !/\.test\.[jt]sx?$/.test(f));
  if (fora.length) problemas.push(`mexeu fora do plano: ${fora.slice(0, 5).join(', ')}`);
  const linhas = files.reduce((s, f) => s + (f.additions || 0) + (f.deletions || 0), 0);
  if (linhas > (meta.limite || MAX_LINHAS_PARTE) * 1.5) problemas.push(`${linhas} linhas mudadas (limite ${meta.limite || MAX_LINHAS_PARTE})`);
  if (!files.some(f => meta.arquivos.includes(f.filename))) problemas.push('não mexeu em nenhum arquivo do plano');
  return problemas;
}

// Placar de tempo do pedido grande: quanto cada parte levou e quantas rodaram ao mesmo tempo.
function medirTempo(paiCriado, partes) {
  const fim = partes.map(p => Date.parse(p.closed_at || 0)).filter(Number.isFinite);
  if (!fim.length) return null;
  const ini = Date.parse(paiCriado);
  const dur = partes.map(p => ({ numero: p.number, min: Math.round((Date.parse(p.closed_at || 0) - Date.parse(p.created_at || paiCriado)) / 60000) }));
  const totalMin = Math.round((Math.max(...fim) - ini) / 60000);
  const somaMin = dur.reduce((s, d) => s + Math.max(0, d.min), 0);
  // Maior número de partes abertas ao mesmo tempo (paralelismo real).
  const marcos = partes.flatMap(p => [[Date.parse(p.created_at || paiCriado), 1], [Date.parse(p.closed_at || 0), -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let atual = 0, pico = 0; for (const [, d] of marcos) { atual += d; pico = Math.max(pico, atual); }
  return { totalMin, somaMin, pico, dur };
}
const textoTempo = t => !t ? '' : `Tempo total: ${t.totalMin} min (somando as partes uma depois da outra seriam ${t.somaMin} min). Até ${t.pico} partes ao mesmo tempo. ${t.dur.map(d => `#${d.numero}: ${d.min} min`).join(' · ')}`;

// Função para gerar o plano com a lista real de arquivos do repositório
function gerarPlano(pedido, callback) {
  const { exec } = require('child_process');
  exec('git ls-files', (error, stdout, stderr) => {
    if (error) {
      callback(error, null);
      return;
    }
    const arquivosReais = stdout.split('\n').filter(Boolean);
    const pedidoEnriquecido = { ...pedido, arquivosReais };
    callback(null, pedidoEnriquecido);
  });
}

module.exports = {
  ARQ_GRANDE, MAX_PARTES, MAX_ARQ_PARTE, MAX_LINHAS_PARTE, ESPERA_PR_MAX_H, JULES_DESISTE_MIN, SISTEMA_PLANO,
  arquivosCitados, classificar, validarPlano, planoSimples, planoDeTextos, vaiParaJules, cabecalho, lerPlano, corpoDaParte,
  dependenciasProntas, conflitaCom, revisarDiff, medirTempo, textoTempo, gerarPlano,
};
