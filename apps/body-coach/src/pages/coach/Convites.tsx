import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { apagarConvite, importarConvites, lerPlanilha, marcarEnviado, verConvites, type Convite } from '@/lib/coach/profissionais';

// Importar alunos de uma planilha e convidar todos: colar do Excel/Google Planilhas (ou abrir um .csv),
// e mandar o link por WhatsApp (um toque por aluno) ou por e-mail (todos de uma vez). Mostra quem já entrou.
export default function Convites() {
  const [dados, setDados] = useState<{ convites: Convite[]; codigo: string; coach: string } | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => verConvites().then(setDados).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);

  const lidos = useMemo(() => lerPlanilha(texto), [texto]);
  const base = dados ? `${window.location.origin}${import.meta.env.BASE_URL}convite/${dados.codigo}` : '';
  const recado = (nome: string, link: string) => `${nome ? `Oi ${nome.split(' ')[0]}!` : 'Oi, tudo bem?'} Aqui é ${dados?.coach ?? 'o seu coach'}. Criei o seu acesso ao meu app de treino (é grátis). Toque no link para entrar na minha equipe: ${link}`;
  const faltam = (dados?.convites ?? []).filter((c) => !c.entrou);
  const proximoZap = faltam.find((c) => c.telefone && !c.enviado);
  const emails = faltam.filter((c) => c.email);

  const abrirArquivo = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(csv|txt|tsv)$/i.test(f.name)) { setErro('Use um arquivo .csv (no Excel: Salvar como > CSV) ou copie e cole as colunas.'); return; }
    const r = new FileReader();
    r.onload = () => { setErro(''); setTexto(String(r.result ?? '')); };
    r.readAsText(f);
  };
  const importar = async () => {
    setOcupado(true); setErro(''); setOk('');
    try {
      const r = await importarConvites(lidos);
      setOk(`${r.importados} aluno${r.importados === 1 ? '' : 's'} na lista.${r.repetidos ? ` ${r.repetidos} já estava${r.repetidos === 1 ? '' : 'm'} lá.` : ''}${r.invalidos ? ` ${r.invalidos} sem e-mail ou telefone.` : ''}`);
      setTexto('');
      await carregar();
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const zap = async (c: Convite) => {
    window.open(`https://wa.me/${c.telefone}?text=${encodeURIComponent(recado(c.nome, `${base}?c=${c.id}`))}`, '_blank', 'noopener');
    await marcarEnviado([c.id], 'whatsapp').catch(() => {});
    await carregar();
  };
  const email = async (lista: Convite[]) => {
    // e-mail em grupos de 40 (cópia oculta), para caber no aplicativo de e-mail do celular
    const grupo = lista.slice(0, 40);
    const assunto = `Seu acesso ao app de treino de ${dados?.coach ?? 'seu coach'}`;
    const corpo = recado(grupo.length === 1 ? grupo[0].nome : '', grupo.length === 1 ? `${base}?c=${grupo[0].id}` : base);
    window.location.href = `mailto:?bcc=${grupo.map((c) => encodeURIComponent(c.email)).join(',')}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    await marcarEnviado(grupo.map((c) => c.id), 'email').catch(() => {});
    await carregar();
  };
  const apagar = async (c: Convite) => {
    if (!window.confirm(`Tirar ${c.nome} da lista de convites?`)) return;
    try { await apagarConvite(c.id); await carregar(); } catch (e) { setErro((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/alunos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Meus alunos</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Convidar alunos</h1>
        <p className="mt-1 text-sm text-foreground-600">Traga a sua lista de alunos de uma planilha e mande o convite para todos. Quem entrar fica marcado aqui.</p>
      </header>
      {ok && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{ok}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      <Card padding="p-5">
        <h2 className="font-heading text-base font-semibold text-foreground-950">1. Trazer a planilha</h2>
        <p className="mt-1 text-sm text-foreground-600">No Excel ou Google Planilhas, selecione as colunas <strong>nome</strong>, <strong>e-mail</strong> e <strong>telefone</strong>, copie e cole aqui. Também serve um arquivo .csv.</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} aria-label="Colar planilha" placeholder={'Maria Silva\tmaria@email.com\t(11) 98888-7777\nJoão Souza\tjoao@email.com\t(21) 97777-6666'} className="mt-3 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 font-mono text-xs outline-none focus:border-primary-300" />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700">
          <i className="ri-file-excel-2-line"></i>Abrir arquivo .csv
          <input type="file" accept=".csv,.txt,.tsv,text/csv" className="sr-only" data-testid="convites-arquivo" onChange={(e) => abrirArquivo(e.target.files?.[0])} />
        </label>
        {texto.trim() && (
          <div className="mt-3 space-y-2" data-testid="convites-previa">
            <p className="text-sm font-medium text-foreground-800">{lidos.length ? `Encontrei ${lidos.length} aluno${lidos.length === 1 ? '' : 's'}:` : 'Não achei nome com e-mail ou telefone. Confira as colunas.'}</p>
            {lidos.length > 0 && (
              <ul className="max-h-48 divide-y divide-background-200 overflow-y-auto rounded-lg border border-background-200 text-xs">
                {lidos.slice(0, 50).map((l, i) => <li key={i} className="flex gap-2 px-3 py-1.5"><span className="flex-1 truncate font-semibold text-foreground-900">{l.nome}</span><span className="truncate text-foreground-500">{l.email || l.telefone}</span></li>)}
              </ul>
            )}
            <button type="button" onClick={() => void importar()} disabled={ocupado || !lidos.length} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-40">Colocar {lidos.length} na lista de convites</button>
          </div>
        )}
      </Card>

      {dados && dados.convites.length > 0 && (
        <Card padding="p-5">
          <h2 className="font-heading text-base font-semibold text-foreground-950">2. Mandar o convite</h2>
          <p className="mt-1 text-sm text-foreground-600" data-testid="convites-contagem"><strong className="text-accent-700">{dados.convites.length - faltam.length} {dados.convites.length - faltam.length === 1 ? 'entrou' : 'entraram'}</strong> · {faltam.length} ainda não</p>
          <div className="mt-3 grid gap-2">
            {proximoZap && (
              <button type="button" onClick={() => void zap(proximoZap)} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white">
                <i className="ri-whatsapp-line text-lg"></i>WhatsApp: mandar para {proximoZap.nome.split(' ')[0]} ({faltam.filter((c) => c.telefone && !c.enviado).length} na fila)
              </button>
            )}
            {emails.length > 0 && (
              <button type="button" onClick={() => void email(emails)} className="flex items-center justify-center gap-2 rounded-xl border border-primary-300 px-4 py-3 text-sm font-semibold text-primary-700">
                <i className="ri-mail-send-line text-lg"></i>E-mail para {Math.min(40, emails.length)} de uma vez
              </button>
            )}
          </div>
          <ul className="mt-4 divide-y divide-background-200" data-testid="convites-lista">
            {dados.convites.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-900">{c.nome}</p>
                  <p className="truncate text-xs text-foreground-500">{[c.email, c.telefone && `+${c.telefone}`].filter(Boolean).join(' · ')}</p>
                </div>
                {c.entrou ? <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-800">✅ entrou</span>
                  : c.enviado ? <span className="rounded-full bg-secondary-50 px-2 py-0.5 text-xs font-semibold text-secondary-800">enviado</span>
                    : <span className="rounded-full bg-background-100 px-2 py-0.5 text-xs font-semibold text-foreground-600">na fila</span>}
                {!c.entrou && c.telefone && <button type="button" onClick={() => void zap(c)} aria-label={`WhatsApp para ${c.nome}`} className="flex h-8 w-8 items-center justify-center rounded-full text-[#128C7E]"><i className="ri-whatsapp-line text-lg"></i></button>}
                {!c.entrou && c.email && <button type="button" onClick={() => void email([c])} aria-label={`E-mail para ${c.nome}`} className="flex h-8 w-8 items-center justify-center rounded-full text-primary-600"><i className="ri-mail-line text-lg"></i></button>}
                <button type="button" onClick={() => void apagar(c)} aria-label={`Tirar ${c.nome}`} className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-400"><i className="ri-delete-bin-line"></i></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dados && <LinkParceiro base={base} />}
    </div>
  );
}

// Link para atender alunos de outro coach como parceiro (nutricionista cuida da alimentação, personal do treino).
function LinkParceiro({ base }: { base: string }) {
  const [parte, setParte] = useState<'dieta' | 'treino'>('dieta');
  const [msg, setMsg] = useState('');
  const link = `${base}?parte=${parte}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setMsg('Link copiado!'); } catch { setMsg('Segure o link e copie.'); } };
  return (
    <Card padding="p-5">
      <h2 className="font-heading text-base font-semibold text-foreground-950"><i className="ri-team-line mr-1 text-primary-600"></i>Atender junto com outro profissional</h2>
      <p className="mt-1 text-sm text-foreground-600">É nutricionista ou personal e o aluno já tem outro coach aqui? Mande este link: ele continua com o coach dele e você cuida só da sua parte.</p>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1">
        {(['dieta', 'treino'] as const).map((p) => (
          <button key={p} type="button" aria-pressed={parte === p} onClick={() => { setParte(p); setMsg(''); }} className={`rounded-lg py-1.5 text-xs font-semibold ${parte === p ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{p === 'dieta' ? 'Cuido da alimentação' : 'Cuido do treino'}</button>
        ))}
      </div>
      <p className="mt-3 break-all rounded-lg border border-background-200 bg-background-100 px-3 py-2 text-xs text-foreground-800" aria-label="Link de parceiro">{link}</p>
      <button type="button" onClick={() => void copiar()} className="mt-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50"><i className="ri-file-copy-line mr-1"></i>Copiar link</button>
      {msg && <span role="status" className="ml-2 text-sm text-primary-700">{msg}</span>}
    </Card>
  );
}
