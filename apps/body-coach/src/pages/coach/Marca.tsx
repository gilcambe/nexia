import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { aplicarMarca, CORES, corCss, marcaGuardada, reduzirLogo, salvarMarca, verMarca, type Cor } from '@/lib/coach/profissionais';

// Marca do coach: nome, cor e logo aparecem no app de todos os alunos dele (e no dele). Grátis: é só o tema do app.
export default function Marca() {
  const atual = marcaGuardada();
  const [nome, setNome] = useState(atual?.nome ?? '');
  const [cor, setCor] = useState<Cor>(atual?.cor ?? 'laranja');
  const [logo, setLogo] = useState(atual?.logo ?? '');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [bio, setBio] = useState('');
  const [whats, setWhats] = useState('');
  const [codigo, setCodigo] = useState('');
  useEffect(() => { verMarca().then((r) => { setBio(r.bio); setWhats(r.whats); setCodigo(r.codigo); }).catch(() => undefined); }, []);

  const escolherLogo = async (f: File | undefined) => {
    if (!f) return;
    setErro('');
    try { setLogo(await reduzirLogo(f)); } catch (e) { setErro((e as Error).message); }
  };
  const salvar = async () => {
    setOcupado(true); setErro(''); setOk('');
    try {
      const r = await salvarMarca({ nome: nome.trim(), cor, logo, bio: bio.trim(), whats });
      if (r.codigo) setCodigo(r.codigo);
      aplicarMarca(r.marca);
      setOk('Marca salva! Os seus alunos veem na próxima vez que abrirem o app.');
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const voltarPadrao = async () => {
    setNome(''); setCor('laranja'); setLogo('');
    setOcupado(true); setErro(''); setOk('');
    try { await salvarMarca({ nome: '', cor: 'laranja', logo: '' }); aplicarMarca(null); setOk('Voltou para a marca NEXIA.'); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link to="/coach/alunos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Meus alunos</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Minha marca</h1>
        <p className="mt-1 text-sm text-foreground-600">O app dos seus alunos fica com o seu nome, a sua cor e o seu logo.</p>
      </header>
      {ok && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{ok}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {/* Prévia do topo do app do aluno */}
      <div className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="marca-previa">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-400">Como o aluno vê</p>
        <div className="flex items-center gap-2.5">
          {logo ? <img src={logo} alt="Logo escolhido" className="h-10 w-10 rounded-xl object-contain" /> : <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-10 w-10 rounded-xl" />}
          <div className="leading-none">
            <p className="font-heading font-bold text-foreground-950">{nome.trim() || 'NEXIA'}</p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-foreground-400">{nome.trim() ? 'com NEXIA Body Coach' : 'Body Coach AI'}</p>
          </div>
        </div>
        <span className="mt-3 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white" style={{ background: corCss(cor) }}>Iniciar treino</span>
      </div>

      <Card padding="p-5">
        <label className="block text-sm font-medium text-foreground-800" htmlFor="marca-nome">Nome da sua marca</label>
        <input id="marca-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Ex.: Studio Lima" className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />

        <p className="mt-4 text-sm font-medium text-foreground-800">Cor</p>
        <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Cor da marca">
          {CORES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={cor === c.id} aria-label={c.nome} onClick={() => setCor(c.id)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-semibold ${cor === c.id ? 'border-foreground-900 text-foreground-950' : 'border-background-200 text-foreground-600'}`}>
              <span className="h-7 w-7 rounded-full" style={{ background: corCss(c.id) }}></span>{c.nome}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-foreground-800">Logo</p>
        <div className="mt-2 flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-background-200 px-3 py-2 text-sm font-semibold text-foreground-700">
            <i className="ri-image-add-line"></i>{logo ? 'Trocar logo' : 'Escolher logo'}
            <input type="file" accept="image/*" className="sr-only" data-testid="marca-logo" onChange={(e) => void escolherLogo(e.target.files?.[0])} />
          </label>
          {logo && <button type="button" onClick={() => setLogo('')} className="text-sm font-semibold text-red-600">Tirar logo</button>}
        </div>
        <p className="mt-1 text-xs text-foreground-500">Quadrado e com fundo transparente fica melhor. O app reduz sozinho.</p>

        <label className="mt-4 block text-sm font-medium text-foreground-800" htmlFor="marca-bio">Sua bio (aparece na sua página)</label>
        <textarea id="marca-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Ex.: Personal há 8 anos, especialista em emagrecimento." className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />
        <label className="mt-4 block text-sm font-medium text-foreground-800" htmlFor="marca-whats">Seu WhatsApp</label>
        <input id="marca-whats" value={whats} onChange={(e) => setWhats(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={13} placeholder="DDD + número, ex.: 81999998888" className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />

        <button type="button" onClick={() => void salvar()} disabled={ocupado} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: corCss(cor) }}>Salvar minha marca</button>
        {(atual || nome || logo || cor !== 'laranja') && <button type="button" onClick={() => void voltarPadrao()} disabled={ocupado} className="mt-2 w-full text-sm font-semibold text-foreground-500">Voltar para a marca NEXIA</button>}
      </Card>
      {codigo && <Link to={`/loja/${codigo}`} className="block text-center text-sm font-semibold text-primary-600"><i className="ri-external-link-line mr-1"></i>Ver minha página</Link>}
    </div>
  );
}
