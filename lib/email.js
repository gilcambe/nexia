/**
 * Valida e normaliza um endereço de e‑mail.
 *
 * @param {string} rawEmail - E‑mail informado pelo cliente.
 * @returns {string|null} E‑mail limpo (trim + lowercase) se for válido; caso contrário, null.
 */
function validateEmail(rawEmail) {
  if (typeof rawEmail !== 'string') return null;

  // Remove espaços das pontas e converte para minúsculas
  const email = rawEmail.trim().toLowerCase();

  // Estrutura básica: local@domínio.com (domínio deve conter ao menos um ponto)
  // Não usamos regex complexa; verificamos as partes necessárias.
  const atIndex = email.indexOf('@');
  // Deve existir exatamente um '@' e não pode ser o primeiro ou último caractere
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || atIndex === email.length - 1) {
    return null;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  // Local deve ter ao menos um caractere
  if (localPart.length === 0) return null;

  // Domínio deve conter pelo menos um ponto e não pode começar ou terminar com ponto
  const dotIndex = domainPart.indexOf('.');
  if (dotIndex <= 0 || dotIndex === domainPart.length - 1) {
    return null;
  }

  // Verifica se há segmentos vazios entre pontos (ex.: "example..com")
  const domainSegments = domainPart.split('.');
  if (domainSegments.some(seg => seg.length === 0)) {
    return null;
  }

  // Se passou por todas as verificações, o e‑mail é considerado válido
  return email;
}

module.exports = validateEmail;
