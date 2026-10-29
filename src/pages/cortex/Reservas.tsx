import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";
import { Cartao } from "./ui";

// #802: contas de reserva do Cortex (Conexões do Cortex e aba Cortex da Central). Mostra "ligada" ou "não ligada"
// só pelo NOME do segredo no GitHub (o valor nunca sai de lá), com o passo a passo de 3 linhas para ligar.
interface Conta { id: string; nome: string; gratis: boolean; ligada: boolean | null; segredo?: string; passos: string[] }
interface Resposta { semAcesso: boolean; contas: Conta[]; semCota: { numero: number; titulo: string; link: string }[] }

export default function ContasReserva() {
  const { getToken } = useAuth();
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(apiPath("/central") + "?parte=reservas", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (r.ok) setD(j as Resposta); else setErro((j as { error?: string }).error || `Erro ${r.status}`);
      } catch (e) { if (vivo) setErro((e as Error).message); }
    })();
    return () => { vivo = false; };
  }, [getToken]);
  const resumo = !d ? "Verificando…" : `${d.contas.length} conta(s)`;

  return (
    <Cartao titulo="Contas de reserva" icone="chave" resumo={resumo} data-testid="cx-reservas">
      <p className="text-sm opacity-70">Entram quando as IAs do dia acabam. Só as grátis devem ficar ligadas.</p>
      {erro && <p className="text-sm text-red-400 mt-2" role="alert">{erro}</p>}
      {!d && !erro && <p className="text-sm opacity-70 mt-2">Verificando…</p>}
      {d?.semAcesso && <p className="text-sm mt-2">O token da Central não pode ler os nomes dos segredos. Dê ao NEXIA_JOBS_TOKEN a permissão "Secrets: Read".</p>}
      {d && d.semCota.length > 0 && <p className="text-sm text-amber-400 mt-2" data-testid="cx-reserva-sem-cota">⚠️ {d.semCota.length} tarefa(s) esperando a cota de amanhã: {d.semCota.map((t) => `#${t.numero}`).join(", ")}.</p>}
      <ul className="mt-3 space-y-2">{d?.contas.map((c) => (
        <li key={c.id} className="rounded-xl border border-[var(--cx-line,#26262f)] px-3 py-2">
          <button className="w-full flex items-center gap-2 text-left text-sm" onClick={() => setAberta(aberta === c.id ? "" : c.id)}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.ligada === null ? "bg-gray-500" : c.ligada ? "bg-emerald-400" : "bg-red-500"}`} />
            <span className="flex-1">{c.nome}{!c.gratis && " · pago"}</span>
            <span className="opacity-70">{c.ligada === null ? "?" : c.ligada ? "ligada" : "não ligada"}</span>
          </button>
          {aberta === c.id && <ol className="list-decimal ml-5 mt-2 text-sm opacity-80 space-y-1">{c.passos.map((p) => <li key={p}>{p}</li>)}</ol>}
        </li>
      ))}      </ul>
    </Cartao>
  );
}
