'use strict';

const acorn = require('acorn');

/**
 * Cria o gerenciador de hooks do tool-gateway.
 * Permite registrar funções de hook para execução 'antes' ou 'depois' das ferramentas.
 */
function criarHooks() {
  const antesFns = [];
  const depoisFns = [];

  return {
    antes(fn) {
      if (typeof fn === 'function') antesFns.push(fn);
    },
    depois(fn) {
      if (typeof fn === 'function') depoisFns.push(fn);
    },
    async rodarAntes(contexto) {
      for (const fn of antesFns) {
        const res = await fn(contexto);
        if (res && res.bloquear) {
          return res;
        }
      }
      return null;
    },
    async rodarDepois(contexto, resultado) {
      const avisos = [];
      for (const fn of depoisFns) {
        const res = await fn(contexto, resultado);
        if (res && res.aviso) {
          avisos.push(res.aviso);
        } else if (res && Array.isArray(res.avisos)) {
          avisos.push(...res.avisos);
        }
      }
      return avisos;
    }
  };
}

/**
 * Hook padrão 'antes': bloqueia operações e conteúdos perigosos.
 */
async function bloquearPerigoso({ tool, input }) {
  const texto = JSON.stringify(input || {});

  // git push --force
  if (/git\s+push\s+.*(--force|-f)/i.test(texto)) {
    return { bloquear: 'Operação perigosa detectada: git push --force não é permitido.' };
  }

  // rm -rf /
  if (/rm\s+-[rf]*\s+\/(\s|$)/i.test(texto)) {
    return { bloquear: 'Operação perigosa detectada: rm -rf / não é permitido.' };
  }

  // DROP TABLE
  if (/DROP\s+TABLE/i.test(texto)) {
    return { bloquear: 'Operação perigosa detectada: DROP TABLE não é permitido.' };
  }

  // Arquivos .env
  if (/\.env(\b|$)/i.test(texto) || (input && input.path && /\.env/i.test(input.path))) {
    return { bloquear: 'Acesso a arquivos .env é proibido.' };
  }

  // Chaves sk-... com 20+ caracteres
  if (/sk-[a-zA-Z0-9_-]{20,}/.test(texto)) {
    return { bloquear: 'Chave secreta (sk-...) detectada e bloqueada.' };
  }

  return null;
}

/**
 * Hook padrão 'depois': checa sintaxe JS em arquivos modificados ou criados.
 */
async function checarSintaxe({ tool, input }, resultado) {
  const path = input && (input.path || input.file || input.filename);
  const content = input && (input.content || input.code || input.text);

  if (path && typeof path === 'string' && path.endsWith('.js') && content && typeof content === 'string') {
    try {
      acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e) {
      return { aviso: `Erro de sintaxe em ${path}: ${e.message}` };
    }
  }
  return null;
}

module.exports = {
  criarHooks,
  bloquearPerigoso,
  checarSintaxe
};
