export function nota(falaCliente, respostaAtendente, palavrasChave) {
  const normalizar = (valor) =>
    String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const palavrasResposta = normalizar(respostaAtendente)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const palavrasChaveNormalizadas = (palavrasChave || [])
    .map(normalizar)
    .filter(Boolean);

  const acertou = palavrasChaveNormalizadas.some((palavra) =>
    palavrasResposta.includes(palavra)
  );

  const fraseModelo = acertou
    ? "Obrigado, vamos resolver isso para você."
    : "Me explica melhor o que aconteceu, por favor.";

  const traducaoPt = respostaAtendente;

  return { acertou, fraseModelo, traducaoPt };
}
