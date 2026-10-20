/**
 * Sanitiza texto removendo chaves e segredos sensíveis
 * @param texto O texto a ser sanitizado
 * @returns Texto com informações sensíveis substituídas por '[oculto]'
 */
export function sanitizarTexto(texto: string): string {
  // Regex para diferentes tipos de chaves e segredos
  const regexes = [
    /sk-[A-Za-z0-9]+/g, // API keys do OpenAI
    /AIza[A-Za-z0-9_-]+/g, // API keys do Google
    /ghp_[A-Za-z0-9]+/g, // GitHub personal access tokens
    /-----BEGIN[^\n]+/g, // Blocos de chaves PEM/PGP
  ];

  let textoSanitizado = texto;
  
  // Aplica cada regex substituindo por '[oculto]'
  regexes.forEach(regex => {
    textoSanitizado = textoSanitizado.replace(regex, '[oculto]');
  });

  return textoSanitizado;
}

/**
 * Valida se uma URL é segura para acesso
 * @param url A URL a ser validada
 * @returns boolean Se a URL é válida e segura
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Permite apenas URLs do GitHub (raw.githubusercontent.com)
    return urlObj.hostname === 'raw.githubusercontent.com' && 
           urlObj.pathname.startsWith('/gilcambe/nexia/');
  } catch {
    return false;
  }
}

/**
 * Busca o contexto da IA do arquivo CONTEXTO-IA.md do repositório
 * @returns Promise<string> O contexto sanitizado
 */
export async function buscarContextoIA(): Promise<string> {
  try {
    // Define a URL do arquivo de contexto
    const url = VITE_URL_CONTEXTO_IA || 
      'https://raw.githubusercontent.com/gilcambe/nexia/develop/docs/CONTEXTO-IA.md';
    
    // Faz o fetch do arquivo
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar o arquivo: ${response.status} ${response.statusText}`);
    }
    
    // Obtém o texto bruto
    const textoBruto = await response.text();
    
    // Sanitiza o texto antes de retornar
    return sanitizarTexto(textoBruto);
  } catch (error) {
    console.error('Erro ao buscar contexto da IA:', error);
    throw error;
  }
}
