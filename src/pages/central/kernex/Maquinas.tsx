import { useEffect, useState } from "react";
import { useCentral, type Maquina } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import { haQuanto } from "./regras";

// 09/11 (dono): "o PC2 está ligado e mostra desligado". A Central só sabe se o PC MANDA SINAL (programa
// "NEXIA Agente", tools/agente-maquina). Sem sinal não quer dizer desligado: diz isso e ensina o que fazer.
function SemSinal({ nome, nunca }: { nome: string; nunca: boolean }) {
  const [baixando, setBaixando] = useState(false);

  const baixarInstalador = () => {
    setBaixando(true);
    // Simula o download do instalador (substituir pela lógica real)
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = "/caminho/para/instalador.exe"; // Substituir pelo caminho real
      link.download = "NEXIA-Agente-Instalador.exe";
      link.click();
      setBaixando(false);
    }, 1000);
  };

  return (
    <div className="kx-passos" data-testid="kx-sem-sinal">
      <b>O que fazer no {nome}:</b>
      <button
        onClick={baixarInstalador}
        disabled={baixando}
        className="kx-botao-instalador"
      >
        {baixando ? "Baixando..." : "Baixar instalador"}
      </button>
      {nunca ? (
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>Baixe e execute o instalador no {nome}.</li>
          <li>O programa NEXIA Agente será instalado e configurado para iniciar com o Windows.</li>
        </ol>
      ) : (
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>Se o {nome} está ligado, o programa NEXIA Agente pode ter parado.</li>
          <li>Reinicie o {nome}. O programa deve reiniciar automaticamente.</li>
          <li>Se não voltar, baixe e execute o instalador novamente no {nome}.</li>
        </ol>
      )}
    </div>
  );
}

// #3219 parte 7: Máquinas. Lê o batimento que os PCs já mandam (nexia-ai/maquinas, parte=maquinas).
export default function Maquinas() {
  const { buscar } = useCentral();
  const [d, setD] = useState<{ ligado: boolean; maquinas: Maquina[]; em: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => buscar("maquinas").then((x) => setD({ ...x, em: new Date().toISOString() })).catch((e) => setErro((e as Error).message));
    ler(); const t = setInterval(ler, 60000); return () => clearInterval(t);
  }, [buscar]);
  const lista = d?.maquinas || [];
  const fonte = d && d.ligado ? "batimento dos PCs a cada minuto (banco maquinas)" : null;
  const ligadas = lista.filter((m) => m.online).length;
  const ultimo = lista.map((m) => m.visto_em || "").sort().slice(-1)[0];
  const modelos = new Set(lista.flatMap((m) => m.modelos || []));
  return (
    <div className="kx-tela">
      <div className="kx-kpis" data-testid="kx-kpis-maquinas">
        <Kpi cor="vd" icone="pc" valor={fonte ? ligadas : null} rotulo="Mandando sinal" sub={fonte ? `de ${lista.length}` : "sem sinal dos PCs ainda"} />
        <Kpi cor="vm" icone="alerta" valor={fonte ? lista.length - ligadas : null} rotulo="Sem sinal" sub="veja o que fazer no cartão" />
        <Kpi cor="rx" icone="ia" valor={fonte ? modelos.size : null} rotulo="IAs locais nos PCs" />
        <Kpi cor="lj" icone="relogio" valor={fonte && ultimo ? haQuanto(ultimo) : null} rotulo="Último sinal" />
      </div>
      <div className="kx-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {(lista.length ? lista : [{ nome: "PC 1" } as Maquina, { nome: "PC 2" } as Maquina]).slice(0, 4).map((m) => (
          <Bloco key={m.nome} icone="pc" corIcone="#34d399" titulo={m.nome} ajuda="Ligado ou desligado, memória livre e IAs locais deste PC." fonte={lista.length ? fonte : null} atualizadoEm={d?.em || null}>
            <p className="kx-sinal"><span className="kx-bola" style={{ background: m.online ? "#22c55e" : m.visto_em ? "#ef4444" : "#64748b" }} /><b>{m.online ? "Mandando sinal agora" : m.visto_em ? "Sem sinal há " + haQuanto(m.visto_em).replace(/^há /, "") : "Nunca mandou sinal"}</b></p>
            {!m.online && <SemSinal nome={m.nome} nunca={!m.visto_em} />}
            <ul className="kx-lista" style={{ marginTop: 8 }}>
              <li><span className="kx-mut">Última notícia</span> {haQuanto(m.visto_em)}</li>
              {m.cpu && <li><span className="kx-mut">CPU</span> {m.cpu}</li>}
              {m.ramTotal != null && <li><span className="kx-mut">Memória</span> {m.ramLivre ?? "?"} GB livres de {m.ramTotal} GB</li>}
              {m.discoLivre != null && <li><span className="kx-mut">Disco</span> {m.discoLivre} GB livres</li>}
              {m.modelos && m.modelos.length > 0 && <li><span className="kx-mut">IAs locais</span> {m.modelos.slice(0, 3).join(", ")}</li>}
            </ul>
          </Bloco>
        ))}
        {erro && <p className="kx-mut">{erro}</p>}
        {d && !lista.length && <p className="kx-mut" style={{ gridColumn: "1/3" }}>Nenhum PC mandou sinal ainda. Eles aparecem aqui quando o Operário estiver instalado neles.</p>}
      </div>
    </div>
  );
}
