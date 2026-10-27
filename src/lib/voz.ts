import { apiPath } from "@/config/env";

/**
 * Lê uma resposta em voz alta em português.
 * Tenta primeiro a voz do Workers AI (TTS em /api/cortex-tts);
 * se falhar ou estiver sem internet/token, faz fallback para a voz do celular (speechSynthesis).
 */
export async function falarTexto(
  texto: string,
  tokenGetter?: () => Promise<string | null>
): Promise<void> {
  const limpo = texto.replace(/[*_#`~[\]()]/g, " ").trim();
  if (!limpo) return;

  try {
    const token = tokenGetter ? await tokenGetter().catch(() => null) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(apiPath("/cortex-tts"), {
      method: "POST",
      headers,
      body: JSON.stringify({ texto: limpo }),
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        return;
      }
    }
  } catch {
    /* Fallback para speechSynthesis nativo */
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(limpo);
      u.lang = "pt-BR";
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
}
