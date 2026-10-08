// Conexões do Cortex: confere ao vivo o que está de pé. Só leitura, sem login e sem gastar cota do Firestore.
import { healthUrl, firebaseConfigUrl } from "@/config/env";

export interface Conexao {
  id: string;
  nome: string;
  descricao: string;
  estado: "ativa" | "fora" | "verificando";
  detalhe?: string;
}

async function pegar(url: string): Promise<Response | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return r;
  } catch {
    return null;
  }
}

export async function verificarConexoes(): Promise<Conexao[]> {
  const [saude, cfg] = await Promise.all([pegar(healthUrl()), pegar(firebaseConfigUrl())]);
  let projeto = "";
  if (cfg && cfg.ok) {
    try {
      projeto = String(((await cfg.json()) as { projectId?: string }).projectId || "");
    } catch {
      projeto = "";
    }
  }
  return [
    {
      id: "servidor",
      nome: "Servidor (Cloudflare)",
      descricao: "Onde o Cortex roda, grátis.",
      estado: saude && saude.ok ? "ativa" : "fora",
      detalhe: saude ? `resposta ${saude.status}` : "sem resposta",
    },
    {
      id: "firebase",
      nome: "Banco e login (Firebase)",
      descricao: "Guarda contas e dados, no plano grátis.",
      estado: projeto ? "ativa" : "fora",
      detalhe: projeto || (cfg ? `resposta ${cfg.status}` : "sem resposta"),
    },
  ];
}
