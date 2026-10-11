import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apagarPrograma, linkDaLoja, listarProgramas, salvarPrograma, type Programa } from '@/lib/coach/negocio';
import { listarModelos, type ModeloResumo } from '@/lib/coach/equipe';
import { reais } from '@/lib/ferramentas/pix';

const campo = 'w-full rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300';
const VAZIO: Partial<Programa> = { titulo: '', descricao: '', preco: 0, semanas: 8, ficha: '', dieta: null, ativo: true };

// Programas à venda: ficha (e dieta) de um modelo, com preço. O comprador paga por Pix direto ao coach.
export default function Programas() {
  const [lista, setLista] = useState<Programa[] | null>(null);
  const [codigo, setCodigo] = useState('');
  const [recebePix, setRecebePix] = useState(true);
  const [modelos, setModelos] = useState<ModeloResumo[]>([]);
  const [editando, setEditando] = useState<Partial<Programa> | null>(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => listarProgramas().then((r) => { setLista(r.programas.filter((p) => !p.apagado)); setCodigo(r.codigo); setRecebePix(r.recebePix); }).catch((e: Error) => setErro(e.message)), []);
  useEffect(() => { void carregar(); listarModelos().then(setModelos).catch(() => undefined); }, [carregar]);

  const fichas = modelos.filter((m) => m.tipo === 'ficha');
  const dietas = modelos.filter((m) => m.tipo === 'dieta');
  const link = codigo ? linkDaLoja(codigo) : '';
  const salvar = async () => {
    if (!editando) return;
    setSalvando(true); setErro('');
    try { await salvarPrograma(editando); setEditando(null); setMsg('Programa salvo. Ele já aparece na sua loja.'); await carregar(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/financeiro" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Financeiro</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Programas à venda</h1>
        <p className="mt-1 text-sm text-foreground-600">Venda um programa pronto (ficha e dieta dos seus modelos). Quem compra paga por Pix direto para você; ao confirmar, o programa cai no app da pessoa e ela entra na sua equipe.</p>
      </header>
      {msg && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{msg}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {!recebePix && <p className="rounded-xl bg-secondary-50 p-3 text-sm text-secondary-900">Para vender, cadastre a sua chave Pix em <Link to="/ferramentas/mensalidade" className="font-semibold underline">Mensalidade</Link>.</p>}

      {link && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-3" data-testid="link-loja">
          <p className="text-xs font-semibold text-foreground-600">Link da sua loja (mande no Instagram, WhatsApp, bio)</p>
          <p className="mt-1 break-all text-sm font-semibold text-primary-800">{link}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold">
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setMsg('Link copiado.')).catch(() => undefined); }} className="rounded-lg bg-primary-500 px-2 py-2 text-white">Copiar</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Conheça os meus programas de treino: ${link}`)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-background-200 bg-background-50 px-2 py-2 text-center text-foreground-700">WhatsApp</a>
            <Link to={`/loja/${codigo}`} className="rounded-lg border border-background-200 bg-background-50 px-2 py-2 text-center text-foreground-700">Ver loja</Link>
          </div>
        </div>
      )}

      {!editando && (
        <button type="button" disabled={!fichas.length} onClick={() => { setEditando({ ...VAZIO, ficha: fichas[0]?.id }); setMsg(''); }} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950"><i className="ri-add-line mr-1"></i>Novo programa</button>
      )}
      {!fichas.length && <p className="text-center text-xs text-foreground-500">Primeiro crie uma ficha modelo em <Link to="/coach/modelos" className="font-semibold text-primary-600">Modelos</Link>.</p>}

      {editando && (
        <div className="space-y-2 rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="programa-form">
          <label className="block text-xs font-semibold text-foreground-600">Nome do programa<input value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} maxLength={60} placeholder="ex.: Verão em 8 semanas" className={`${campo} mt-1`} /></label>
          <label className="block text-xs font-semibold text-foreground-600">Descrição<textarea value={editando.descricao} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} maxLength={600} rows={3} placeholder="Para quem é, o que vem, resultado esperado" className={`${campo} mt-1`} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-foreground-600">Preço (R$)<input type="number" inputMode="decimal" min={1} step="0.01" value={editando.preco || ''} onChange={(e) => setEditando({ ...editando, preco: Number(e.target.value) })} className={`${campo} mt-1`} /></label>
            <label className="text-xs font-semibold text-foreground-600">Duração (semanas)<input type="number" min={1} max={52} value={editando.semanas} onChange={(e) => setEditando({ ...editando, semanas: Number(e.target.value) })} className={`${campo} mt-1`} /></label>
          </div>
          <label className="block text-xs font-semibold text-foreground-600">Ficha de treino<select value={editando.ficha} onChange={(e) => setEditando({ ...editando, ficha: e.target.value })} className={`${campo} mt-1`}>{fichas.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.resumo})</option>)}</select></label>
          <label className="block text-xs font-semibold text-foreground-600">Dieta (opcional)<select value={editando.dieta ?? ''} onChange={(e) => setEditando({ ...editando, dieta: e.target.value || null })} className={`${campo} mt-1`}><option value="">Sem dieta</option>{dietas.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.resumo})</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm text-foreground-800"><input type="checkbox" checked={editando.ativo !== false} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} className="h-4 w-4 accent-primary-500" />À venda na loja</label>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" disabled={salvando} onClick={() => void salvar()} className="rounded-xl bg-primary-500 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar programa'}</button>
            <button type="button" onClick={() => setEditando(null)} className="rounded-xl border border-background-200 px-3 py-2.5 text-sm font-semibold text-foreground-700">Cancelar</button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {lista?.map((p) => (
          <li key={p.id} className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="programa">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground-950">{p.titulo}</p>
                <p className="text-xs text-foreground-500">{reais(p.preco)} · {p.semanas} semanas · {p.vendas || 0} venda{p.vendas === 1 ? '' : 's'}{p.ativo ? '' : ' · fora da loja'}</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" onClick={() => { setEditando(p); setMsg(''); }} className="text-primary-700">Editar</button>
                <button type="button" onClick={() => { if (window.confirm(`Tirar “${p.titulo}” da loja?`)) void apagarPrograma(p.id).then(carregar); }} className="text-red-600">Apagar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
