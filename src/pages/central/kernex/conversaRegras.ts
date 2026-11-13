// C2-F2 (PC 2, 13/11): tela "Conversar". O dono escreve como fala ("crie um site para a barbearia do João
// em Recife, zap 81 99999-9999"); estas regras puras tiram a ficha do texto, dizem o que falta perguntar
// e montam o pedido de mudança num projeto. Sem IA aqui: o Cortex/Fábrica fazem o trabalho no servidor.

export type FichaChat = { nome?: string; ramo?: string; cidade?: string; whatsapp?: string; fotos?: string[] };
export type Intencao = "criar" | "publicar" | "mudar" | "conversa";

const sem = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ramos que a Fábrica conhece (palavra no texto → ramo da ficha). */
export const RAMOS: [RegExp, string][] = [
  [/barbear/, "barbearia"], [/salao|cabeleire/, "salão de beleza"], [/estetic/, "estética"], [/dentist|odonto/, "dentista"],
  [/clinica|consultorio/, "clínica"], [/restaurant|lanchonete|hamburgu|pizzar/, "restaurante"], [/padaria|confeitar/, "padaria"],
  [/academia|personal/, "academia"], [/pet ?shop|veterinar/, "pet shop"], [/advoga/, "advocacia"], [/viage|turismo/, "viagens"],
  [/loja|boutique/, "loja"], [/oficina|mecanic/, "oficina"], [/imobiliar|corretor/, "imobiliária"], [/escola|curso/, "escola"],
  [/fotograf/, "fotografia"], [/psicolog|terapeut/, "psicologia"], [/nutricion/, "nutrição"], [/contab/, "contabilidade"],
];

export function intencao(texto: string, temPrevia = false): Intencao {
  const t = sem(texto);
  if (temPrevia && /\b(gostei|pode publicar|publica|publicar|aprovad[oa]|manda pro ar)\b/.test(t)) return "publicar";
  if (/\b(cri[ae]r?|fa[cz]a|fazer|mont[ae]r?|quero|preciso de)\b.*\b(site|sistema|app|aplicativo|loja virtual|pagina)\b/.test(t)) return "criar";
  if (/\b(mud[ae]r?|troqu?e|trocar|tir[ae]r?|coloc[ae]r?|ponha|acrescent[ae]|arrum[ae]r?|corrij[ae]|corrigir|aument[ae]|diminu)/.test(t)) return "mudar";
  return "conversa";
}

/** Tira do texto o que der para a ficha; o que já estava preenchido continua (o novo só completa). */
export function lerFicha(texto: string, atual: FichaChat = {}): FichaChat {
  const f: FichaChat = { ...atual };
  const t = String(texto || "");
  const fotos = t.match(/https:\/\/[^\s"'<>()\\,]+/g) || [];
  if (fotos.length) f.fotos = [...new Set([...(f.fotos || []), ...fotos])].slice(0, 6);
  const semLinks = t.replace(/https?:\/\/\S+/g, " ");
  const zap = (semLinks.match(/(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}/) || [])[0];
  if (zap && !f.whatsapp) { const d = zap.replace(/\D/g, ""); f.whatsapp = d.length <= 11 ? "55" + d : d; }
  const s = sem(semLinks);
  if (!f.ramo) { const r = RAMOS.find(([re]) => re.test(s)); if (r) f.ramo = r[1]; }
  if (!f.cidade) {
    const c = semLinks.match(/\b(?:em|na cidade de|cidade:?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?:\s+(?:de|do|da|dos)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+)*)/);
    if (c) f.cidade = c[1].trim();
  }
  if (!f.nome) {
    const n = semLinks.match(/\b(?:chamad[oa]|nome(?: [ée]| do neg[óo]cio [ée])?:?)\s+["“]?([^,.;\n"”]+?)["”]?(?=\s+(?:em|no|na|com|zap|whats)\b|[,.;\n]|$)/i)
      || semLinks.match(/\b(?:para|pra|pro)\s+(?:a|o)\s+((?:[\wÀ-ú]+\s+)?(?:d[aoe]s?)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+)*)/);
    if (n) f.nome = n[1].trim().replace(/^./, (x) => x.toUpperCase());
  }
  return f;
}

/** O que ainda falta, na ordem em que o Cortex pergunta. Fotos são opcionais e entram só como sugestão. */
export function falta(f: FichaChat): ("nome" | "ramo" | "cidade" | "whatsapp")[] {
  const out: ("nome" | "ramo" | "cidade" | "whatsapp")[] = [];
  if (!f.nome || f.nome.length < 2) out.push("nome");
  if (!f.ramo) out.push("ramo");
  if (!f.cidade) out.push("cidade");
  const d = String(f.whatsapp || "").replace(/\D/g, "");
  if (d.length < 12 || d.length > 13) out.push("whatsapp");
  return out;
}

const PERG: Record<string, string> = {
  nome: "qual é o nome do negócio",
  ramo: "qual é o ramo (ex.: barbearia, dentista, restaurante)",
  cidade: "em que cidade fica",
  whatsapp: "qual é o WhatsApp com DDD (ex.: 81 99999-9999)",
};

/** Pergunta curta e educada com tudo o que falta de uma vez. */
export function pergunta(f: FichaChat): string {
  const k = falta(f);
  if (!k.length) return "";
  const partes = k.map((x) => PERG[x]);
  const lista = partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0];
  return `Para eu montar, me diga ${lista}?` + (f.fotos?.length ? "" : " Se tiver fotos do negócio, anexe aqui (opcional).");
}

/** Resumo do que o Cortex entendeu, para o dono conferir antes de gerar. */
export function resumoFicha(f: FichaChat): string {
  return `Entendi: ${f.nome} (${f.ramo}) em ${f.cidade}, WhatsApp ${f.whatsapp}${f.fotos?.length ? `, ${f.fotos.length} foto(s)` : ""}. Vou gerar a prévia agora.`;
}

/** Ficha no formato que a Fábrica (fabrica-criar) aceita. */
export function fichaParaFabrica(f: FichaChat) {
  return { nome: String(f.nome || "").trim(), ramo: String(f.ramo || "").trim(), cidade: String(f.cidade || "").trim(), whatsapp: String(f.whatsapp || "").replace(/\D/g, ""), precisa: ["site", "whatsapp"], ...(f.fotos?.length ? { fotos: f.fotos.join(",") } : {}) };
}

/** Pedido de mudança que vai para a fila do Cortex, com o projeto e a prévia que o dono estava vendo. */
export function pedidoDeMudanca(projeto: string, texto: string, previa?: string | null): string {
  const linhas = [`[Projeto: ${projeto}] ${String(texto || "").trim()}`];
  if (previa) linhas.push(`Prévia que o dono estava vendo: ${previa}`);
  linhas.push("Pedido feito pela tela Conversar da Central; mostrar a prévia do PR antes de publicar.");
  return linhas.join("\n");
}

/** Só abre na moldura endereço https (prévias da KERNEX/Cloudflare/GitHub); o resto vira link. */
export const previaNaMoldura = (url?: string | null): boolean => /^https:\/\/[\w.-]+\.(?:pages\.dev|kernex\.com\.br|workers\.dev|github\.io)(?:\/|$)/.test(String(url || ""));
