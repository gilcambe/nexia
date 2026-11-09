import { useEffect, useState } from "react";
import { useCentral, type Maquina } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import { haQuanto } from "./regras";

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
      <Kpi cor="vd" icone="pc" valor={fonte ? ligadas : null} rotulo="Máquinas ligadas" sub={fonte ? `de ${lista.length}` : "sem sinal dos PCs ainda"} />
      <Kpi cor="az" icone="pausa" valor={fonte ? lista.length - ligadas : null} rotulo="Desligadas" />
      <Kpi cor="rx" icone="ia" valor={fonte ? modelos.size : null} rotulo="IAs locais nos PCs" />
      <Kpi cor="lj" icone="relogio" valor={fonte && ultimo ? haQuanto(ultimo) : null} rotulo="Último sinal" />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {(lista.length ? lista : [{ nome: "PC 1" } as Maquina, { nome: "PC 2" } as Maquina]).slice(0, 4).map((m) => (
        <Bloco key={m.nome} icone="pc" corIcone="#34d399" titulo={m.nome} ajuda="Ligado ou desligado, memória livre e IAs locais deste PC." fonte={lista.length ? fonte : null} atualizadoEm={d?.em || null}>
          <p className="kx-sinal"><span className="kx-bola" style={{ background: m.online ? "#22c55e" : "#64748b" }} /><b>{m.online ? "Ligado" : "Desligado"}</b></p>
          <ul className="kx-lista" style={{ marginTop: 8 }}>
            <li><span className="kx-mut">Última notícia</span> {haQuanto(m.visto_em)}</li>
            {m.cpu && <li><span className="kx-mut">CPU</span> {m.cpu}</li>}
            {m.ramTotal != null && <li><span className="kx-mut">Memória</span> {m.ramLivre ?? "?"} GB livres de {m.ramTotal} GB</li>}
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
