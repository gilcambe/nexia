import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import { sourceFiles, categories } from "./data/sourceFiles";
import CodeViewer from "./components/CodeViewer";

export default function CodigoPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    return sourceFiles.filter((file) => {
      const matchesCategory = activeCategory === "all" || file.category === activeCategory;
      const matchesSearch =
        !search ||
        file.path.toLowerCase().includes(search.toLowerCase()) ||
        file.description.toLowerCase().includes(search.toLowerCase()) ||
        file.content.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const totalLines = useMemo(
    () => sourceFiles.reduce((acc, f) => acc + f.content.split("\n").length, 0),
    []
  );

  const handleCopyAll = useCallback(() => {
    const allCode = sourceFiles
      .map((f) => `// ===== ${f.path} =====\n${f.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(allCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20">
                <i className="ri-arrow-left-line text-nexia-cyan text-sm" />
              </div>
              Voltar ao site
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/pipeline")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-node-tree" /> Pipeline</button>
              <button onClick={() => navigate("/sentinel")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-shield-keyhole-line" /> Sentinel QA</button>
              <button onClick={() => navigate("/docs")} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-book-open-line" /> Docs</button>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20">
              <i className="ri-code-box-line text-nexia-cyan text-xl" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Código-Fonte NEXIA OS</h1>
          </div>
          <p className="text-sm md:text-base text-nexia-muted max-w-lg">
            Todo o código gerado. Copie, cole no Cursor/VS Code e entregue à Claude para incorporar no projeto.
          </p>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <ScrollReveal direction="up" delay={0}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-nexia-surface border border-nexia-border">
                <span className="text-xs text-nexia-muted">{sourceFiles.length} arquivos</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-nexia-surface border border-nexia-border">
                <span className="text-xs text-nexia-muted">{totalLines.toLocaleString()} linhas</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-nexia-surface border border-nexia-border">
                <span className="text-xs text-nexia-muted">React 18 + TypeScript + Tailwind</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="flex-1 lg:flex-none relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-nexia-muted text-xs" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar arquivo, função ou código..."
                  className="w-full lg:w-72 pl-9 pr-3 py-2 rounded-lg bg-nexia-bg border border-nexia-border text-sm text-white placeholder-nexia-muted focus:outline-none focus:border-nexia-cyan/40 transition-colors"
                />
              </div>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <i className={copied ? "ri-check-line" : "ri-file-copy-line"} /> {copied ? "Copiado!" : "Copiar Tudo"}
              </button>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={60}>
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-nexia-cyan/15 text-nexia-cyan border-nexia-cyan/40"
                    : "bg-nexia-surface2 text-nexia-muted border-nexia-border hover:border-nexia-border/60"
                }`}
              >
                <i className={cat.icon} /> {cat.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nexia-muted">
              Mostrando {filtered.length} de {sourceFiles.length} arquivos
            </span>
          </div>
          {filtered.map((file, i) => (
            <ScrollReveal key={file.path} direction="up" delay={80 + i * 40}>
              <CodeViewer file={file} />
            </ScrollReveal>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <i className="ri-search-line text-nexia-muted text-2xl mb-3" />
              <p className="text-sm text-nexia-muted">Nenhum arquivo encontrado para esta busca.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-nexia-border bg-nexia-surface mt-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20">
              <i className="ri-brain-fill text-nexia-cyan text-sm" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight">
              NEXIA<span className="text-nexia-cyan">OS</span>
            </span>
          </div>
          <span className="text-[11px] text-nexia-muted">
            Código-fonte completo · Build 2026.05.03 · Pronto para exportação
          </span>
        </div>
      </footer>
    </div>
  );
}
