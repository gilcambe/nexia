import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Carregando } from "../central/ui";
import { usePedidos } from "./api";
import type { Filtro, Resumo } from "./api";
import Pedido from "./Pedido";
import Publicar from "./Publicar";
import { NovoPedido, Itens, Filtros } from "./partes";

// Cortex no celular: o dono manda pedidos ao Cortex e vê o histórico inteiro, sem precisar da Claude.
export default function MeuCortexPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { listar } = usePedidos();
  const [aberto, setAberto] = useState<number>(() => Number(location.hash.replace("#p", "")) || 0);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<Resumo[]>([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async (pg: number) => {
    setCarregando(true); setErro(undefined);
    try {
      const r = await listar(q, filtro, pg);
      setItens((x) => (pg === 1 ? r.itens : [...x, ...r.itens])); setPagina(pg); setTemMais(r.temMais);
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }, [listar, q, filtro]);

  useEffect(() => { if (!authLoading && user && !aberto) buscar(1); }, [authLoading, user, aberto, filtro]);

  const ir = (n: number) => { setAberto(n); history.replaceState(null, "", n ? `#p${n}` : location.pathname); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased pb-16">
      <header className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-nexia-border">
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold" data-testid="meu-cortex-titulo">🧠 Meu <span className="text-nexia-cyan">Cortex</span></h1>
          <a href="/central" className="text-xs text-nexia-muted">Central</a>
        </div>
      </header>
      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted">Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> como dono para abrir o Cortex.</p>
        )}
        {user && aberto > 0 && <Pedido n={aberto} voltar={() => ir(0)} />}
        {user && !aberto && (
          <>
            <NovoPedido enviado={() => buscar(1)} />
            <Publicar />
            <Filtros filtro={filtro} mudar={setFiltro} />
            <form onSubmit={(e) => { e.preventDefault(); buscar(1); }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Procurar nos pedidos" data-testid="meu-cortex-busca"
                className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-sm text-white" />
            </form>
            {erro && <Carregando erro={erro} />}
            <Itens itens={itens} abrir={ir} />
            {!carregando && !erro && !itens.length && <p className="text-sm text-nexia-muted">Nenhum pedido aqui.</p>}
            {carregando && <Carregando />}
            {temMais && !carregando && <Botao onClick={() => buscar(pagina + 1)} testid="meu-cortex-mais">Carregar mais</Botao>}
          </>
        )}
      </main>
    </div>
  );
}
