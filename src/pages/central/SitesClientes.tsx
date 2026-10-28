import { useState } from "react";
import type { Dados } from "./api";
import { Caixa, VerTodos, useModo } from "./Painel";
import { Icone } from "./icones";
import { Botao } from "./ui";

type Cliente = {
  id: string;
  nome: string;
  slug: string;
  nicho: string;
  site?: string;
  painel?: string;
};

export default function SitesClientes({ d }: { d: Dados }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [nicho, setNicho] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([
    { id: "1", nome: "Kernex", slug: "kernex", nicho: "Tecnologia", site: "https://kernex.com", painel: "https://kernex.com/admin" },
    { id: "2", nome: "Studio Lima", slug: "studiolima", nicho: "Beleza", site: "https://studiolima.com.br", painel: "https://studiolima.com.br/admin" },
    { id: "3", nome: "Bezsan", slug: "bezsan", nicho: "Moda", site: "https://bezsan.com.br", painel: "https://bezsan.com.br/admin" },
  ]);
  
  const gerarCodigo = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };
  
  const salvarCliente = () => {
    if (!nome || !slug || !nicho) return;
    
    const novoCliente: Cliente = {
      id: Date.now().toString(),
      nome,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      nicho,
    };
    
    setClientes([...clientes, novoCliente]);
    setNome("");
    setSlug("");
    setNicho("");
    setModalAberto(false);
  };
  
  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert("Link copiado para a área de transferência!");
  };
  
  const { compacto, naFolha } = useModo();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Sites de Clientes</h1>
        <button 
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Icone nome="mais" className="w-4 h-4" />
          Novo cliente
        </button>
      </div>
      
      <Caixa 
        titulo="Clientes cadastrados" 
        resumo={`${clientes.length} clientes no total`} 
        icone="tenants"
        acao={<VerTodos onClick={() => {}} />}
      >
        {!clientes.length ? (
          <div className="text-center py-8 text-slate-500">
            <Icone nome="tenants" className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>Nenhum cliente cadastrado ainda.</p>
            <button 
              onClick={() => setModalAberto(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Cadastrar o primeiro cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((cliente) => {
              const codigo = gerarCodigo();
              const linkBriefing = `/briefing/${codigo}`;
              
              return (
                <div key={cliente.id} className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold">{cliente.nome.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                        <p className="text-sm text-slate-500">{cliente.nicho}</p>
                        <p className="text-xs text-slate-400 mt-1">Slug: {cliente.slug}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {cliente.site && (
                        <a 
                          href={cliente.site} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Abrir site"
                        >
                          <Icone nome="site" className="w-4 h-4" />
                        </a>
                      )}
                      {cliente.painel && (
                        <a 
                          href={cliente.painel} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Abrir painel"
                        >
                          <Icone nome="externo" className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Link de briefing:</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => copiarLink(linkBriefing)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                        >
                          <Icone nome="copiar" className="w-3 h-3" />
                          Copiar
                        </button>
                        <button 
                          onClick={() => {
                            // Abrir a página de briefing
                            window.open(linkBriefing, '_blank');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                        >
                          <Icone nome="editar" className="w-3 h-3" />
                          Eu mesmo preencho
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-mono">
                        {linkBriefing}
                      </code>
                      <span className="text-xs text-slate-500">Código: {codigo}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Caixa>
      
      {/* Modal Novo Cliente */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Novo Cliente</h2>
              <button 
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Icone nome="fechar" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome do cliente
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Kernex"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Slug (URL amigável)
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: kernex"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nicho/Segmento
                </label>
                <input
                  type="text"
                  value={nicho}
                  onChange={(e) => setNicho(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Tecnologia, Beleza, Moda"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={salvarCliente}
                disabled={!nome || !slug || !nicho}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}