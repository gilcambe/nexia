import { useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Icone from "./Icone";
import Kpi from "./Kpi";

// 09/11 (dono): "ONDE CLONO OS TENANTS... ONDE FICAM OS TEMPLATES DE BASE". Tela no menu com os dois.
// Modelos de site = clientes/_moldes/*.json (Site Kit); modelos de sistema = clientes/_moldes/indice.json.
const BASE = "https://github.com/gilcambe/nexia/blob/develop/clientes/_moldes/";
export const MODELOS_SITE = [
  ["academia-personal", "Academia e personal"], ["advogado", "Advogado"], ["clinica", "Clínica"], ["contabilidade", "Contabilidade"],
  ["dentista", "Dentista"], ["eventos", "Eventos"], ["imobiliaria", "Imobiliária"], ["loja", "Loja"], ["restaurante", "Restaurante"], ["salao-estetica", "Salão e estética"],
] as const;
export const MODELOS_SISTEMA = [["agenda", "Agenda e atendimentos"], ["crm-vendas", "CRM de vendas"]] as const;

export default function Clientes() {
  const { agir } = usePedidos();
  const [msg, setMsg] = useState<string | null>(null);
  const criar = async (tipo: "site" | "sistema", id: string, nome: string) => {
    const cliente = prompt(`Nome do cliente para o ${tipo} "${nome}":`);
    if (!cliente || cliente.trim().length < 2) return;
    const texto = tipo === "site"
      ? `Criar o site do cliente "${cliente.trim()}" usando o modelo base clientes/_moldes/${id}.json (Site Kit). Copiar para clientes/<nome-do-cliente>/site.json, preencher os textos do cliente e publicar com o robô "Novo site de cliente" em <nome-do-cliente>.pages.dev.`
      : `Criar o sistema "${nome}" para o cliente "${cliente.trim()}" usando o molde "${id}" de clientes/_moldes/indice.json. Publicar grátis e me mostrar o link.`;
    setMsg("Mandando…");
    try { const r = await agir({ acao: "pedir", texto }); setMsg(r.mensagem + " Acompanhe em Pedir."); } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
  };
  return (
    <div className="kx-tela">
      <div className="kx-kpis" data-testid="kx-kpis-clientes">
        <Kpi cor="az" icone="arquivo" valor={MODELOS_SITE.length} rotulo="Modelos de site" sub="prontos para usar" />
        <Kpi cor="rx" icone="pasta" valor={MODELOS_SISTEMA.length} rotulo="Modelos de sistema" />
        <Kpi cor="vd" icone="troca" valor="Clonar" rotulo="Copiar um cliente" sub="toque para abrir" onClick={() => { location.href = "/projetos"; }} />
        <Kpi cor="lj" icone="foguete" valor="Grátis" rotulo="Publicação" sub="nome.pages.dev" />
      </div>
      {msg && <p className="kx-mut" style={{ whiteSpace: "normal", margin: 0 }} data-testid="kx-clientes-msg">{msg}</p>}
      <div className="kx-grade" style={{ gridTemplateColumns: "1fr 2fr" }}>
        <Bloco icone="troca" corIcone="#34d399" titulo="Clonar ou criar um cliente" ajuda="Copia um cliente (tenant) que já existe para um novo: ajustes, projetos e robôs. Senhas, pessoas e cobrança nunca são copiadas." fonte="Vault (clientes e projetos)" atualizadoEm={null}>
          <div className="kx-passos neutro" data-testid="kx-clonar">
            <ol>
              <li>Toque em "Abrir clientes".</li>
              <li>Abra "Duplicar tenant". Em "Origem", escreva o cliente que quer copiar (ex.: studiolima). Em "Id do tenant novo", o nome do novo (ex.: ces-2027).</li>
              <li>Toque em "Prévia" para ver o que vai ser copiado. Se estiver certo, toque em "Duplicar".</li>
            </ol>
            <a className="kx-btn forte" href="/projetos"><Icone nome="troca" tam={16} />Abrir clientes</a>
          </div>
        </Bloco>
        <Bloco icone="arquivo" corIcone="#fbbf24" titulo="Modelos base" ajuda="Os modelos que definimos para começar rápido. Toque em Usar, diga o nome do cliente, e o Cortex cria e publica." fonte="clientes/_moldes no GitHub" atualizadoEm={null}>
          <p className="kx-mut" style={{ margin: "0 0 6px" }}>Sites</p>
          <div className="kx-ladrilhos" data-testid="kx-modelos" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 8 }}>
            {MODELOS_SITE.map(([id, nome]) => (
              <div key={id} className="kx-passos neutro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <b>{nome}</b>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="kx-btn forte" onClick={() => criar("site", id, nome)}>Usar</button>
                  <a className="kx-btn" href={BASE + id + ".json"} target="_blank" rel="noreferrer">Ver</a>
                </div>
              </div>
            ))}
          </div>
          <p className="kx-mut" style={{ margin: "10px 0 6px" }}>Sistemas</p>
          <div className="kx-ladrilhos" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 8 }}>
            {MODELOS_SISTEMA.map(([id, nome]) => (
              <div key={id} className="kx-passos neutro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <b>{nome}</b>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="kx-btn forte" onClick={() => criar("sistema", id, nome)}>Usar</button>
                  <a className="kx-btn" href={BASE + "indice.json"} target="_blank" rel="noreferrer">Ver</a>
                </div>
              </div>
            ))}
          </div>
        </Bloco>
      </div>
    </div>
  );
}
