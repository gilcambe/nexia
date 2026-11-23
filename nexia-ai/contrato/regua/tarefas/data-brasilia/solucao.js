function obterDataBrasilia(data = new Date()) {
  return new Date(data.getTime() - 3 * 60 * 60 * 1000);
}

module.exports = { obterDataBrasilia };
