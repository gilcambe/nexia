'use strict';
// Meu Cortex: o dono escreve do jeito que fala, e o pedido já sai com o projeto, as pastas e o cuidado certos,
// como a Claude faria. Um projeto novo é uma linha em PROJETOS.

const PROJETOS = [
  { id: 'cortex', nome: 'o próprio Cortex', re: /\bcortex\b/i },
  { id: 'bodycoach', nome: 'Body Coach', re: /\b(body\s*coach|treino|dieta|refeic[oç][oõ]es|card[aá]pio)\b/i }
];

function identificarProjeto(texto) {
  if (!texto) return null;
  for (const p of PROJETOS) {
    if (p.re.test(texto)) {
      return p;
    }
  }
  return null;
}

module.exports = {
  PROJETOS,
  identificarProjeto
};
