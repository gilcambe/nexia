import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { avisarQuePaguei, dataCurta, ECONOMIA_ANUAL, PLANOS_PREMIUM, PRECOS, tipoDaChave, usarCupom, valorComDesconto, verCupom, type Acesso, type PlanoPremium } from '@/lib/acesso';
import { codigoPix, reais } from '@/lib/ferramentas/pix';

// Preços e pagamento por Pix (chave do NEXIA) com o aviso "Já paguei" para o admin conferir.
// Premium: mensal ou anual (começa no anual); o copia e cola e o QR já vêm com o valor do plano, com desconto.
export default function PagarPix({ acesso, avisar }: { acesso: Acesso; avisar: (msg: string) => void }) {
  const coach = acesso.tipo === 'coach';
  const [codigo, setCodigo] = useState('');
  const [cupom, setCupom] = useState<{ codigo: string; pct: number } | null>(null);
  const [plano, setPlano] = useState<PlanoPremium>('anual');
  const promoPct = acesso.promo && acesso.promo.ate > Date.now() ? acesso.promo.pct : 0;
  const pct = Math.max(promoPct, cupom?.pct ?? 0);
  const valor = valorComDesconto(PLANOS_PREMIUM[plano].valor, pct);
  const pixCodigo = useMemo(() => {
    if (coach || !acesso.pix) return '';
    try { return codigoPix({ tipo: tipoDaChave(acesso.pix), chave: acesso.pix, nome: 'NEXIA', cidade: 'BRASIL', valor, descricao: `Premium ${PLANOS_PREMIUM[plano].nome}` }); } catch { return ''; }
  }, [coach, acesso.pix, valor, plano]);
  const qr = useMemo(() => { if (!pixCodigo) return ''; const q = qrcode(0, 'M'); q.addData(pixCodigo); q.make(); return q.createDataURL(5, 2); }, [pixCodigo]);
  const copiarTexto = async (t: string, msg: string) => { try { await navigator.clipboard.writeText(t); avisar(msg); } catch { avisar('Não consegui copiar. Segure o texto e copie.'); } };
  // Cupom que veio no link de convite (/c/amigo?cupom=…): entra sozinho
  useEffect(() => {
    let guardado = '';
    try { guardado = localStorage.getItem('bc_cupom') ?? ''; } catch { /* sem armazenamento */ }
    if (!guardado) return;
    setCodigo(guardado);
    verCupom(guardado).then((c) => { if (!(c.pct > 0)) return; setCupom(c); avisar(`Cupom ${c.codigo}: ${c.pct}% de desconto.`); }).catch(() => { /* cupom vencido: segue sem desconto */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aplicar = async () => {
    try {
      const c = await verCupom(codigo);
      // convite de dias grátis digitado aqui: soma os dias ao teste (o mesmo código do link e do cadastro)
      if (c.dias) { const r = await usarCupom(c.codigo); avisar(r.jaUsado ? 'Você já usou um convite de dias grátis.' : `Convite ${c.codigo}: +${r.dias} dias grátis. Abra o app de novo para ver.`); return; }
      setCupom(c); avisar(`Cupom ${c.codigo}: ${c.pct}% de desconto.`);
    } catch (e) { setCupom(null); avisar((e as Error).message); }
  };
  const paguei = async () => {
    try { await (coach ? avisarQuePaguei(cupom?.codigo ?? '') : avisarQuePaguei(cupom?.codigo ?? '', plano, valor)); avisar('Recebemos o seu aviso! Assim que o Pix for confirmado, o app libera sozinho.'); } catch (e) { avisar((e as Error).message); }
  };
  return (
    <>
        {promoPct > 0 && acesso.promo && (
          <p className="mb-2 rounded-xl bg-accent-100 p-3 text-left text-sm font-semibold text-accent-800" data-testid="promo"><i className="ri-megaphone-line mr-1"></i>{acesso.promo.texto || 'Promoção'}: {promoPct}% off até {dataCurta(acesso.promo.ate)}</p>
        )}
        <div className="space-y-2 rounded-xl bg-background-100 p-3 text-left text-sm text-foreground-700">
          {coach ? (
            <>
              {PRECOS.faixas.map((f) => <p key={f.faixa}><b>{f.nome}:</b> {f.alunos}, {f.preco} (alunos não pagam)</p>)}
              <p><b>Coach Parceiro:</b> {PRECOS.parceiro}</p>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plano Premium" data-testid="planos-premium">
              {(['mensal', 'anual'] as PlanoPremium[]).map((id) => {
                const p = PLANOS_PREMIUM[id];
                const marcado = plano === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={marcado} onClick={() => setPlano(id)} className={`relative rounded-xl border-2 bg-background-50 px-2 pb-2 pt-5 text-center ${marcado ? 'border-primary-500' : 'border-background-200'}`}>
                    {id === 'anual' && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">economize {ECONOMIA_ANUAL}%</span>}
                    <span className="block text-xs font-semibold uppercase tracking-wide text-foreground-500">{p.nome}</span>
                    {pct > 0 && <s className="block text-xs text-foreground-400">{reais(p.valor)}</s>}
                    <span className="block font-heading text-lg font-bold text-foreground-950">{reais(valorComDesconto(p.valor, pct))}</span>
                    <span className="block text-xs text-foreground-500">{id === 'anual' ? `por ano · ${reais(valorComDesconto(p.valor, pct) / 12)}/mês` : 'por mês'}</span>
                  </button>
                );
              })}
            </div>
          )}
          {pct > 0 && <p className="font-semibold text-primary-700">{pct}% de desconto {coach ? 'em qualquer plano' : 'aplicado'}.</p>}
          <div className="flex gap-2 pt-1">
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Tenho um cupom ou convite" aria-label="Cupom de desconto" className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-base uppercase placeholder:text-sm placeholder:normal-case" />
            <button onClick={() => void aplicar()} disabled={codigo.trim().length < 3} className="rounded-lg border border-primary-300 px-3 text-sm font-semibold text-primary-700 disabled:opacity-50">Aplicar</button>
          </div>
          {acesso.pix ? (
            <>
              {pixCodigo && (
                <div className="pt-1 text-center" data-testid="pix-premium">
                  <p className="text-left">Pague {reais(valor)} por Pix:</p>
                  {qr && <img src={qr} alt="QR Code do Pix" className="mx-auto mt-2 h-44 w-44 rounded-xl bg-white p-1 [image-rendering:pixelated]" />}
                  <button onClick={() => void copiarTexto(pixCodigo, 'Pix copia e cola copiado! Cole no app do seu banco.')} className="mt-2 w-full rounded-xl bg-primary-500 py-3 text-base font-semibold text-background-50"><i className="ri-file-copy-line mr-1"></i>Copiar Pix copia e cola</button>
                </div>
              )}
              <p className="pt-1">{pixCodigo ? 'Ou use a chave Pix:' : 'Pague por Pix nesta chave:'}</p>
              <p className="break-all rounded-lg border border-background-200 bg-background-50 px-3 py-2 font-semibold text-foreground-900">{acesso.pix}</p>
              {acesso.pixNome && <p className="text-sm">Pix para: <b className="text-foreground-900">{acesso.pixNome}</b></p>}
              <button onClick={() => void copiarTexto(acesso.pix, 'Chave Pix copiada! Cole no app do seu banco.')} className="w-full rounded-xl border border-primary-300 py-3 text-base font-semibold text-primary-700"><i className="ri-file-copy-line mr-1"></i>Copiar chave Pix</button>
            </>
          ) : <p className="pt-1">Toque em "Já paguei, avisar" ou fale com o suporte para receber a chave Pix.</p>}
        </div>
      <button onClick={() => void paguei()} className="w-full rounded-xl bg-primary-500 py-2.5 text-base font-semibold text-background-50">Já paguei, avisar</button>
    </>
  );
}
