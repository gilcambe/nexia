import { useCallback, useEffect, useRef, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";

// Kernex Store S2 (13/11/2026): pôr ou tirar um módulo pronto no site de um cliente, sem código.
// Servidor: parte=fabrica-store, acao=fabrica-store-instalar, parte=fabrica-store-status (netlify/functions/central/store.js).
interface Modulo { id: string; nome: string; faz: string; versao: string; preco: { mensal?: number; gratis_dias?: number } | null }
interface Dados { modulos: Modulo[]; clientes: string[] }
interface Andamento { status: "rodando" | "ok" | "falhou" | "nada"; link?: string }

export default function Store() {
  const { ler, agir } = useCentral();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [cliente, setCliente] = useState("");
  const [modulo, setModulo] = useState("");
  const [msg, setMsg] = useState("");
  const [and, setAnd] = useState<Andamento | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    ler<Dados>("parte=fabrica-store")
      .then((x) => setD({ modulos: x?.modulos || [], clientes: x?.clientes || [] }))
      .catch((e: Error) => setErro(e.message));
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [ler]);

  const acompanhar = useCallback((c: string, m: string) => {
    if (timer.current) window.clearInterval(timer.current);
    let n = 0;
    timer.current = window.setInterval(async () => {
      n++;
      try {
        const r = await ler<Andamento>(`parte=fabrica-store-status&cliente=${encodeURIComponent(c)}&modulo=${encodeURIComponent(m)}`);
        setAnd(r);
        if ((r?.status === "ok" || r?.status === "falhou") && timer.current) { window.clearInterval(timer.current); timer.current = null; }
      } catch { /* tenta de novo */ }
      if (n > 40 && timer.current) { window.clearInterval(timer.current); timer.current = null; }
    }, 15000);
  }, [ler]);

  const fazer = async (acao: "instalar" | "tirar") => {
    if (!cliente || !modulo) return;
    const nome = d?.modulos.find((m) => m.id === modulo)?.nome || modulo;
    if (!confirm(`${acao === "tirar" ? "Tirar" : "Pôr"} "${nome}" no site de ${cliente}? O site muda no ar em uns 2 minutos.`)) return;
    setMsg("Mandando…"); setAnd({ status: "rodando" });
    try {
      const r = await agir<{ mensagem: string }>({ acao: "fabrica-store-instalar", cliente, modulo, tirar: acao === "tirar" });
      setMsg(r?.mensagem || "Pedido enviado.");
      acompanhar(cliente, modulo);
    } catch (e) { setMsg((e as Error).message); setAnd(null); }
  };

  const mods = d?.modulos || [];
  const clis = d?.clientes || [];
  return (
    <div data-testid="kx-store">
      <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 12 }}>
        <Kpi cor="az" icone="check" valor={d ? mods.length : null} rotulo="Módulos na Store" />
        <Kpi cor="vd" icone="pasta" valor={d ? clis.length : null} rotulo="Clientes" />
        <Kpi cor="lj" icone="relogio" valor="1º mês" rotulo="Grátis" sub="decisão do dono" />
      </div>
      {erro && <p className="kx-sem">Não deu para ler a Store: {erro}</p>}
      <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Bloco titulo="Módulos" icone="check" ajuda="Cada módulo é um pedaço pronto e testado. Instalar = copiar para o site do cliente, sem escrever código." fonte={d ? "kernex-clientes/modulos" : null} atualizadoEm={null}>
          {d && !mods.length && <p className="kx-sem">Nenhum módulo ainda.</p>}
          <ul className="kx-lista">
            {mods.map((m) => (
              <li key={m.id}>
                <button type="button" className="kx-btn" data-testid={"kx-store-mod-" + m.id} style={{ width: "100%", justifyContent: "space-between", outline: modulo === m.id ? "2px solid #3b82f6" : undefined }} onClick={() => setModulo(m.id)}>
                  <span className="kx-titulo" style={{ whiteSpace: "normal", textAlign: "left" }}><b>{m.nome}</b><br /><span className="kx-mut">{m.faz}</span></span>
                  <span className="kx-mut">{m.preco?.gratis_dias ? `${m.preco.gratis_dias} dias grátis` : "grátis"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Pôr no site" icone="enviar" ajuda="Escolha o módulo à esquerda e o cliente aqui. O site é testado e publicado sozinho; fica guardado num PR." fonte="GitHub Actions (Store)" atualizadoEm={null}>
          <label className="kx-mut" htmlFor="kx-store-cliente">Cliente</label>
          <select id="kx-store-cliente" data-testid="kx-store-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} style={{ width: "100%", minHeight: 44, margin: "6px 0 10px" }}>
            <option value="">Escolha…</option>
            {clis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="kx-mut">Módulo: <b>{mods.find((m) => m.id === modulo)?.nome || "escolha à esquerda"}</b></p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="kx-btn" disabled={!cliente || !modulo} onClick={() => fazer("instalar")} data-testid="kx-store-instalar">Pôr no site</button>
            <button type="button" className="kx-btn" disabled={!cliente || !modulo} onClick={() => fazer("tirar")} data-testid="kx-store-tirar">Tirar</button>
          </div>
          {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
          {and && <p className="kx-mut">{and.status === "rodando" ? "⏳ Fazendo…" : and.status === "ok" ? "✅ Pronto e no ar." : and.status === "falhou" ? "❌ Não deu certo." : ""} {and.link && <a href={and.link} target="_blank" rel="noreferrer">detalhes</a>}</p>}
        </Bloco>
      </div>
    </div>
  );
}
