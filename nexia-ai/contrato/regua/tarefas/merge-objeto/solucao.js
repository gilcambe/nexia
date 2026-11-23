function mergeObjeto(obj1, obj2) {
  const resultado = Object.assign({}, obj1);
  for (const chave in obj2) {
    if (obj2[chave] !== null && typeof obj2[chave] === 'object' && !Array.isArray(obj2[chave])) {
      resultado[chave] = mergeObjeto(obj1[chave] || {}, obj2[chave]);
    } else {
      Object.assign(resultado, { [chave]: obj2[chave] });
    }
  }
  return resultado;
}

module.exports = { mergeObjeto };
