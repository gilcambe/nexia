import React, { useState } from "react";

export interface ClienteLote {
  id: string;
  nome: string;
  etapa: "briefing" | "spec" | "site" | "prévia" | "publicado";
  linkPrevia: string;
  printCelular: string;
  printComputador: string;
}

const CLIENTES_EXEMPLO: ClienteLote[] = [
  {
    id: "cliente-1",
    nome: "Studio Lima Estética",
    etapa: "prévia",
    linkPrevia: "https://studio-lima.pages.dev",
    printCelular: "https://studio-lima.pages.dev/prints/mobile.png",
    printComputador: "https://studio-lima.pages.dev/prints/desktop.png",
  },
  {
    id: "cliente-2",
    nome: "Bezsan Leilões",
    etapa: "site",
    linkPrevia: "https://bezsan-leiloes.pages.dev",
    printCelular: "https://bezsan-leiloes.pages.dev/prints/mobile.png",
    printComputador: "https://bezsan-leiloes.pages.dev/prints/desktop.png",
  },
];

export function LoteClientes() {
  const [clientes, setClientes] = useState<ClienteLote[]>(CLIENTES_EXEMPLO);
  const [slugsInput, setSlugsInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const aprovarEPublicar = (id: string) => {
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, etapa: "publicado" } : c))
    );
    setStatusMsg(`Cliente ${id} aprovado e publicado com sucesso.`);
  };

  const criarNovoLote = (e: React.FormEvent) => {
    e.preventDefault();
    const slugs = slugsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (slugs.length === 0) {
      setStatusMsg("Informe pelo menos um slug para o novo lote.");
      return;
    }

    const novos: ClienteLote[] = slugs.map((slug, idx) => ({
      id: `lote-${Date.now()}-${idx}`,
      nome: slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      etapa: "briefing",
      linkPrevia: `https://${slug}.pages.dev`,
      printCelular: `https://${slug}.pages.dev/prints/mobile.png`,
      printComputador: `https://${slug}.pages.dev/prints/desktop.png`,
    }));

    setClientes((prev) => [...prev, ...novos]);
    setSlugsInput("");
    setStatusMsg(`Novo lote criado com ${slugs.length} cliente(s).`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-[#0a0a0f] text-slate-100 min-h-screen">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Lote de Clientes</h1>
          <p className="text-sm text-slate-400">
            Acompanhamento e aprovação de lotes de sites de clientes
          </p>
        </div>
      </header>

      {statusMsg && (
        <div
          className="p-3 rounded-lg bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 text-sm flex items-center justify-between"
          role="status"
        >
          <span>{statusMsg}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-indigo-400 hover:text-indigo-200 text-xs cursor-pointer ml-2"
          >
            Fechar
          </button>
        </div>
      )}

      <form
        onSubmit={criarNovoLote}
        className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
      >
        <h2 className="text-base font-semibold text-slate-200">Novo Lote</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={slugsInput}
            onChange={(e) => setSlugsInput(e.target.value)}
            placeholder="Insira os slugs separados por vírgula (ex: clinica-alpha, salao-bella)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            data-testid="input-slugs-lote"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0"
            data-testid="btn-novo-lote"
          >
            Novo lote
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3 font-semibold">Nome do Cliente</th>
              <th className="p-3 font-semibold">Etapa Atual</th>
              <th className="p-3 font-semibold">Link da Prévia</th>
              <th className="p-3 font-semibold">Prints</th>
              <th className="p-3 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-medium text-slate-100">{cliente.nome}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      cliente.etapa === "publicado"
                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/50"
                        : cliente.etapa === "prévia"
                        ? "bg-amber-950/60 text-amber-300 border-amber-800/50"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/50"
                    }`}
                  >
                    {cliente.etapa}
                  </span>
                </td>
                <td className="p-3">
                  <a
                    href={cliente.linkPrevia}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    {cliente.linkPrevia.replace("https://", "")}
                  </a>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <a
                      href={cliente.printCelular}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-200 underline"
                    >
                      Celular
                    </a>
                    <span className="text-slate-600">·</span>
                    <a
                      href={cliente.printComputador}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-200 underline"
                    >
                      Computador
                    </a>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => aprovarEPublicar(cliente.id)}
                    disabled={cliente.etapa === "publicado"}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      cliente.etapa === "publicado"
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                    data-testid={`btn-aprovar-${cliente.id}`}
                  >
                    {cliente.etapa === "publicado" ? "Publicado" : "Aprovar e publicar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LoteClientes;
