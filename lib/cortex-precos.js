// lib/cortex-precos.js
// Preços em US$ por 1 milhão de tokens (entrada e saída) para cada modelo.
// O modelo grátis tem preço 0.

const DOLAR_PADRAO = 5.4;

const CORTEX_DOLAR = Number(process.env.CORTEX_DOLAR || DOLAR_PADRAO);

// preços em US$ por 1M de tokens
const PRECOS_US_POR_1M_TOKENS = {
  free: { entrada: 0, saida: 0 },
  pequeno: { entrada: 0.5, saida: 1.5 },
  medio: { entrada: 1.0, saida: 3.0 },
  grande: { entrada: 3.0, saida: 9.0 },
};

// Converte US$ por 1M tokens para reais por token
function usPor1MTokensParaReaisPorToken(valorUsPor1M) {
  return (valorUsPor1M * CORTEX_DOLAR) / 1_000_000;
}

// Retorna o preço em reais por token para o modelo e tipo informados.
// tipo: 'entrada' ou 'saida'. Modelo desconhecido retorna 0.
function getPreco(modelo, tipo) {
  const modeloNormalizado = String(modelo || '').toLowerCase().trim();
  const tipoNormalizado = String(tipo || '').toLowerCase().trim();

  const preco = PRECOS_US_POR_1M_TOKENS[modeloNormalizado];
  if (!preco) return 0;

  const valorUs = tipoNormalizado === 'saida' ? preco.saida : preco.entrada;
  return usPor1MTokensParaReaisPorToken(valorUs);
}

module.exports = {
  CORTEX_DOLAR,
  DOLAR_PADRAO,
  PRECOS_US_POR_1M_TOKENS,
  getPreco,
};
