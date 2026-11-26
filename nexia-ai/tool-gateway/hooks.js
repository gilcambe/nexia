const { bloquearPerigoso, checarSintaxe } = require('./hooks-rules');

function criarHooks(config = {}) {
  const antes = config.antes || [bloquearPerigoso];
  const depois = config.depois || [checarSintaxe];

  return {
    async rodarAntes({ tool, input }) {
      for (const hook of antes) {
        const resultado = await hook({ tool, input });
        if (resultado && resultado.bloquear) return resultado;
      }
      return { ok: true };
    },
    async rodarDepois({ tool, input }, resultado) {
      const avisos = [];
      for (const hook of depois) {
        const res = await hook({ tool, input }, resultado);
        if (res && res.aviso) avisos.push(res.aviso);
      }
      return avisos;
    }
  };
}

module.exports = { criarHooks, bloquearPerigoso, checarSintaxe };
