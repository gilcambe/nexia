function nota(falaCliente, respostaAtendente, palavrasChave) {
  // Convert both strings to lowercase for case-insensitive comparison
  const falaClienteLower = falaCliente.toLowerCase();
  const respostaAtendenteLower = respostaAtendente.toLowerCase();

  // Check if all keywords are present in the client's speech
  const acertou = palavrasChave.every(keyword =>
    falaClienteLower.includes(keyword.toLowerCase())
  );

  // Return the result object
  return {
    acertou,
    fraseModelo: respostaAtendente,
    traducaoPt: respostaAtendente // Assuming the response is already in Portuguese
  };
}

module.exports = nota;
