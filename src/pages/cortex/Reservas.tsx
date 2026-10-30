import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";
import { useCentral, TarefaGratis } from "@/pages/central/api";

// #802: contas de reserva do Cortex (Conexões do Cortex e aba Cortex da Central). Mostra "ligada" ou "não ligada"
// só pelo NOME do segredo no GitHub (o valor nunca sai de lá), com o passo a passo de 3 linhas para ligar.
interface Conta { id: string; nome: string; gratis: boolean; ligada: boolean | null; segredo?: string; passos: string[] }
interface Resposta { semAcesso: boolean; contas: Conta[]; semCota: { numero: number; titulo: string; link: string; quando?: string }[] }

export default function ContasReserva() {
  const { getToken } = useAuth();
  const { enviarTarefasParaContas } = useCentral();
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

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

  const handleEnviarContas = async () => {
    if (!d || !d.semCota || d.semCota.length === 0) return;
    setEnviando(true);
    setErro("");
    setMensagemSucesso("");
    try {
      const tarefasFormatadas: TarefaGratis[] = d.semCota.map((t) => ({
        numero: t.numero,
        titulo: t.titulo,
        link: t.link,
        quando: t.quando || new Date().toISOString(),
        gratis: true,
      }));
      const res = await enviarTarefasParaContas(tarefasFormatadas);
      setMensagemSucesso(res.mensagem || "Mandei todas as tarefas para as contas ajudarem você a resolver.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--cx-line,#26262f)] p-4" data-testid="cx-reservas">
      <p className="font-medium">Contas de reserva</p>
      <p className="text-sm opacity-70 mt-1">Entram quando as IAs do dia acabam. Só as grátis devem ficar ligadas.</p>
      {erro && <p className="text-sm text-red-400 mt-2" role="alert">{erro}</p>}
      {mensagemSucesso && <p className="text-sm text-emerald-400 mt-2">{mensagemSucesso}</p>}
      {!d && !erro && <p className="text-sm opacity-70 mt-2">Verificando…</p>}
      {d?.semAcesso && <p className="text-sm mt-2">O token da Central não pode ler os nomes dos segredos. Dê ao NEXIA_JOBS_TOKEN a permissão "Secrets: Read".</p>}
      {d && d.semCota.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-amber-400" data-testid="cx-reserva-sem-cota">
            ⚠️ {d.semCota.length} tarefa(s) esperando a cota de amanhã: {d.semCota.map((t) => `#${t.numero}`).join(", ")}.
          </p>
          <button
            type="button"
            disabled={enviando}
            onClick={() => void handleEnviarContas()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Mandar tarefas para as contas ajudarem"}
          </button>
        </div>
      )}
      <ul className="mt-3 space-y-2">{d?.contas.map((c) => (
        <li key={c.id} className="rounded-xl border border-[var(--cx-line,#26262f)] px-3 py-2">
          <button className="w-full flex items-center gap-2 text-left text-sm" onClick={() => setAberta(aberta === c.id ? "" : c.id)}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.ligada === null ? "bg-gray-500" : c.ligada ? "bg-emerald-400" : "bg-red-500"}`} />
            <span className="flex-1">{c.nome}{!c.gratis && " · pago"}</span>
            <span className="opacity-70">{c.ligada === null ? "?" : c.ligada ? "ligada" : "não ligada"}</span>
          </button>
          {aberta === c.id && <ol className="list-decimal ml-5 mt-2 text-sm opacity-80 space-y-1">{c.passos.map((p) => <li key={p}>{p}</li>)}</ol>}
        </li>
      ))}</ul>
    </div>
  );
}
