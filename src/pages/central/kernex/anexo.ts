// #3365 (pedido do dono): "Pedir ao Cortex" aceita print e arquivo. O arquivo vai para o ramo cortex-anexos
// (acao "anexar") e a IA grátis descreve o conteúdo (acao "entender"); o pedido leva o caminho e a descrição.

export const MAX_BYTES = 700_000; // o servidor recusa base64 acima de ~950 mil letras

/** Texto que entra no pedido para o Cortex achar e entender o anexo. */
export function blocoDoAnexo(nome: string, caminho: string | null, entendido: string | null): string {
  const linhas = [`📎 Anexo: ${nome}${caminho ? ` (guardado em ${caminho}, ramo cortex-anexos)` : ""}`];
  if (entendido && entendido.trim()) linhas.push(`O que tem no anexo (lido pela IA): ${entendido.trim().slice(0, 1500)}`);
  return linhas.join("\n");
}

/** Arquivo → base64 sem o prefixo data:. */
export function paraBase64(f: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || "").replace(/^data:[^,]*,/, ""));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(f);
  });
}

/** Foto grande do celular → JPEG de até 1600 px (cabe no limite e continua legível). */
export async function reduzirFoto(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.size <= MAX_BYTES) return f;
  const img = await createImageBitmap(f);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b || f), "image/jpeg", 0.82));
}
