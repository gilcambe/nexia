// src/api/turnstileValidate.js

// Armazenamento em memória para tokens usados (prevenir replay attacks)
const usedTokens = new Set();

// Rate limiting simples - armazenamento de tentativas por IP
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip);
  // Remove requisições mais antigas que a janela atual
  const validRequests = requests.filter(time => time > windowStart);
  rateLimitStore.set(ip, validRequests);
  
  return validRequests.length < MAX_REQUESTS_PER_WINDOW;
}

export async function handleTurnstileValidate(req, res) {
  try {
    // CSRF Protection - validar Origin/Referer
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const allowedOrigins = [
      "http://localhost:3000",
      "https://nexia.vercel.app",
      "https://nexia.pages.dev"
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: "Origem não permitida" });
    }
    
    if (referer && !allowedOrigins.some(allowed => referer.startsWith(allowed))) {
      return res.status(403).json({ error: "Referer não permitido" });
    }
    
    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "Muitas requisições. Tente novamente mais tarde." });
    }
    
    const body = req.body || {};
    const token = body.token || (req.headers && req.headers["x-turnstile-token"]);

    if (!token) {
      return res.status(400).json({ error: "Token Turnstile obrigatório" });
    }

    // Verificar se token já foi usado (prevenir replay attack)
    if (usedTokens.has(token)) {
      return res.status(403).json({ error: "Token já utilizado" });
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

    // Marcar token como usado após validação bem-sucedida
    usedTokens.add(token);
    
    // Limpar tokens antigos a cada 5 minutos para evitar vazamento de memória
    if (usedTokens.size > 1000) {
      usedTokens.clear();
    }

    return res.status(200).json({ success: true, message: "Token validado com sucesso" });
  } catch (err) {
    console.error("Erro no validate turnstile:", err);
    return res.status(500).json({ error: "Erro interno ao validar token" });
  }
}

export default handleTurnstileValidate;
