// Leitor de SSE (text/event-stream) para as respostas do Worker que chegam aos pedaços.
// Um pedaço de rede pode cortar uma linha no meio: o leitor guarda o resto e só entrega linhas inteiras.
// Aceita "data: x" e "data:x", fim de linha \n ou \r\n, ignora comentários (": ...") e outros campos.
// O valor "[DONE]" vira { fim: true }; JSON válido vira { json }; o resto vira { texto } (texto puro).

export type EventoSSE = { fim: true } | { json: unknown } | { texto: string };

export interface LeitorSSE {
  empurrar(pedaco: string): EventoSSE[];
  terminar(): EventoSSE[];
}

function linhaParaEvento(linha: string): EventoSSE | null {
  const l = linha.endsWith("\r") ? linha.slice(0, -1) : linha;
  if (!l.startsWith("data:")) return null;
  const dado = l.slice(5).replace(/^ /, "");
  if (!dado.trim()) return null;
  if (dado.trim() === "[DONE]") return { fim: true };
  try { return { json: JSON.parse(dado) }; } catch { return { texto: dado }; }
}

export function criarLeitorSSE(): LeitorSSE {
  let resto = "";
  const ler = (linhas: string[]) => linhas.map(linhaParaEvento).filter((e): e is EventoSSE => e !== null);
  return {
    empurrar(pedaco: string) {
      resto += pedaco;
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      return ler(linhas);
    },
    terminar() {
      const ultima = resto;
      resto = "";
      return ultima ? ler([ultima]) : [];
    },
  };
}
