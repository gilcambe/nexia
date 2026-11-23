'use strict';

const vm = require('vm');

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
    async rodarAntes(chamada) {
      for (const fn of antesFns) {
        const res = await fn(chamada);
        if (res && res.bloquear) {
          return { bloquear: res.bloquear };
        }
      }
      return null;
    },
    async rodarDepois(chamada, resultado) {
      const avisos = [];
      for (const fn of depoisFns) {
        try {
          const res = await fn(chamada, resultado);
          if (res && res.aviso) {
            avisos.push(res.aviso);
          }
        } catch (e) {
          // Ignora erros nos ganchos de pós-execução para não quebrar o fluxo principal
        }
      }
      return avisos;
    }
  };
}

const bloquearPerigoso = (chamada) => {
  if (!chamada || !chamada.input) return null;
  const input = chamada.input;

  // Verifica arquivos ou conteúdos enviados no input (ex: commit_files, edit_files, etc.)
  const files = input.files || (input.path && input.content ? [input] : []);
  
  for (const f of files) {
    const caminho = String(f.path || f.file || f.filename || '');
    const conteudo = String(f.content || f.text || f.body || '');

    if (caminho === '.env' || /(^|\/)(\.env|config\.json|secrets\.json)$/i.test(caminho)) {
      return { bloquear: 'Arquivo com cara de segredo bloqueado (.env)' };
    }

    if (/-----BEGIN\s+[A-Z\s]+-----/.test(conteudo) || /sk-[a-zA-Z0-9]{20,}/.test(conteudo)) {
      return { bloquear: 'Conteúdo com chave ou segredo detectado' };
    }
  }

  // Verifica campos genéricos de texto, mensagem ou comando
  const textoGeral = JSON.stringify(input);
  if (
    textoGeral.includes('rm -rf /') ||
    textoGeral.includes('git push --force') ||
    /DROP\s+TABLE/i.test(textoGeral)
  ) {
    return { bloquear: 'Comando ou instrução perigosa bloqueada' };
  }

  return null;
};

const checarSintaxe = (chamada, resultado) => {
  if (!chamada || !chamada.tool || !chamada.input) return null;
  if (chamada.tool !== 'github.commit_files' && chamada.tool !== 'github.edit_files') return null;
  
  const input = chamada.input;
  const files = input.files || (input.path && input.content ? [input] : []);

  for (const f of files) {
    const caminho = String(f.path || f.file || f.filename || '');
    const conteudo = String(f.content || f.text || '');

    if (caminho.endsWith('.js')) {
      try {
        // Envolve em função para aceitar return e require sem erro de sintaxe global do Node
        new vm.Script(`(function(module, exports, require, __dirname, __filename) { ${conteudo}\n});`);
      } catch (e) {
        return { aviso: `sintaxe: ${caminho}: ${e.message}` };
      }
    }
  }

  return null;
};

module.exports = { criarHooks, bloquearPerigoso, checarSintaxe };
