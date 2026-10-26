// Logo de produto, tenant ou serviço. Só ativos reais (public/central/logos); sem arquivo: inicial, marcada como provisória.
const CORES = ["bg-indigo-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];

export default function Logo({ nome, src, tam = 40 }: { nome: string; src?: string | null; tam?: number }) {
  const estilo = { width: tam, height: tam };
  if (src) {
    return (
      <span className="inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 shadow-sm shrink-0 overflow-hidden" style={estilo}>
        <img src={src} alt={`Logo ${nome}`} className="w-[70%] h-[70%] object-contain" loading="lazy" />
      </span>
    );
  }
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span title="Ícone provisório (sem logo oficial no projeto)" className={`inline-flex items-center justify-center rounded-xl text-[#fff] font-bold shrink-0 ${CORES[h % CORES.length]}`}
      style={{ ...estilo, fontSize: tam * 0.42 }}>{nome.trim().charAt(0).toUpperCase()}</span>
  );
}

// Logo dos serviços externos (ícones oficiais da coleção Simple Icons, CC0, copiados para public/central/logos).
const MARCAS: Record<string, string> = {
  cloudflare: "cloudflare", "workers-ai": "cloudflare", d1: "cloudflare", firebase: "firebase", github: "github", "github-models": "github",
  gemini: "gemini", nvidia: "nvidia", meta: "meta", shopee: "shopee", amazon: "amazon", brevo: "brevo", play: "googleplay", ollama: "ollama",
};
export const logoServico = (id: string) => (MARCAS[id] ? `/central/logos/${MARCAS[id]}.svg` : null);
