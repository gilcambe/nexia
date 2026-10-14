import { useState } from 'react';
import { avisarQuePaguei, comDesconto, dataCurta, PRECOS, verCupom, type Acesso } from '@/lib/acesso';

// Preços e pagamento por Pix (chave do NEXIA) com o aviso "Já paguei" para o admin conferir.
export default function PagarPix({ acesso, avisar }: { acesso: Acesso; avisar: (msg: string) => void }) {
  const coach = acesso.tipo === 'coach';
  const copiar = async () => { try { await navigator.clipboard.writeText(acesso.pix); avisar('Chave Pix copiada! Cole no app do seu banco.'); } catch { avisar('Não consegui copiar. Segure a chave e copie.'); } };
  const [codigo, setCodigo] = useState('');
  const [cupom, setCupom] = useState<{ codigo: string; pct: number } | null>(null);
  const promoPct = acesso.promo && acesso.promo.ate > Date.now() ? acesso.promo.pct : 0;
  const pct = Math.max(promoPct, cupom?.pct ?? 0);
  const aplicar = async () => { try { const c = await verCupom(codigo); setCupom(c); avisar(`Cupom ${c.codigo}: ${c.pct}% de desconto.`); } catch (e) { setCupom(null); avisar((e as Error).message); } };
  const paguei = async () => { try { await avisarQuePaguei(cupom?.codigo ?? ''); avisar('Recebemos o seu aviso! Assim que o Pix for confirmado, o app libera sozinho.'); } catch (e) { avisar((e as Error).message); } };
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
          ) : pct > 0 ? (
            <p><b>Premium:</b> <s>{PRECOS.premium}</s><br /><b className="text-primary-700">{comDesconto(19.9, pct)} por mês ou {comDesconto(149, pct)} por ano ({pct}% off)</b></p>
          ) : <p><b>Premium:</b> {PRECOS.premium}</p>}
          {coach && pct > 0 && <p className="font-semibold text-primary-700">{pct}% de desconto em qualquer plano.</p>}
          <div className="flex gap-2 pt-1">
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Tenho um cupom" aria-label="Cupom de desconto" className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-base uppercase" />
            <button onClick={() => void aplicar()} disabled={codigo.trim().length < 3} className="rounded-lg border border-primary-300 px-3 text-sm font-semibold text-primary-700 disabled:opacity-50">Aplicar</button>
          </div>
          {acesso.pix ? (
            <>
              <p className="pt-1">Pague por Pix nesta chave:</p>
              <p className="break-all rounded-lg border border-background-200 bg-background-50 px-3 py-2 font-semibold text-foreground-900">{acesso.pix}</p>
              {acesso.pixNome && <p className="text-sm">Pix para: <b className="text-foreground-900">{acesso.pixNome}</b></p>}
              <button onClick={() => void copiar()} className="w-full rounded-xl border border-primary-300 py-3 text-base font-semibold text-primary-700"><i className="ri-file-copy-line mr-1"></i>Copiar chave Pix</button>
            </>
          ) : <p className="pt-1">Fale com o NEXIA para receber a chave Pix.</p>}
        </div>
      <button onClick={() => void paguei()} className="w-full rounded-xl bg-primary-500 py-3 text-base font-semibold text-background-50">Já paguei, avisar o NEXIA</button>
    </>
  );
}
