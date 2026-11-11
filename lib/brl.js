// lib/brl.js
// Funções de formatação e leitura de valores monetários em reais (BRL)

function brl(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError('Valor deve ser um número finite');
  }

  const sinal = valor < 0 ? '-' : '';
  const absValor = Math.abs(valor);
  const arredondado = Math.round(absValor * 100) / 100;
  const [inteiro, decimal] = arredondado.toFixed(2).split('.');

  // Formatação brasileira de milhar usando ponto como separador
  const inteiroFormatado = Number(inteiro).toLocaleString('pt-BR');

  return `${sinal}R$ ${inteiroFormatado},${decimal}`;
}

function centavos(texto) {
  if (typeof texto !== 'string') return null;

  const limpo = texto.trim();
  if (limpo === '') return null;

  // Remove o símbolo de moeda e espaços
  const semSimbolo = limpo.replace(/^R\$\s*/i, '');

  // Remove pontos de separação de milhar e troca vírgula decimal por ponto
  const normalizado = semSimbolo.replace(/\./g, '').replace(',', '.');

  // Verifica se o restante contém apenas números e, opcionalmente, um ponto decimal
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalizado)) return null;

  const numero = parseFloat(normalizado);
  if (!Number.isFinite(numero)) return null;

  // Converte para centavos, arredondando para o inteiro mais próximo
  return Math.round(numero * 100);
}

module.exports = { brl, centavos };
