module.exports = {
  windowMs: 10 * 1000, // 10 segundos
  max: 10, // 10 requisições / mensagens por janela
  blockDurationMs: 60 * 1000, // bloqueio de 1 minuto após excesso
  message: { erro: 'Muitas requisições. Tente novamente em 1 minuto.' }
};
