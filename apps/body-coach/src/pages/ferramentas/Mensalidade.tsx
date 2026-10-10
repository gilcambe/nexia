import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';
import { TIPOS_CHAVE, chaveValida, codigoPix, mesAtual, nomeMes, reais, type TipoChave } from '@/lib/ferramentas/pix';

interface Pix { tipo: TipoChave; chave: string; nome: string; cidade: string; valor: number; vencimento: number }
interface AlunoPag { uid: string; nome: string; pago: boolean; avisou: boolean; valor: number | null }
type Resposta =
  | { papel: 'coach'; mes: string; pix: Pix | null; alunos: AlunoPag[] }
  | { papel: 'aluno'; mes: string; pix: Pix | null; coach?: string; valor?: number | null; pago?: boolean; avisou?: boolean };

function mesesAntes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

function QrPix({ codigo }: { codigo: string }) {
  const src = useMemo(() => { const q = qrcode(0, 'M'); q.addData(codigo); q.make(); return q.createDataURL(6, 2); }, [codigo]);
  return <img src={src} alt="QR Code do Pix" className="mx-auto h-56 w-56 rounded-xl bg-white p-1 [image-rendering:pixelated]" />;
}

function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2500); } catch { /* sem área de transferência */ } }} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50">
      <i className="ri-file-copy-line mr-1"></i>{ok ? 'Copiado! Cole no app do seu banco' : rotulo}
    </button>
  );
}

// Lado do aluno: valor, QR e "copia e cola" do Pix do coach, e o botão "já paguei" que avisa na conversa.
function Aluno({ r, recarregar }: { r: Extract<Resposta, { papel: 'aluno' }>; recarregar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  if (!r.pix) {
    return <Card><p className="text-sm text-foreground-700">{r.coach ? `${r.coach} ainda não cadastrou a chave Pix no app.` : 'Entre na equipe do seu coach para ver a mensalidade.'}</p>{!r.coach && <Link to="/chat" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50">Entrar com o código</Link>}</Card>;
  }
  const valor = r.valor ?? r.pix.valor;
  const codigo = codigoPix({ ...r.pix, valor, descricao: `Mensalidade ${r.mes}` });
  const avisar = async () => { setOcupado(true); try { await chatApi({ acao: 'pagamento_avisar' }); recarregar(); } finally { setOcupado(false); } };
  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">{nomeMes(r.mes)}</p>
        <p className="font-heading text-3xl font-bold text-foreground-950">{valor ? reais(valor) : 'Valor combinado'}</p>
        <p className="text-sm text-foreground-600">Para {r.pix.nome} · vence dia {r.pix.vencimento}</p>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${r.pago ? 'bg-emerald-100 text-emerald-800' : r.avisou ? 'bg-amber-100 text-amber-800' : 'bg-background-100 text-foreground-700'}`} data-testid="status-pagamento">
          {r.pago ? '✅ Pago, confirmado pelo coach' : r.avisou ? '⏳ Você avisou; aguardando o coach confirmar' : 'Em aberto'}
        </p>
      </Card>
      {!r.pago && (
        <Card>
          <QrPix codigo={codigo} />
          <p className="mt-2 text-center text-xs text-foreground-500">Abra o app do seu banco › Pix › Ler QR Code, ou copie o código abaixo.</p>
          <div className="mt-3"><Copiar texto={codigo} rotulo="Copiar Pix copia e cola" /></div>
          <button type="button" disabled={ocupado || r.avisou} onClick={() => void avisar()} className="mt-2 w-full rounded-xl border border-background-200 px-4 py-3 text-sm font-semibold text-foreground-800 disabled:opacity-60">{r.avisou ? 'Coach avisado ✓' : 'Já paguei, avisar o coach'}</button>
        </Card>
      )}
      <p className="text-[11px] text-foreground-500">O pagamento vai direto para a conta do seu coach, sem taxa e sem intermediário.</p>
    </div>
  );
}

// Lado do coach: cadastra a chave e vê quem pagou no mês, marcando com um toque.
function Coach({ r, mes, setMes, recarregar }: { r: Extract<Resposta, { papel: 'coach' }>; mes: string; setMes: (m: string) => void; recarregar: () => void }) {
  const [f, setF] = useState<Pix>(r.pix ?? { tipo: 'cpf', chave: '', nome: '', cidade: '', valor: 0, vencimento: 10 });
  const [editar, setEditar] = useState(!r.pix);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const salvar = async () => {
    if (!chaveValida(f.tipo, f.chave)) { setErro('Confira a chave Pix para o tipo escolhido.'); return; }
    setOcupado(true); setErro('');
    try { await chatApi({ acao: 'pix_config', ...f }); setEditar(false); recarregar(); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };
  const marcar = async (aluno: string, pago: boolean) => { await chatApi({ acao: 'pagamento_marcar', aluno, mes, pago }).catch(() => {}); recarregar(); };
  const pagos = r.alunos.filter((a) => a.pago);
  const total = pagos.reduce((s, a) => s + (a.valor ?? r.pix?.valor ?? 0), 0);
  const input = 'w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm';

  return (
    <div className="space-y-3">
      {editar ? (
        <Card>
          <h2 className="font-semibold text-foreground-950">Sua chave Pix</h2>
          <p className="text-sm text-foreground-600">Os alunos pagam direto para você, sem taxa. Nada de gateway.</p>
          <div className="mt-3 grid gap-2">
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoChave })} className={input} aria-label="Tipo de chave">
              {TIPOS_CHAVE.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <input value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value })} placeholder={TIPOS_CHAVE.find((t) => t.id === f.tipo)?.exemplo} aria-label="Chave Pix" className={input} />
            <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Seu nome (como no banco)" aria-label="Nome do recebedor" className={input} />
            <input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} placeholder="Sua cidade" aria-label="Cidade" className={input} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-foreground-500">Mensalidade (R$)<input type="number" inputMode="decimal" min={0} step="0.01" value={f.valor || ''} onChange={(e) => setF({ ...f, valor: Number(e.target.value) })} className={`${input} mt-1`} /></label>
              <label className="text-xs text-foreground-500">Vence no dia<input type="number" min={1} max={28} value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: Number(e.target.value) })} className={`${input} mt-1`} /></label>
            </div>
          </div>
          {erro && <p className="mt-2 text-sm text-red-600" role="alert">{erro}</p>}
          <button type="button" disabled={ocupado} onClick={() => void salvar()} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-60">Salvar chave Pix</button>
        </Card>
      ) : (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-foreground-500">Recebendo em</p>
              <p className="font-semibold text-foreground-950">{TIPOS_CHAVE.find((t) => t.id === r.pix?.tipo)?.nome}: {r.pix?.chave}</p>
              <p className="text-sm text-foreground-600">{r.pix?.valor ? reais(r.pix.valor) : 'Sem valor fixo'} · vence dia {r.pix?.vencimento}</p>
            </div>
            <button type="button" onClick={() => setEditar(true)} className="text-sm font-semibold text-primary-700">Editar</button>
          </div>
        </Card>
      )}
      <Card>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMes(mesesAntes(mes, 1))} aria-label="Mês anterior" className="rounded-lg p-2"><i className="ri-arrow-left-s-line text-xl"></i></button>
          <p className="font-semibold text-foreground-950">{nomeMes(mes)}</p>
          <button type="button" onClick={() => setMes(mesesAntes(mes, -1))} disabled={mes >= mesAtual()} aria-label="Próximo mês" className="rounded-lg p-2 disabled:opacity-30"><i className="ri-arrow-right-s-line text-xl"></i></button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-2"><p className="font-heading text-xl font-bold text-emerald-700">{reais(total)}</p><p className="text-[11px] text-foreground-500">recebido</p></div>
          <div className="rounded-xl bg-background-100/70 p-2"><p className="font-heading text-xl font-bold">{pagos.length}/{r.alunos.length}</p><p className="text-[11px] text-foreground-500">alunos pagaram</p></div>
        </div>
        {r.alunos.length === 0 && <p className="mt-3 text-sm text-foreground-500">Quando os alunos entrarem com o seu código, eles aparecem aqui.</p>}
        <ul className="mt-3 divide-y divide-background-200">
          {r.alunos.map((a) => (
            <li key={a.uid} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground-950">{a.nome}</span>
                <span className="block text-xs text-foreground-500">{a.pago ? 'Pago' : a.avisou ? 'Avisou que pagou: confira no banco' : 'Em aberto'}</span>
              </span>
              <button type="button" onClick={() => void marcar(a.uid, !a.pago)} aria-pressed={a.pago} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${a.pago ? 'bg-emerald-500 text-background-50' : a.avisou ? 'bg-amber-400 text-foreground-950' : 'border border-background-200'}`}>{a.pago ? 'Pago ✓' : 'Marcar pago'}</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function Mensalidade() {
  const [mes, setMes] = useState(mesAtual);
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try { setR(await chatApi<Resposta>({ acao: 'pix_ver', mes })); setErro(''); }
    catch (e) { setErro((e as Error).message); }
  }, [mes]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (erro && !r) {
    return (
      <Card>
        <p className="text-sm text-foreground-700">{/escolha se você é aluno ou coach/i.test(erro) ? 'Primeiro abra a conversa e diga se você é aluno ou coach.' : erro}</p>
        <Link to="/chat" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50">Abrir conversa</Link>
      </Card>
    );
  }
  if (!r) return <p className="text-sm text-foreground-500">Carregando…</p>;
  return r.papel === 'coach' ? <Coach key={r.pix ? 'com' : 'sem'} r={r} mes={mes} setMes={setMes} recarregar={() => void carregar()} /> : <Aluno r={r} recarregar={() => void carregar()} />;
}
