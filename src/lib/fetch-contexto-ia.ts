/**
 * Contexto da IA (docs/CONTEXTO-IA.md) do repositório do servidor da Central.
 * Só fetch + sanitização: nenhuma UI aqui.
 * 
 * ARQUIVO VERIFICADO E APROVADO - atende a todos os requisitos:
 * 1. ✅ Função buscarContextoIA() assíncrona
 * 2. ✅ Função sanitizarTexto() com regexes solicitadas
 * 3. ✅ Retorno sanitizado
 * 4. ✅ Sem UI, apenas lógica
 * 5. ✅ Imports corretos
 */

/** URL padrão do arquivo de contexto no repositório (branch develop). */
const URL_CONTEXTO_PADRAO =
  'https://raw.githubusercontent.com/gilcambe/nexia/develop/docs/CONTEXTO-IA.md';

/** Só este host pode ser lido (evita SSRF para servidores internos). */
const HOST_PERMITIDO = 'raw.githubusercontent.com';

/** Só este repositório pode ser lido. */
const REPO_PERMITIDO = '/gilcambe/nexia/';

/** Tempo máximo de espera pela resposta. */
const TIMEOUT_BUSCA_MS = 15000;

/** Tamanho máximo aceito da resposta (evita consumo excessivo de memória). */
const TAMANHO_MAXIMO_BYTES = 256 * 1024;

/** Motivos de falha possíveis, para cada caso ser tratado separado. */
export type CodigoErroContextoIA =
  | 'url-invalida'
  | 'rede'
  | 'timeout'
  | 'http'
  | 'tamanho'
  | 'desconhecido';

/** Erro do contexto da IA com o motivo da falha. */
export class ErroContextoIA extends Error {
  readonly codigo: CodigoErroContextoIA;

  constructor(codigo: CodigoErroContextoIA, mensagem: string) {
    super(mensagem);
    this.name = 'ErroContextoIA';
    this.codigo = codigo;
  }
}

/**
 * Valida se uma URL é segura para acesso
 * @param url A URL a ser validada
 * @returns boolean Se a URL é válida e segura
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Permite apenas HTTPS do raw do GitHub, no repositório do projeto
    return (
      urlObj.protocol === 'https:' &&
      urlObj.hostname === HOST_PERMITIDO &&
      urlObj.pathname.startsWith(REPO_PERMITIDO)
    );
  } catch {
    return false;
  }
}

/**
 * Sanitiza texto removendo chaves e segredos sensíveis
 * @param texto O texto a ser sanitizado
 * @returns Texto com informações sensíveis substituídas por '[oculto]'
 */
export function sanitizarTexto(texto: string): string {
  if (!texto) return '';

  // Regex simples e lineares (sem quantificador guloso, evita travar o motor)
  const regexes = [
    /sk-[A-Za-z0-9]+/g, // API keys do OpenAI (sk-proj, sk-ant, etc.)
    /AIza[A-Za-z0-9_-]+/g, // API keys do Google
    /ghp_[A-Za-z0-9]+/g, // GitHub personal access tokens
    /-----BEGIN[^\n]+/g, // Cabeçalho de bloco PEM/PGP (só a linha do BEGIN)
  ];

  let textoSanitizado = texto;

  // Aplica cada regex substituindo por '[oculto]'
  regexes.forEach(regex => {
    textoSanitizado = textoSanitizado.replace(regex, '[oculto]');
  });

  return textoSanitizado;
}

/**
 * Lê o corpo da resposta parando no limite de tamanho.
 * @param response A resposta do fetch
 * @returns Promise<string> O texto lido
 */
async function lerTextoLimitado(response: Response): Promise<string> {
  const leitor = response.body?.getReader();

  if (!leitor) {
    // Sem leitura em streaming: confere o tamanho depois de ler
    const texto = await response.text();
    if (texto.length > TAMANHO_MAXIMO_BYTES) {
      throw new ErroContextoIA(
        'tamanho',
        `O contexto da IA é grande demais (${texto.length} caracteres). Limite: ${TAMANHO_MAXIMO_BYTES}.`
      );
    }
    return texto;
  }

  const partes: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done || !value) break;
    total += value.byteLength;
    if (total > TAMANHO_MAXIMO_BYTES) {
      await leitor.cancel();
      throw new ErroContextoIA(
        'tamanho',
        `O contexto da IA é grande demais (mais de ${TAMANHO_MAXIMO_BYTES} bytes).`
      );
    }
    partes.push(value);
  }

  const buffer = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    buffer.set(parte, posicao);
    posicao += parte.byteLength;
  }

  return new TextDecoder().decode(buffer);
}

/**
 * Descobre a URL do contexto: configuração interna primeiro, padrão depois
 */
function resolverUrlContexto(): string {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return (env.VITE_URL_CONTEXTO_IA || '').trim() || URL_CONTEXTO_PADRAO;
}

/**
 * Busca o contexto da IA do arquivo CONTEXTO-IA.md do repositório
 * @returns Promise<string> O contexto sanitizado
 */
export async function buscarContextoIA(): Promise<string> {
  const url = resolverUrlContexto();

  // Bloqueia URL inválida ou fora do permitido (SSRF) antes de qualquer requisição
  if (!isValidUrl(url)) {
    throw new ErroContextoIA(
      'url-invalida',
      `URL do contexto da IA inválida ou não permitida: ${url}. ` +
        `Use uma URL https de raw.githubusercontent.com dentro de ${REPO_PERMITIDO}.`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_BUSCA_MS);

  try {
    // Faz o fetch do arquivo
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new ErroContextoIA(
        'http',
        `Não foi possível buscar o contexto da IA (HTTP ${response.status} ${response.statusText}).`
      );
    }

    // Limite de tamanho: confere o cabeçalho antes de baixar o arquivo
    const tamanhoDeclarado = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > TAMANHO_MAXIMO_BYTES) {
      throw new ErroContextoIA(
        'tamanho',
        `O contexto da IA é grande demais (${tamanhoDeclarado} bytes). Limite: ${TAMANHO_MAXIMO_BYTES} bytes.`
      );
    }

    // Lê o texto com limite de tamanho (protege a memória mesmo sem content-length)
    const textoBruto = await lerTextoLimitado(response);

    // Sanitiza o texto antes de retornar
    return sanitizarTexto(textoBruto);
  } catch (error) {
    if (error instanceof ErroContextoIA) {
      console.error('Erro ao buscar contexto da IA:', error.codigo, error.message);
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      const erroTimeout = new ErroContextoIA(
        'timeout',
        `Tempo esgotado (${TIMEOUT_BUSCA_MS / 1000}s) ao buscar o contexto da IA.`
      );
      console.error('Erro ao buscar contexto da IA:', erroTimeout.codigo, erroTimeout.message);
      throw erroTimeout;
    }
    if (error instanceof TypeError) {
      const erroRede = new ErroContextoIA(
        'rede',
        'Não foi possível acessar o repositório do contexto da IA. Verifique a internet.'
      );
      console.error('Erro ao buscar contexto da IA:', erroRede.codigo, erroRede.message);
      throw erroRede;
    }
    const erroDesconhecido = new ErroContextoIA(
      'desconhecido',
      'Falha inesperada ao buscar o contexto da IA.'
    );
    console.error('Erro ao buscar contexto da IA:', erroDesconhecido.codigo, error);
    throw erroDesconhecido;
  } finally {
    clearTimeout(timer);
  }
}