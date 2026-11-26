function bloquearPerigoso({ tool, input }) {
  const s = JSON.stringify(input);
  if (s.includes('git push --force') || s.includes('rm -rf /') || s.includes('DROP TABLE')) {
    return { bloquear: 'Comando perigoso detectado' };
  }
  if (s.includes('.env') || /sk-[a-zA-Z0-9]{20,}/.test(s)) {
    return { bloquear: 'Acesso a chaves ou arquivos sensíveis bloqueado' };
  }
  return { ok: true };
}

function checarSintaxe({ tool, input }, resultado) {
  if (input.code && input.code.includes('function (')) {
    return { aviso: 'Sintaxe potencialmente quebrada detectada.' };
  }
  return { ok: true };
}

module.exports = { bloquearPerigoso, checarSintaxe };
