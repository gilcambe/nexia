import { useEffect, useState } from "react";
import { useCentral } from "./api";
import { Cartao, Botao } from "./ui";

// Criar cliente SEM PR (regra dos 20 projetos em 1 hora): grava o cadastro no banco e mostra o código de 1º acesso UMA vez.
type Tipo = "agenda" | "locacao" | "viagem" | "nutri";
const TIPOS: { id: Tipo; nome: string }[] = [
  { id: "agenda", nome: "Agenda (estética, salão, consultório)" },
  { id: "locacao", nome: "Locação de espaço / eventos" },
  { id: "viagem", nome: "Agência de viagens" },
  { id: "nutri", nome: "Nutricionista (landing + painel)" },
];
type Item = { tipo: Tipo; slug: string; nome: string; ativo: boolean; criado_em: string };
type Resposta = { ok?: boolean; codigo?: string; slug?: string; nome?: string; aviso?: string; error?: string };

const slugDe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function NovoCliente() {
  const { agir } = useCentral();
  const [tipo, setTipo] = useState<Tipo>("agenda");
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [lista, setLista] = useState<Item[]>([]);

  const carregar = async () => {
    try { const r = await agir<{ clientes: Item[] }>({ acao: "cliente-listar" }); setLista(r.clientes || []); } catch { /* lista é opcional */ }
  };
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async () => {
    setEnviando(true); setResp(null);
    try {
      const r = await agir<Resposta>({ acao: "cliente-criar", tipo, nome: nome.trim(), slug: slug || slugDe(nome), whatsapp: whatsapp.replace(/\D/g, "") || undefined });
      setResp(r);
      if (r.ok) { setNome(""); setSlug(""); setWhatsapp(""); void carregar(); }
    } catch (e) { setResp({ error: e instanceof Error ? e.message : "Não deu certo. Tente de novo." }); }
    finally { setEnviando(false); }
  };

  const campo = "w-full rounded-xl border px-3 py-2 text-sm bg-transparent";
  return (
    <Cartao titulo="Novo cliente (sem PR)">
      <p className="text-sm opacity-80 mb-3">Cria o cliente direto no banco: a agenda, a locação, a viagem ou o painel nutri passam a funcionar na hora, sem programar nada.</p>
      <div className="grid gap-2 sm:grid-cols-2" data-testid="novo-cliente">
        <label className="text-sm">Tipo
          <select className={campo} value={tipo} onChange={e => setTipo(e.target.value as Tipo)}>
            {TIPOS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">Nome do cliente
          <input className={campo} value={nome} onChange={e => { setNome(e.target.value); if (!slug) setSlug(""); }} placeholder="Ex.: Espaço Alegria" />
        </label>
        <label className="text-sm">Endereço (vira nome.kernex.com.br)
          <input className={campo} value={slug || slugDe(nome)} onChange={e => setSlug(slugDe(e.target.value))} placeholder="espaco-alegria" />
        </label>
        <label className="text-sm">WhatsApp do cliente (opcional)
          <input className={campo} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5511999990000" inputMode="numeric" />
        </label>
      </div>
      <div className="mt-3"><Botao tipo="forte" onClick={criar} disabled={enviando || nome.trim().length < 3} testid="criar-cliente">{enviando ? "Criando..." : "Criar cliente"}</Botao></div>
      {resp?.ok && (
        <div className="mt-3 rounded-xl border p-3 text-sm" data-testid="codigo-cliente">
          <b>{resp.nome}</b> criado. Código de primeiro acesso: <b className="text-base tracking-wider">{resp.codigo}</b>
          <div className="opacity-80 mt-1">{resp.aviso}</div>
        </div>
      )}
      {resp?.error && <div className="mt-3 text-sm text-red-600">{resp.error}</div>}
      {lista.length > 0 && (
        <div className="mt-4 text-sm">
          <div className="font-semibold mb-1">Criados pela Central ({lista.length})</div>
          <ul className="space-y-1">{lista.map(c => <li key={c.tipo + c.slug}>{c.nome} · {c.tipo} · {c.slug}{c.ativo ? "" : " (inativo)"}</li>)}</ul>
        </div>
      )}
    </Cartao>
  );
}
