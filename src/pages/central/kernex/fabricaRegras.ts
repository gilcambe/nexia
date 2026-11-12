// Fábrica por módulos (M5, PC 2): tipos do contrato fixo (equipe/FABRICA-MODULOS-PLANO.md, seção 2) e regras puras
// das telas Novo sistema / Clonar / Biblioteca. Sem React aqui, para dar para testar com node --test.

export type Modulo = { id: string; nome: string; faz: string; nichos: string[]; nivel: 1 | 2 | 3; pronto: boolean; origem: string; testes: number };
export type Modelo = { id: string; nome: string; nichos: string[]; modulos: string[]; clonavel: boolean; previa: string };
export type Catalogo = { modulos: Modulo[]; modelos: Modelo[] };
export type Ficha = { nome: string; ramo: string; cidade?: string; whatsapp: string; precisa: string[] };
export type Consulta = {
  modelo: { id: string; nome: string; porque: string } | null;
  prontos: { id: string; nome: string }[];
  parecidos: { pedido: string; id: string; nome: string; diferenca: string }[];
  faltam: string[]; nivel: 1 | 2 | 3; minutos: number; erros: string[];
};
export type Status = { status: "previa" | "gerando" | "reprovado" | "no-ar"; previa?: string; portoes?: { nome: string; ok: boolean }[]; minutos?: number };

/** O que dá para marcar em "O que o sistema precisa" (ids da Biblioteca). */
export const PRECISA = [
  ["site", "Site"], ["agenda", "Agenda online"], ["whatsapp", "WhatsApp"], ["pagamento", "Pagamento"],
  ["login-google", "Login"], ["area-cliente", "Área do cliente"], ["admin-painel", "Painel do dono"], ["pwa-instalar", "App no celular"],
] as const;

export const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca na Biblioteca por nome, o que faz, nicho ou origem, sem acento. Texto vazio devolve tudo. */
export function filtrarBiblioteca(cat: Catalogo | null, q: string): Catalogo {
  const vazio = { modulos: [], modelos: [] };
  if (!cat) return vazio;
  const t = semAcento(q);
  if (!t) return { modulos: cat.modulos || [], modelos: cat.modelos || [] };
  const casa = (...campos: (string | string[])[]) => campos.flat().some((c) => semAcento(c).includes(t));
  return {
    modulos: (cat.modulos || []).filter((m) => casa(m.nome, m.faz, m.nichos, m.origem, m.id)),
    modelos: (cat.modelos || []).filter((m) => casa(m.nome, m.nichos, m.id)),
  };
}

/** Confere a ficha antes de mandar ao servidor. Devolve a lista de erros em português simples (vazia = ok). */
export function errosDaFicha(f: Partial<Ficha>): string[] {
  const erros: string[] = [];
  if (!f.nome || f.nome.trim().length < 2) erros.push("Escreva o nome do negócio.");
  if (!f.ramo || f.ramo.trim().length < 2) erros.push("Diga o ramo (ex.: dentista, viagens).");
  const zap = String(f.whatsapp || "").replace(/\D/g, "");
  if (zap.length < 12 || zap.length > 13) erros.push("WhatsApp com DDI e DDD, só números (ex.: 5581999999999).");
  if (!f.precisa || f.precisa.length === 0) erros.push("Marque pelo menos uma coisa que o sistema precisa.");
  return erros;
}

/** Limpa a ficha para enviar: tira espaços, deixa o WhatsApp só com números e tira itens repetidos. */
export function limparFicha(f: Ficha): Ficha {
  return { nome: f.nome.trim(), ramo: f.ramo.trim(), cidade: (f.cidade || "").trim(), whatsapp: String(f.whatsapp).replace(/\D/g, ""), precisa: [...new Set(f.precisa)] };
}

/** Os três grupos que o dono vê na consulta: pronto (verde), adaptar (amarelo), criar (vermelho). */
export function grupos(c: Consulta | null) {
  return { prontos: c?.prontos?.length || 0, adaptar: c?.parecidos?.length || 0, criar: c?.faltam?.length || 0 };
}

/** Texto curto do tempo estimado. */
export function textoTempo(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "sem estimativa";
  if (min < 1) return "menos de 1 minuto";
  if (min < 60) return `cerca de ${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `cerca de ${h} h ${m} min` : `cerca de ${h} h`;
}

/** Modelos que dá para clonar, os do mesmo ramo primeiro. */
export function modelosParaClonar(cat: Catalogo | null, ramo = ""): Modelo[] {
  const r = semAcento(ramo);
  const lista = (cat?.modelos || []).filter((m) => m.clonavel);
  if (!r) return lista;
  const doRamo = (m: Modelo) => m.nichos.some((n) => semAcento(n).includes(r) || r.includes(semAcento(n)));
  return [...lista.filter(doRamo), ...lista.filter((m) => !doRamo(m))];
}

/** Rótulo do status da criação, para a pessoa leiga. */
export const ROTULO_STATUS: Record<Status["status"], string> = {
  gerando: "Montando a prévia…", previa: "Prévia pronta: confira e publique", reprovado: "Não passou nos testes: veja o motivo", "no-ar": "Publicado e no ar",
};

/** Erro do servidor que significa "a Fábrica ainda não existe no servidor" (o M4 ainda não entrou). */
export const servidorSemFabrica = (msg: string) => /parte|desconhecid|inv[aá]lid|404|n[aã]o existe|unknown/i.test(String(msg || ""));
