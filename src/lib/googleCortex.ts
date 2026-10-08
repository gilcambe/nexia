// Ponte Google do Cortex: fala com o script que o dono publica na própria conta (google/LEIA-ME.md).
// Endereço e senha ficam só neste navegador (localStorage). Nada passa pelo Firestore.
const CHAVE = "nexia_cortex_google_v1";

export interface ConfigGoogle {
  url: string;
  segredo: string;
}

export interface EventoAgenda {
  titulo: string;
  inicio: string;
  fim: string;
  diaInteiro?: boolean;
  local?: string;
}

export interface ArquivoDrive {
  id: string;
  nome: string;
  tipo: string;
  atualizado: string;
  link: string;
}

export function lerConfigGoogle(): ConfigGoogle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const c = JSON.parse(raw) as ConfigGoogle;
    return c && c.url && c.segredo ? c : null;
  } catch {
    return null;
  }
}

export function salvarConfigGoogle(c: ConfigGoogle | null): void {
  try {
    if (!c) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify({ url: c.url.trim(), segredo: c.segredo.trim() }));
  } catch {
    // navegador bloqueou o armazenamento: segue sem salvar
  }
}

async function chamar<T>(cfg: ConfigGoogle, acao: string, dados: Record<string, unknown> = {}): Promise<T> {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(cfg.url.trim())) {
    throw new Error("O endereço precisa ser o da implantação (https://script.google.com/macros/s/.../exec).");
  }
  // Sem cabeçalho próprio: o navegador manda como pedido simples e o Apps Script responde sem pré-verificação.
  const r = await fetch(cfg.url.trim(), { method: "POST", body: JSON.stringify({ ...dados, acao, segredo: cfg.segredo }) });
  let j: { ok?: boolean; erro?: string } & Record<string, unknown>;
  try {
    j = await r.json();
  } catch {
    throw new Error("A ponte não respondeu como esperado. Confira se a implantação está como 'Qualquer pessoa'.");
  }
  if (!j.ok) throw new Error(String(j.erro || "A ponte recusou o pedido."));
  return j as unknown as T;
}

export async function testarGoogle(cfg: ConfigGoogle): Promise<string> {
  const r = await chamar<{ usuario: string }>(cfg, "ping");
  return r.usuario;
}

export async function listarAgenda(cfg: ConfigGoogle, dias = 7): Promise<EventoAgenda[]> {
  return (await chamar<{ eventos: EventoAgenda[] }>(cfg, "agenda_listar", { dias })).eventos;
}

export async function criarEvento(cfg: ConfigGoogle, e: { titulo: string; inicio: string; fim?: string }): Promise<EventoAgenda> {
  return (await chamar<{ evento: EventoAgenda }>(cfg, "agenda_criar", e)).evento;
}

export async function buscarDrive(cfg: ConfigGoogle, termo: string): Promise<ArquivoDrive[]> {
  return (await chamar<{ arquivos: ArquivoDrive[] }>(cfg, "drive_buscar", { termo })).arquivos;
}

export async function lerDrive(cfg: ConfigGoogle, id: string): Promise<string> {
  return (await chamar<{ texto: string }>(cfg, "drive_ler", { id })).texto;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function textoAgenda(ev: EventoAgenda[]): string {
  if (!ev.length) return "Nenhum compromisso no período.";
  return ev.map((e) => `• ${e.diaInteiro ? new Date(e.inicio).toLocaleDateString("pt-BR") + " (dia inteiro)" : fmt(e.inicio)} — ${e.titulo}${e.local ? ` (${e.local})` : ""}`).join("\n");
}

// Perguntas sobre agenda/compromissos recebem a agenda real junto, para o Cortex responder com dados de verdade.
export function parecePerguntaDeAgenda(texto: string): boolean {
  return /\b(agenda|compromisso|reuni[aã]o|evento|hoje|amanh[aã]|esta semana|essa semana|semana que vem|livre|ocupad)/i.test(texto);
}

// "/agendar 2026-10-10 15:00 | Reunião com cliente"  (hora de Brasília, horário local do navegador)
export function lerComandoAgendar(args: string): { titulo: string; inicio: string } | null {
  const m = args.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})\s*\|\s*(.+)$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00`);
  if (isNaN(d.getTime())) return null;
  return { titulo: m[3].trim(), inicio: d.toISOString() };
}

export function urlImagem(prompt: string): string {
  const seed = Math.floor(Math.random() * 1e6);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 400))}?width=1024&height=768&nologo=true&seed=${seed}`;
}
