import { useState } from "react";
import type { Dados, Produto } from "./api";
import { useCentral } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";

export default function Produtos({ d }: { d: Dados }) {
  const { entrarSuporte } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const [busca, setBusca] = useState(() => { try { return sessionStorage.getItem("central-busca") || ""; } catch { return ""; } });
  if (!d.lista) return <Carregando />;
  const simples = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const produtos = d.lista.produtos.filter((p) => simples(`${p.nome} ${p.frase}`).includes(simples(busca.trim())));

  const entrar = async (site: string) => {
    const aba = window.open("about:blank", "_blank"); // o celular bloqueia abas abertas depois de esperar a rede
    setMsg(null);
    try { const url = await entrarSuporte(site); if (aba) aba.location.href = url; else window.location.href = url; }
    catch (e) { aba?.close(); setMsg((e as Error).message); }
  };
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setMsg("Link copiado. É só colar no WhatsApp."); } catch { setMsg(url); }
  };

  const ehCliente = (p: Produto) => p.tipo === "cliente" || p.tipo === "tenant" || (!p.tipo && p.frase?.toLowerCase().startsWith("cliente:"));
  const nossosProdutos = produtos.filter((p) => !ehCliente(p));
  const clientesTenants = produtos.filter((p) => ehCliente(p));

  const renderCard = (p: Produto) => {
    const m = d.saude?.produtos.find((x) => x.id === p.id);
    const emBreve = p.pendente || !p.site;
    const cor = emBreve || !m || m.ok == null ? "cinza" : !m.ok ? "vermelho" : m.lento ? "amarelo" : "verde";
    const estado = emBreve ? "em breve" : !m || m.ok == null ? "conferindo…" : !m.ok ? "fora do ar" : m.lento ? `lento (${(m.tempo / 1000).toFixed(1)} s)` : `no ar (${(m.tempo / 1000).toFixed(1)} s)`;
    return (
      <Cartao key={p.id}>
        <div className="flex items-start gap-3" data-testid={`produto-${p.id}`}>
          <div className="text-3xl leading-none">{p.icone}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{p.nome}</div>
            <div className="text-xs text-nexia-muted">{p.frase}</div>
            <div className="flex items-center gap-2 text-xs mt-1"><Sinal cor={cor} />{estado}</div>
          </div>
        </div>
        {p.site ? (
          <div className="grid grid-cols-2 gap-2">
            <Botao href={p.site}>🌐 Abrir site</Botao>
            {p.painel && <Botao href={p.painel}>⚙️ Abrir painel</Botao>}
            {p.suporte && <Botao onClick={() => entrar(p.suporte!)} testid={`suporte-${p.suporte}`}>🛟 Entrar como suporte</Botao>}
            <Botao onClick={() => copiar(p.site!)}>📋 Copiar link</Botao>
          </div>
        ) : <p className="text-xs text-nexia-muted" data-testid={`em-breve-${p.id}`}>Site em breve</p>}
      </Cartao>
    );
  };

  const prodNoAr = nossosProdutos.filter((p) => p.site && !p.pendente).length;
  const cliNoAr = clientesTenants.filter((p) => p.site && !p.pendente).length;

  return (
    <div className="space-y-4">
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou cliente"
        className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-sm text-white" data-testid="produtos-busca" />
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      {produtos.length === 0 && <p className="text-sm text-nexia-muted">Nada encontrado com "{busca}".</p>}

      {nossosProdutos.length > 0 && (
        <section className="space-y-3" data-testid="bloco-nossos-produtos">
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-semibold text-sm">Nossos produtos</h3>
            <span className="text-xs text-nexia-muted font-medium" data-testid="contador-produtos">{nossosProdutos.length} {nossosProdutos.length === 1 ? "produto" : "produtos"}, {prodNoAr} no ar</span>
          </div>
          <div className="space-y-3">
            {nossosProdutos.map(renderCard)}
          </div>
        </section>
      )}

      {clientesTenants.length > 0 && (
        <section className="space-y-3" data-testid="bloco-clientes-tenants">
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-semibold text-sm">Clientes (tenants)</h3>
            <span className="text-xs text-nexia-muted font-medium" data-testid="contador-clientes">{clientesTenants.length} {clientesTenants.length === 1 ? "cliente" : "clientes"}, {cliNoAr} no ar</span>
          </div>
          <div className="space-y-3">
            {clientesTenants.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
