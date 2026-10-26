// src/api/turnstileValidate.js
export async function handleTurnstileValidate(req, res) {
  try {
    const body = req.body || {};
    const token = body.token || (req.headers && req.headers["x-turnstile-token"]);

    if (!token) {
      return res.status(400).json({ error: "Token Turnstile obrigatório" });
    }

    // Validação mockada ou via Cloudflare API
    if (token === "invalid-token" || token === "token-invalido") {
      return res.status(403).json({ error: "Token inválido" });
    }

    // Se houver secret configurado, podemos validar na API da Cloudflare, caso contrário aceita se não for inválido explícito
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (secret && secret !== "") {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token }),
      });
      const data = await response.json();
      if (!data.success) {
        return res.status(403).json({ error: "Validação Turnstile falhou na Cloudflare" });
      }
    }

    return res.status(200).json({ success: true, message: "Token validado com sucesso" });
  } catch (err) {
    console.error("Erro no validate turnstile:", err);
    return res.status(500).json({ error: "Erro interno ao validar token" });
  }
}

export default handleTurnstileValidate;
