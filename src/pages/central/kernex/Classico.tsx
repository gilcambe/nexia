import { Component, useEffect, useState, type ReactNode } from "react";
import { useCentral, PARTES } from "../api";
import type { Dados, Parte } from "../api";
import OQueFalta from "../OQueFalta";
import Clientes from "../Clientes";
import Dinheiro from "../Dinheiro";
import Divulgar from "../Divulgar";
import CortexAba from "../CortexAba";
import PrsAba from "../PrsAba";
import Sistema from "../Sistema";

// C2-E (13/11, dono: "antes tinha diversas funções que sumiram... poderiam ter continuado"): as telas da Central de antes
// rodam aqui dentro, com os mesmos dados e botões. Nada some: só ficaram organizadas no menu novo.
export type Classica = "falta" | "cortex" | "entregas" | "tenants" | "dinheiro" | "divulgar" | "iainfra";
const PRECISA: Record<Classica, Parte[]> = {
  falta: [], cortex: ["cortex"], entregas: ["cortex"], tenants: ["lista", "saude", "clientes", "banco"], dinheiro: ["dinheiro"], divulgar: ["divulga"],
  iainfra: PARTES.filter((p) => !["dinheiro", "divulga", "leads"].includes(p)),
};
// Se uma tela antiga quebrar, só ela mostra o aviso; o menu e o resto da Central continuam.
class Protege extends Component<{ children: ReactNode }, { erro: string | null }> {
  state = { erro: null as string | null };
  static getDerivedStateFromError(e: Error) { return { erro: String(e?.message || e) }; }
  render() { return this.state.erro ? <div role="alert" className="kx-serve" data-testid="kx-classico-erro">Esta parte teve um erro: {this.state.erro.slice(0, 300)}. Toque em outra tela no menu ou recarregue.</div> : this.props.children; }
}
let cache: { d: Dados; erros: Partial<Record<Parte, string>> } = { d: {}, erros: {} };

export default function Classico({ qual }: { qual: Classica }) {
  const { buscar } = useCentral();
  const [d, setD] = useState<Dados>(cache.d);
  const [erros, setErros] = useState(cache.erros);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    const falta = PRECISA[qual].filter((p) => cache.d[p] === undefined);
    if (!falta.length) return;
    let vivo = true; setCarregando(true);
    const fila = [...falta];
    const trab = async () => {
      for (let p = fila.shift(); p; p = fila.shift()) {
        const parte = p;
        await buscar(parte).then((v) => { cache = { ...cache, d: { ...cache.d, [parte]: v } }; if (vivo) setD(cache.d); })
          .catch((e: Error) => { cache = { ...cache, erros: { ...cache.erros, [parte]: e.message } }; if (vivo) setErros(cache.erros); });
      }
    };
    Promise.all([trab(), trab(), trab()]).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [qual, buscar]);
  return (
    <Protege key={qual}><div className="kx-classico" data-testid={"kx-classico-" + qual}>
      {carregando && <p className="kx-mut" style={{ margin: "0 0 8px" }}>Carregando os dados…</p>}
      {qual === "falta" && <OQueFalta />}
      {qual === "cortex" && <CortexAba d={d} erro={erros.cortex} />}
      {qual === "entregas" && <PrsAba d={d} erro={erros.cortex} />}
      {qual === "tenants" && <Clientes d={d} erros={erros} />}
      {qual === "dinheiro" && <Dinheiro d={d} erro={erros.dinheiro} />}
      {qual === "divulgar" && <Divulgar d={d} erro={erros.divulga} />}
      {qual === "iainfra" && <Sistema d={d} erros={erros} />}
    </div></Protege>
  );
}
