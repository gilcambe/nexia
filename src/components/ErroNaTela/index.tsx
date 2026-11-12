import { Component, type ReactNode } from "react";

// 12/11/2026: sem isto, qualquer erro numa tela deixava a página preta ("Feito com Kernex" e mais nada).
// Agora aparece o motivo e um botão Recarregar. Arquivo velho em cache (versão nova publicada) recarrega sozinho uma vez.
const CHAVE = "kx-recarregou-por-erro";
const ehArquivoVelho = (e: unknown) => /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i.test(String((e as Error)?.message || e));

type Estado = { erro: Error | null };

export default class ErroNaTela extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado { return { erro }; }

  componentDidCatch(erro: Error) {
    console.error("[Kernex] erro na tela:", erro);
    try {
      if (ehArquivoVelho(erro) && !sessionStorage.getItem(CHAVE)) { sessionStorage.setItem(CHAVE, "1"); window.location.reload(); }
    } catch { /* sem sessionStorage: segue mostrando o aviso */ }
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    return (
      <div role="alert" data-testid="kx-erro-na-tela" style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ maxWidth: 520, width: "100%", background: "#111827", borderRadius: 12, padding: 20 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Esta tela teve um erro</h1>
          <p style={{ margin: "0 0 12px", color: "#9ca3af" }}>Tire uma foto desta mensagem e mande para o Claude. Depois toque em Recarregar.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, background: "#0b1220", padding: 10, borderRadius: 8 }}>{String(erro.message || erro).slice(0, 600)}</pre>
          <button type="button" onClick={() => { try { sessionStorage.removeItem(CHAVE); } catch { /* ok */ } window.location.reload(); }}
            style={{ marginTop: 12, minHeight: 44, padding: "0 18px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontWeight: 600 }}>Recarregar</button>
        </div>
      </div>
    );
  }
}
