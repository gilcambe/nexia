/**
 * lib/planilha-processar.js
 * Módulo para ler, consultar e gerar planilhas no navegador usando SheetJS (xlsx).
 * Suporta arquivos .xlsx e .csv, converte para JSON, executa cálculos simples
 * e gera nova planilha baixável (Blob / base64).
 *
 * Requer a biblioteca SheetJS (xlsx) disponível no escopo do navegador.
 * Exemplo de uso via CDN:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.20.0/xlsx.full.min.js"></script>
 *   <script type="module" src="./lib/planilha-processar.js"></script>
 *
 * Ou instale via npm: npm install xlsx
 */

// SheetJS deve estar exposto como Xlsx no window quando usado via CDN.
// Quando instalado via npm, importe: import * as XLSX from 'xlsx';
const Xlsx = typeof window !== 'undefined' && window.XLSX ? window.XLSX : null;

/**
 * Lê um arquivo .xlsx ou .csv selecionado no navegador e converte para JSON.
 * @param {File} file - Arquivo selecionado por <input type="file">
 * @returns {Promise<Array<Object>>} Lista de linhas como objetos.
 */
export async function loadPlanilha(file) {
  if (!file) {
    throw new Error('Nenhum arquivo informado.');
  }

  const nome = file.name || '';
  const ehCsv = nome.toLowerCase().endsWith('.csv');
  const ehXlsx = nome.toLowerCase().endsWith('.xlsx') || nome.toLowerCase().endsWith('.xls');

  if (!ehCsv && !ehXlsx) {
    throw new Error('Formato não suportado. Use .xlsx ou .csv.');
  }

  const ab = await file.arrayBuffer();
  const dados = new Uint8Array(ab);

  let workbook;
  if (ehCsv) {
    workbook = Xlsx.read(dados, { type: 'array', raw: true });
  } else {
    workbook = Xlsx.read(dados, { type: 'array' });
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('A planilha não contém nenhuma aba.');
  }

  const primeiraAba = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[primeiraAba];
  const json = Xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return normalizarJson(json);
}

/**
 * Converte o array bruto (header + linhas) em objetos com chaves da primeira linha.
 * @param {Array} json - Saída de sheet_to_json com header:1
 * @returns {Array<Object>}
 */
function normalizarJson(json) {
  if (!Array.isArray(json) || json.length === 0) {
    return [];
  }

  const cabecalho = json[0];
  const linhas = json.slice(1);

  return linhas.map((linha) => {
    const obj = {};
    cabecalho.forEach((chave, idx) => {
      const nome = chave != null && chave !== '' ? String(chave) : `coluna_${idx + 1}`;
      obj[nome] = linha[idx];
    });
    return obj;
  });
}

/**
 * Converte um valor para número, tratando strings com ponto/vírgula.
 * Retorna NaN quando não for possível.
 * @param {any} valor
 * @returns {number}
 */
function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return NaN;
  }
  if (typeof valor === 'number') {
    return valor;
  }
  const texto = String(valor).trim();
  // Remove espaços de milhar e símbolos comuns
  const limpo = texto.replace(/[\s.\$\u20AC\u00A2]/g, '').replace(',', '.');
  const num = Number(limpo);
  return Number.isNaN(num) ? NaN : num;
}

/**
 * Executa cálculos simples sobre os dados da planilha.
 * Queries suportadas (exemplos):
 *   { operacao: 'soma', coluna: 'preco' }
 *   { operacao: 'media', coluna: 'preco' }
 *   { operacao: 'contagem', coluna: 'status' }
 *   { operacao: 'contagem', coluna: 'status', filtro: { status: 'ativo' } }
 *   { operacao: 'soma', coluna: 'preco', filtro: { status: 'ativo' } }
 *   { operacao: 'maximo', coluna: 'preco' }
 *   { operacao: 'minimo', coluna: 'preco' }
 *
 * @param {Array<Object>} data - Resultado de loadPlanilha
 * @param {Object} query - { operacao, coluna?, filtro? }
 * @returns {number} Resultado numérico da operação.
 */
export function queryPlanilha(data, query) {
  if (!Array.isArray(data)) {
    throw new Error('data deve ser um array de objetos.');
  }
  if (!query || typeof query !== 'object') {
    throw new Error('query deve ser um objeto com operacao e coluna.');
  }

  const { operacao, coluna, filtro } = query;

  if (!operacao || typeof operacao !== 'string') {
    throw new Error('query.operacao é obrigatório (soma, media, contagem, maximo, minimo).');
  }

  let linhas = data;

  // Aplica filtro quando informado
  if (filtro && typeof filtro === 'object') {
    const chavesFiltro = Object.keys(filtro);
    linhas = linhas.filter((linha) => {
      return chavesFiltro.every((chave) => {
        const valorLinha = linha[chave];
        const valorEsperado = filtro[chave];
        return valorLinha == null ? false : String(valorLinha).toLowerCase() === String(valorEsperado).toLowerCase();
      });
    });
  }

  const op = operacao.toLowerCase();

  if (op === 'contagem') {
    if (coluna) {
      return linhas.filter((linha) => linha[coluna] != null && linha[coluna] !== '').length;
    }
    return linhas.length;
  }

  // Operações que precisam de coluna numérica
  if (!coluna) {
    throw new Error(`query.coluna é obrigatório para a operação '${operacao}'.`);
  }

  const valores = linhas
    .map((linha) => paraNumero(linha[coluna]))
    .filter((num) => !Number.isNaN(num));

  if (valores.length === 0) {
    return 0;
  }

  switch (op) {
    case 'soma':
      return valores.reduce((acc, v) => acc + v, 0);
    case 'media':
      return valores.reduce((acc, v) => acc + v, 0) / valores.length;
    case 'maximo':
      return Math.max(...valores);
    case 'minimo':
      return Math.min(...valores);
    default:
      throw new Error(`Operação não suportada: '${operacao}'. Use: soma, media, contagem, maximo ou minimo.`);
  }
}

/**
 * Gera uma nova planilha a partir de linhas e colunas e retorna como Blob.
 * @param {Array<Object>} rows - Dados das linhas
 * @param {Array<string>} cols - Ordem das colunas na planilha
 * @returns {Blob} Planilha .xlsx como Blob
 */
export function generateWorkbook(rows, cols) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('rows deve ser um array não vazio.');
  }

  const colunas = Array.isArray(cols) && cols.length > 0 ? cols : Object.keys(rows[0]);

  const dados = [colunas, ...rows.map((linha) => colunas.map((c) => linha[c]))];

  const worksheet = Xlsx.utils.aoa_to_sheet(dados);
  const workbook = Xlsx.utils.book_new();
  Xlsx.utils.book_append_sheet(workbook, worksheet, 'Resultado');

  const xlsxBuffer = Xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Baixa o Blob como arquivo .xlsx no navegador.
 * @param {Blob} blob
 * @param {string} nomeArquivo
 */
export function baixarPlanilha(blob, nomeArquivo = 'resultado.xlsx') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converte um Blob para base64 (string).
 * @param {Blob} blob
 * @returns {Promise<string>} base64 sem o cabeçalho data:
 */
export async function blobParaBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binario = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return btoa(binario);
}

/**
 * Gera planilha e retorna como base64.
 * @param {Array<Object>} rows
 * @param {Array<string>} cols
 * @returns {Promise<string>} base64 do arquivo .xlsx
 */
export async function generateWorkbookBase64(rows, cols) {
  const blob = generateWorkbook(rows, cols);
  return blobParaBase64(blob);
}

/**
 * Gera planilha a partir dos resultados de queryPlanilha.
 * Útil para exportar múltiplos cálculos em uma única aba.
 * @param {Array<{nome: string, valor: number}>} resultados
 * @returns {Blob}
 */
export function generateResultadoWorkbook(resultados) {
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new Error('resultados deve ser um array não vazio.');
  }
  return generateWorkbook(resultados, ['nome', 'valor']);
}
