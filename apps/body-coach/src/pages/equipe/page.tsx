import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { entrarParceiro, minhaEquipe, NOME_PARTE, sairParceiro, type MinhaEquipe, type Parte } from '@/lib/coach/profissionais';
import { esquecerPapel } from '@/lib/papelCoach';

// Minha equipe (aluno): o coach principal e, se quiser, um segundo profissional (nutricionista ou personal)
// que cuida de uma parte. Cada um mexe só na sua parte; o aluno conversa com os dois.
export default function EquipePage() {
  const [e, setE] = useState<MinhaEquipe | null>(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [codigo, setCodigo] = useState('');
  const [parte, setParte] = useState<Parte>('dieta');
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => minhaEquipe().then(setE).catch((x: Error) => setErro(x.message));
  useEffect(() => { void carregar(); }, []);

  const entrar = async () => {
    setOcupado(true); setErro(''); setOk('');
    try {
      const r = await entrarParceiro(codigo.trim(), parte);
      esquecerPapel();
      setOk(`Pronto! ${r.parceiro.nome} agora cuida da sua ${parte === 'dieta' ? 'alimentação' : 'parte de treino'}. Vocês já podem conversar.`);
      setCodigo('');
      await carregar();
    } catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };
  const sair = async () => {
    if (!e?.parceiro || !window.confirm(`Tirar ${e.parceiro.nome} da sua equipe?`)) return;
    setOcupado(true); setErro(''); setOk('');
    try { await sairParceiro(); esquecerPapel(); setOk('Pronto. O seu coach volta a cuidar de tudo.'); await carregar(); }
    catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };

  const parteDoCoach = e?.parceiro ? (e.parceiro.parte === 'dieta' ? 'Treino' : 'Alimentação') : 'Treino e alimentação';
  return (
    <div className="mx-auto max-w-md space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Minha equipe</h1>
        <p className="mt-1 text-sm text-foreground-600">Quem cuida de você. Você pode ter o seu coach e mais um profissional (nutricionista ou personal), cada um na sua parte.</p>
      </header>
      {ok && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{ok}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {!e && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}

      {e && !e.coach && (
        <Card padding="p-5"><p className="text-sm text-foreground-600">Você ainda não está na equipe de um coach. Abra a <Link to="/chat" className="font-semibold text-primary-600">Conversa</Link> e digite o código que ele passou.</p></Card>
      )}

      {e?.coach && (
        <ul className="space-y-3" data-testid="minha-equipe">
          <Pessoa uid={e.coach.uid} nome={e.coach.nome} foto={e.coach.foto} papel="Coach principal" parte={parteDoCoach} />
          {e.parceiro && <Pessoa uid={e.parceiro.uid} nome={e.parceiro.nome} foto={e.parceiro.foto} papel={e.parceiro.parte === 'dieta' ? 'Nutricionista' : 'Personal'} parte={NOME_PARTE[e.parceiro.parte]} onTirar={() => void sair()} ocupado={ocupado} />}
        </ul>
      )}

      {e?.coach && !e.parceiro && (
        <Card padding="p-5">
          <h2 className="font-heading text-base font-semibold text-foreground-950"><i className="ri-user-add-line mr-1 text-primary-600"></i>Adicionar um profissional</h2>
          <p className="mt-1 text-sm text-foreground-600">Tem nutricionista ou personal além do seu coach? Peça o código dele (fica na Conversa dele) e escolha do que ele cuida.</p>
          <input value={codigo} onChange={(x) => setCodigo(x.target.value.toUpperCase())} maxLength={10} placeholder="Ex.: K7PQ2M" aria-label="Código do profissional" className="mt-3 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-3 text-center text-lg font-bold tracking-widest outline-none focus:border-primary-300" />
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-foreground-800">Ele cuida da minha:</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['dieta', 'treino'] as const).map((p) => (
                <label key={p} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${parte === p ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-background-200 text-foreground-700'}`}>
                  <input type="radio" name="parte" value={p} checked={parte === p} onChange={() => setParte(p)} className="sr-only" />
                  <i className={p === 'dieta' ? 'ri-restaurant-line' : 'ri-run-line'}></i>{NOME_PARTE[p]}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => void entrar()} disabled={ocupado || codigo.trim().length < 4} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-40">Adicionar à minha equipe</button>
        </Card>
      )}
    </div>
  );
}

function Pessoa({ uid, nome, foto, papel, parte, onTirar, ocupado }: { uid: string; nome: string; foto: string; papel: string; parte: string; onTirar?: () => void; ocupado?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-4">
      {foto ? <img src={foto} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line text-xl"></i></span>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground-950">{nome}</p>
        <p className="text-xs text-foreground-500">{papel} · cuida de: <strong className="text-foreground-700">{parte}</strong></p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Link to={`/chat?com=${uid}`} className="rounded-lg border border-background-200 px-2.5 py-1.5 text-xs font-semibold text-foreground-700">Conversar</Link>
        {onTirar && <button type="button" onClick={onTirar} disabled={ocupado} className="text-[11px] font-semibold text-red-600">Tirar</button>}
      </div>
    </li>
  );
}
