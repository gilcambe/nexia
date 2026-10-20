/**
 * Contexto da IA (docs/CONTEXTO-IA.md) do repositório do servidor da Central.
 * Só fetch + sanitização: nenhuma UI aqui.
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

  // Regex para diferentes tipos de chaves e segredos
  const regexes = [
    /sk-[A-Za-z0-9]+/g, // API keys do OpenAI
    /AIza[A-Za-z0-9_-]+/g, // API keys do Google
    /ghp_[A-Za-z0-9]+/g, // GitHub personal access tokens
    /-----BEGIN[\s\S]*?-----END[^\n]*/g, // Bloco de chave PEM/PGP completo (várias linhas)
    /-----BEGIN[^\n]*/g, // Cabeçalho de bloco sem fim correspondente
  ];

  let textoSanitizado = texto;

  // Aplica cada regex substituindo por '[oculto]'
  regexes.forEach(regex => {
    textoSanitizado = textoSanitizado.replace(regex, '[oculto]');
  });

  return textoSanitizado;
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
    throw new Error(
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
      throw new Error(`Erro ao buscar o arquivo: ${response.status} ${response.statusText}`);
    }

    // Obtém o texto bruto
    const textoBruto = await response.text();

    // Sanitiza o texto antes de retornar
    return sanitizarTexto(textoBruto);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const erroTimeout = new Error(
        `Tempo esgotado (${TIMEOUT_BUSCA_MS / 1000}s) ao buscar o contexto da IA.`
      );
      console.error('Erro ao buscar contexto da IA:', erroTimeout);
      throw erroTimeout;
    }
    console.error('Erro ao buscar contexto da IA:', error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
