// Modelo de registro de uso do Cortex (chat e IA).
// Envia para /api/uso e grava um log no console para rastreamento.

export async function registrarUso(dados) {
  const registro = {
    cliente: dados.cliente || "desconhecido",
    plano: dados.plano || "gratuito",
    provedor: dados.provedor || "desconhecido",
    modelo: dados.modelo || "desconhecido",
    tokens_in: Number(dados.tokens_in ?? 0),
    tokens_out: Number(dados.tokens_out ?? 0),
    from_cache: Boolean(dados.fromCache),
    custo: Number(dados.custo ?? 0),
    timestamp: new Date().toISOString(),
  };

  // Tenta persistir no servidor. Se falhar, apenas avisa e continua.
  try {
    const res = await fetch("/api/uso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registro),
    });
    if (!res.ok) {
      console.warn("[uso] servidor não respondeu OK:", res.status);
    }
  } catch (err) {
    console.warn("[uso] não foi possível enviar ao servidor:", err.message);
  }

  console.log("[uso] registro de uso:", registro);
  return registro;
}
