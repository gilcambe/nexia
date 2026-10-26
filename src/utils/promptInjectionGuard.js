const ENV_PATTERNS = [
  /[A-Za-z_][A-Za-z0-9_]*=.*(sk_|pk_|ghp_|github_|AIza|firebase|AWS|secret|token|key|password|env)/i,
  /(process\.env|REACT_APP|VITE_|FIREBASE_|NEXIA_)/i,
  /(chave|senha|token|secret|api[_-]?key|access[_-]?token|private[_-]?key)/i
];

const PROMPT_LEAK_PATTERNS = [
  /(ignore|esqueça|desconsidere|sobreescreva|ignore as instruções|ignore previous|disregard|forget|overwrite|sistema|system|prompt interno|instruções internas|regras internas|instruções do sistema|system prompt|developer message|developer|construído|construído por|feito por|criado por|arquitetura|stack|tecnologia|framework|biblioteca|dependência|versão|versão do|versão de)/i,
  /(revele|mostre|exiba|diga|fale|conte|exiba as|quais são|liste|liste as|mostre as|revele as|qual é|qual a|qual o|qual as|qual as|qual é a|qual é o|qual é as|qual é os|qual são as|qual são os|qual são as chaves|quais são as variáveis|quais são os segredos|quais são as senhas|quais são os tokens|quais são as chaves de API|quais são as variáveis de ambiente|quais são os prompts internos|quais são as instruções internas|quais são as regras internas|qual é o prompt do sistema|qual é o system prompt|qual é a mensagem do desenvolvedor|qual é a developer message)/i,
  /(imprima|exiba|mostre|retorne|devolva|envie|transmita|copie|cole|insira|adicione|remova|delete|apague|exclua|desative|ative|habilite|desabilite|bloqueie|liber |abra|feche|inicie|pare|pare de|continue|espere|aguarde|comece|termine|finalize|encerre|reinicie|reinicie|reset|redefina|atualize|salve|carregue|baixe|faça o download|faça o upload|envie para|receba de|baixe de|carregue de|salve em|leia de|escreva em|acesso|acessar|entrar|sair|logout|log out|sign in|sign out|cadastre|registre|login|log in|autentique|autorize|permit|proíba|bloqueie|liberate|restrinja|limite|defina|configure|ajuste|modifique|altere|mude|troque|substitua|inclua|exclua|adicione|remova|insira|delete|apague|exclua|desative|ative|habilite|desabilite|bloqueie|libere|abra|feche|inicie|pare|continue|espere|aguarde|comece|termine|finalize|encerre|reinicie|reinicie|reset|redefina|atualize|salve|carregue|baixe|faça o download|faça o upload|envie para|receba de|baixe de|carregue de|salve em|leia de|escreva em|acesso|acessar|entrar|sair|logout|log out|sign in|sign out|cadastre|registre|login|log in|autentique|autorize|permit|proíba|bloqueie|liberate|restrinja|limite|defina|configure|ajuste|modifique|altere|mude|troque|substitua|inclua|exclua)/i
];

const GENERIC_RESPONSE = "Desculpe, não posso ajudar com isso.";

/**
 * Remove ou mascara padrões de vazamento (chaves, variáveis de ambiente,
 * prompts internos) de um texto antes de enviá-lo ao modelo.
 * @param {string} text - Texto do prompt.
 * @returns {string} - Texto limpo ou resposta genérica se houver vazamento.
 */
export function promptInjectionGuard(text) {
  if (!text || typeof text !== 'string') {
    return GENERIC_RESPONSE;
  }

  let cleaned = text;

  // Remove/masca padrões de vazamento de segredos e variáveis de ambiente
  for (const pattern of ENV_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTADO]');
  }

  // Detecta tentativas de extração de prompts internos / instruções do sistema
  for (const pattern of PROMPT_LEAK_PATTERNS) {
    if (pattern.test(cleaned)) {
      return GENERIC_RESPONSE;
    }
  }

  return cleaned;
}

export default { promptInjectionGuard, GENERIC_RESPONSE };
