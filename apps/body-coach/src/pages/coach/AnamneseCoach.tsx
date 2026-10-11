import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { anamneseDoCoach, novaPergunta, PERGUNTAS_PRONTAS, salvarAnamnese, type Pergunta, type TipoPergunta } from '@/lib/coach/equipe';

const campo = 'w-full rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300';
const TIPOS: { id: TipoPergunta; nome: string }[] = [
  { id: 'texto', nome: 'Resposta escrita' }, { id: 'simnao', nome: 'Sim ou não' }, { id: 'opcoes', nome: 'Escolher uma opção' }, { id: 'numero', nome: 'Número' },
];

// O coach monta as perguntas que todo aluno novo responde ao entrar na equipe (e quem já está, responde na próxima vez que abrir o app).
export default function AnamneseCoach() {
  const [titulo, setTitulo] = useState('Anamnese');
  const [perguntas, setPerguntas] = useState<Pergunta[] | null>(null);
  const [tinha, setTinha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    anamneseDoCoach().then((a) => { setPerguntas(a?.perguntas ?? []); setTitulo(a?.titulo || 'Anamnese'); setTinha(!!a); }).catch((e: Error) => setErro(e.message));
  }, []);

  const mudar = (i: number, x: Partial<Pergunta>) => setPerguntas((l) => (l ?? []).map((p, k) => (k === i ? { ...p, ...x } : p)));
  const mover = (i: number, para: number) => setPerguntas((l) => {
    const v = (l ?? []).slice();
    if (para < 0 || para >= v.length) return v;
    const [p] = v.splice(i, 1);
    v.splice(para, 0, p);
    return v;
  });
  const salvar = async (lista: Pergunta[]) => {
    setSalvando(true); setErro(''); setMsg('');
    try {
      const r = await salvarAnamnese(titulo, lista);
      setPerguntas(r.anamnese?.perguntas ?? []);
      setTinha(!!r.anamnese);
      setMsg(r.anamnese ? `Salva! Os alunos respondem ao abrir o app (${r.anamnese.perguntas.length} perguntas).` : 'Anamnese desligada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/alunos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Meus alunos</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Minha anamnese</h1>
        <p className="mt-1 text-sm text-foreground-600">As suas perguntas para todo aluno. Ele responde ao entrar na sua equipe e você vê as respostas na ficha dele. Se mudar as perguntas, todos respondem de novo.</p>
      </header>
      {msg && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{msg}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {perguntas == null && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}

      {perguntas && perguntas.length === 0 && (
        <div className="space-y-2" data-testid="anamnese-vazia">
          <button type="button" onClick={() => setPerguntas(PERGUNTAS_PRONTAS())} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 dark:text-foreground-950">
            <i className="ri-magic-line mr-1"></i>Começar com 12 perguntas prontas
          </button>
          <p className="text-center text-[11px] text-foreground-500">Triagem de saúde (PAR-Q), rotina e alimentação. Você muda o que quiser.</p>
          <button type="button" onClick={() => setPerguntas([novaPergunta()])} className="w-full rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-semibold text-foreground-700">
            <i className="ri-edit-2-line mr-1"></i>Escrever do zero
          </button>
        </div>
      )}

      {perguntas && perguntas.length > 0 && (
        <>
          <label className="block text-xs font-semibold text-foreground-600">Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} className={`${campo} mt-1`} />
          </label>
          <ol className="space-y-3">
            {perguntas.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="anamnese-pergunta">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-bold text-foreground-400">{i + 1}.</span>
                  <textarea value={p.texto} onChange={(e) => mudar(i, { texto: e.target.value })} rows={2} maxLength={200} placeholder="Escreva a pergunta" aria-label={`Pergunta ${i + 1}`} className={campo} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={p.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as TipoPergunta, opcoes: e.target.value === 'opcoes' && p.opcoes.length < 2 ? ['', ''] : p.opcoes })} aria-label={`Tipo da pergunta ${i + 1}`} className={`${campo} w-auto flex-1`}>
                    {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs font-semibold text-foreground-600">
                    <input type="checkbox" checked={p.obrigatoria} onChange={(e) => mudar(i, { obrigatoria: e.target.checked })} className="h-4 w-4 accent-primary-500" />Obrigatória
                  </label>
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Subir pergunta ${i + 1}`} className="rounded p-1 text-foreground-600 disabled:opacity-30"><i className="ri-arrow-up-line"></i></button>
                    <button type="button" onClick={() => mover(i, i + 1)} disabled={i === perguntas.length - 1} aria-label={`Descer pergunta ${i + 1}`} className="rounded p-1 text-foreground-600 disabled:opacity-30"><i className="ri-arrow-down-line"></i></button>
                    <button type="button" onClick={() => setPerguntas(perguntas.filter((_, k) => k !== i))} aria-label={`Tirar pergunta ${i + 1}`} className="rounded p-1 text-red-600"><i className="ri-delete-bin-line"></i></button>
                  </div>
                </div>
                {p.tipo === 'opcoes' && (
                  <div className="mt-2 space-y-1.5 pl-5">
                    {p.opcoes.map((o, k) => (
                      <div key={k} className="flex gap-1.5">
                        <input value={o} onChange={(e) => mudar(i, { opcoes: p.opcoes.map((x, j) => (j === k ? e.target.value : x)) })} maxLength={40} placeholder={`Opção ${k + 1}`} aria-label={`Opção ${k + 1} da pergunta ${i + 1}`} className={campo} />
                        <button type="button" onClick={() => mudar(i, { opcoes: p.opcoes.filter((_, j) => j !== k) })} aria-label={`Tirar opção ${k + 1}`} className="px-1 text-foreground-400"><i className="ri-close-line"></i></button>
                      </div>
                    ))}
                    {p.opcoes.length < 8 && <button type="button" onClick={() => mudar(i, { opcoes: [...p.opcoes, ''] })} className="text-xs font-semibold text-primary-700"><i className="ri-add-line"></i> Opção</button>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {perguntas.length < 30 && (
            <button type="button" onClick={() => setPerguntas([...perguntas, novaPergunta()])} className="w-full rounded-xl border border-dashed border-primary-300 px-4 py-2.5 text-sm font-semibold text-primary-700">
              <i className="ri-add-line mr-1"></i>Adicionar pergunta
            </button>
          )}
          <button type="button" disabled={salvando} onClick={() => void salvar(perguntas)} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
            <i className={salvando ? 'ri-loader-4-line mr-1 animate-spin' : 'ri-save-3-line mr-1'}></i>{salvando ? 'Salvando...' : 'Salvar anamnese'}
          </button>
          {tinha && <button type="button" onClick={() => { if (window.confirm('Desligar a anamnese? Os alunos param de ver as perguntas.')) void salvar([]); }} className="w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Desligar anamnese</button>}
        </>
      )}
    </div>
  );
}
