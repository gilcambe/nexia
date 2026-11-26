'use strict';

const bloquearPerigoso = async ({ tool, input }) => {
  const inputStr = JSON.stringify(input);
  const perigos = [
    'git push --force',
    'rm -rf /',
    'DROP TABLE',
    '.env'
  ];
  for (const p of perigos) if (inputStr.includes(p)) return { bloquear: `Ação perigosa detectada: ${p}` };
  const skMatch = inputStr.match(/sk-[a-zA-Z0-9]{20,}/);
  if (skMatch) return { bloquear: 'Chave secreta (sk-...) detectada.' };
  return { bloquear: null };
};

const checarSintaxe = async ({ tool, input }, resultado) => {
  if (typeof resultado === 'string' && resultado.includes('function (')) {
    return { avisos: ['Sintaxe possivelmente incompleta: "function (" detectado.'] };
  }
  return { avisos: [] };
};

function criarHooks(custom = {}) {
  const antes = custom.antes || [bloquearPerigoso];
  const depois = custom.depois || [checarSintaxe];
  return {
    rodarAntes: async (ctx) => {
      for (const fn of antes) {
        const res = await fn(ctx);
        if (res && res.bloquear) return res;
      }
      return { bloquear: null };
    },
    rodarDepois: async (ctx, resultado) => {
      let avisos = [];
      for (const fn of depois) {
        const res = await fn(ctx, resultado);
        if (res && res.avisos) avisos = avisos.concat(res.avisos);
      }
      return { avisos };
    }
  };
}

module.exports = { criarHooks, bloquearPerigoso, checarSintaxe };
