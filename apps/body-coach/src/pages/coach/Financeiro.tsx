import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { confirmarVenda, lembrarPagamento, marcarPago, verFinanceiro, type AlunoFin, type Financeiro as Fin } from '@/lib/coach/negocio';
import { codigoPix, nomeMes, reais } from '@/lib/ferramentas/pix';
import { confirmar } from '../../lib/dialogo';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const situacao = (a: AlunoFin) => (a.pago ? 'Pago' : a.avisou ? 'Disse que pagou: confira no banco' : a.dias > 0 ? `Vence em ${a.dias} dia${a.dias > 1 ? 's' : ''}` : a.dias === 0 ? 'Vence hoje' : `Atrasado há ${-a.dias} dia${a.dias < -1 ? 's' : ''}`);

// Financeiro do coach: quanto entrou no mês e nos últimos 12, quem falta pagar (com cobrança no app, no celular e no WhatsApp) e as vendas de programas.
export default function Financeiro() {
  const [f, setF] = useState<Fin | null>(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState('');
  const carregar = useCallback(() => verFinanceiro().then(setF).catch((e: Error) => setErro(e.message)), []);
  useEffect(() => { void carregar(); }, [carregar]);

  const fazer = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(id); setErro(''); setMsg('');
    try { await fn(); setMsg(ok); await carregar(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(''); }
  };

  if (!f) return <p className="text-center text-sm text-foreground-500">{erro || <><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</>}</p>;
  const atual = f.historico[f.historico.length - 1];
  const recebido = atual.mensalidades + atual.vendas;
  const faltam = f.alunos.filter((a) => !a.pago);
  const emAberto = faltam.reduce((s, a) => s + a.valor, 0);
  const atrasados = faltam.filter((a) => a.dias < 0).length;
  const doze = f.historico.reduce((s, m) => s + m.mensalidades + m.vendas, 0);
  const dados = f.historico.map((m) => ({ nome: MES_CURTO[Number(m.mes.slice(5, 7)) - 1], Mensalidades: m.mensalidades, Programas: m.vendas }));
  const whats = (a: AlunoFin) => {
    if (!f.pix) return '';
    const cod = codigoPix({ ...f.pix, valor: a.valor, descricao: `Mensalidade ${f.hoje.slice(0, 7)}` });
    return `https://wa.me/?text=${encodeURIComponent(`Oi, ${a.nome.split(' ')[0]}! Passando para lembrar da mensalidade de ${reais(a.valor)} (vence dia ${f.pix.vencimento}). Pix copia e cola:\n${cod}\nObrigado! 💪`)}`;
  };
  const vendasAbertas = f.vendas.filter((v) => v.status !== 'pago');

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Financeiro</h1>
        <p className="text-xs text-foreground-500">{nomeMes(f.hoje.slice(0, 7))}</p>
      </header>
      {msg && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{msg}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {!f.pix && <p className="rounded-xl bg-secondary-50 p-3 text-sm text-secondary-900">Cadastre a sua chave Pix e o valor em <Link to="/ferramentas/mensalidade" className="font-semibold underline">Mensalidade</Link> para cobrar pelo app.</p>}

      <div className="grid grid-cols-3 gap-1.5" data-testid="fin-resumo">
        <Tile valor={reais(recebido)} rotulo="recebido no mês" cor="text-accent-700" />
        <Tile valor={reais(emAberto)} rotulo={`em aberto (${faltam.length})`} cor={emAberto ? 'text-secondary-800' : 'text-foreground-950'} />
        <Tile valor={String(atrasados)} rotulo="atrasados" cor={atrasados ? 'text-red-600' : 'text-foreground-950'} />
      </div>

      <div className="rounded-2xl border border-background-200 bg-background-50 px-3 py-2">
        <p className="flex justify-between text-xs font-semibold text-foreground-600"><span>Recebido por mês</span><span>12 meses: {reais(doze)}</span></p>
        <div className="mt-1 h-24" data-testid="fin-grafico">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => reais(Number(v))} />
              <Bar dataKey="Mensalidades" stackId="a" fill="#e8622c" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Programas" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-foreground-500"><span className="text-primary-600">■</span> mensalidades <span className="ml-2 text-green-600">■</span> programas vendidos</p>
      </div>

      {vendasAbertas.length > 0 && (
        <section className="space-y-2" data-testid="fin-vendas">
          <h2 className="font-heading text-lg font-bold text-foreground-950">Vendas para confirmar</h2>
          {vendasAbertas.map((v) => (
            <div key={v.id} className="rounded-2xl border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-foreground-950">{v.comprador} · {v.programa}</p>
              <p className="text-xs text-foreground-600">{reais(v.preco)} · {v.status === 'avisou' ? 'disse que pagou: confira no banco' : 'gerou o Pix, ainda não avisou'}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={!!ocupado} onClick={() => void fazer(v.id, () => confirmarVenda(v.id, true), `Venda confirmada! ${v.comprador} recebeu o programa e entrou na sua equipe.`)} className="rounded-lg bg-green-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">Recebi o Pix</button>
                <button type="button" disabled={!!ocupado} onClick={async () => { if (await confirmar('Não encontrou o Pix? O comprador será avisado.')) void fazer(v.id, () => confirmarVenda(v.id, false), 'Venda recusada.'); }} className="rounded-lg border border-red-200 px-2 py-2 text-xs font-semibold text-red-600 disabled:opacity-50">Não recebi</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-foreground-950">Mensalidades</h2>
          {f.pix && faltam.length > 0 && <button type="button" disabled={!!ocupado} onClick={() => void fazer('todos', () => lembrarPagamento(), 'Lembrete enviado para quem falta pagar (conversa e celular).')} className="text-xs font-semibold text-primary-700"><i className="ri-notification-3-line mr-0.5"></i>Lembrar todos</button>}
        </div>
        {f.pix && <p className="truncate text-[11px] text-foreground-500">{f.pix.lembrete === false ? 'Lembrete automático desligado.' : 'Lembrete automático: 3 dias antes, no dia e 3 depois.'} <Link to="/ferramentas/mensalidade" className="underline">Mudar</Link></p>}
        {f.alunos.length === 0 && <p className="text-sm text-foreground-500">Nenhum aluno ainda.</p>}
        <ul className="divide-y divide-background-200 overflow-hidden rounded-2xl border border-background-200 bg-background-50">
          {f.alunos.map((a) => (
            <li key={a.uid} className="flex items-center gap-1.5 px-3 py-2" data-testid="fin-aluno">
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-foreground-950">{a.nome}</p>
                <p className={`truncate text-xs ${a.pago ? 'text-accent-700' : a.dias < 0 ? 'font-semibold text-red-600' : 'text-foreground-500'}`}>{reais(a.valor)} · {situacao(a)}{a.lembradoHoje && !a.pago ? ' · lembrado hoje' : ''}</p>
              </div>
              {!a.pago && f.pix && (
                <>
                  <button type="button" disabled={!!ocupado} onClick={() => void fazer(a.uid, () => lembrarPagamento(a.uid), `Lembrete enviado para ${a.nome}.`)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-background-200 text-foreground-700" aria-label={`Lembrar ${a.nome} no app`}><i className="ri-notification-3-line"></i></button>
                  <a href={whats(a)} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-background-200 text-green-600" aria-label={`Cobrar ${a.nome} no WhatsApp`}><i className="ri-whatsapp-line"></i></a>
                </>
              )}
              <button type="button" disabled={!!ocupado} onClick={() => void fazer(a.uid, () => marcarPago(a.uid, f.hoje.slice(0, 7), !a.pago), a.pago ? 'Desmarcado.' : `${a.nome}: pago ✓`)} aria-pressed={a.pago} className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold ${a.pago ? 'bg-emerald-500 text-white' : 'border border-background-200'}`}>{a.pago ? 'Pago ✓' : 'Marcar pago'}</button>
            </li>
          ))}
        </ul>
      </section>
      <Link to="/coach/programas" className="block rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-900"><i className="ri-store-2-line mr-1 text-primary-600"></i>Vender programas na sua loja <i className="ri-arrow-right-s-line float-right text-lg text-foreground-400"></i></Link>
    </div>
  );
}

function Tile({ valor, rotulo, cor }: { valor: string; rotulo: string; cor: string }) {
  return (
    <div className="rounded-xl border border-background-200 bg-background-50 px-2 py-2">
      <p className={`truncate font-heading text-sm font-bold ${cor}`}>{valor}</p>
      <p className="text-[11px] leading-tight text-foreground-500">{rotulo}</p>
    </div>
  );
}
