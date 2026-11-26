const crypto = require('crypto');

function bloquearPerigoso({ tool, input }) {
  const inputStr = JSON.stringify(input);
  const perigos = [
    'git push --force',
    'rm -rf /',
    'DROP TABLE',
    '.env'
  ];
  for (const p of perigos) if (inputStr.includes(p)) return { bloquear: `Ação perigosa detectada: ${p}` };
  
  // Chaves sk-... de 20+ chars
  if (inputStr.match(/sk-[a-zA-Z0-9]{20,}/)) return { bloquear: 'Chave secreta detectada' };
  
  return null;
}

function checarSintaxe({ tool, input }, resultado) {
  if (input && input.path && input.path.endsWith('.js')) {
    if (input.content && input.content.includes('function (')) {
      return { avisos: ['Sintaxe de arquivo JS suspeita: "function ("'] };
    }
  }
  return null;
}

function criarHooks(custom = {}) {
  const hooks = {
    antes: custom.antes || [bloquearPerigoso],
    depois: custom.depois || [checarSintaxe]
  };

  return {
    async rodarAntes(data) {
      for (const hook of hooks.antes) {
        const res = await hook(data);
        if (res && res.bloquear) return res;
      }
      return null;
    },
    async rodarDepois(data, resultado) {
      const avisos = [];
      for (const hook of hooks.depois) {
        const res = await hook(data, resultado);
        if (res && res.avisos) avisos.push(...res.avisos);
      }
      return avisos.length ? { avisos } : null;
    }
  };
}

module.exports = { criarHooks, bloquearPerigoso, checarSintaxe };
