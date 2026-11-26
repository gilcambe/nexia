import { useState } from 'react';
import Card from '@/components/base/Card';
import { dataCurta } from '@/lib/acesso';
import type { Cupom } from './painelTipos';

const campo = 'w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-base';
const botao = 'rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';

// Validação simples e eficaz de e-mail
const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Presente, cupom e promoção: cada formulário chama uma ação de admin no servidor.
export default function Ferramentas({ cupons, fazer }: { cupons: Cupom[]; fazer: (corpo: Record<string, unknown>, ok: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [cupom, setCupom] = useState({ codigo: '', pct: '20', dias: '30', maxUsos: '0' });
  const [promo, setPromo] = useState({ pct: '20', ate: '', texto: '' });

  // Feedback local ao lado do botão clicado
  const [presenteandoDia, setPresenteandoDia] = useState<number | null>(null);
  const [statusPresente, setStatusPresente] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const valido = emailValido(email);
  const dicaEmail = valido ? '' : 'digite um e-mail válido';

  async function handlePresentear(dias: number) {
    if (!valido) return;
    setPresenteandoDia(dias);
    setStatusPresente(null);
    try {
      await fazer({ acao: 'dono_presente', email: email.trim(), dias }, `Presente de ${dias} dias enviado para ${email.trim()}.`);
      setStatusPresente({ tipo: 'ok', texto: `Presente de ${dias} dias enviado com sucesso!` });
    } catch (err: unknown) {
      const msgErro = err instanceof Error ? err.message : 'Erro ao presentear';
      setStatusPresente({ tipo: 'erro', texto: msgErro });
    } finally {
      setPresenteandoDia(null);
    }
  }

  return (
    <>
      <Card>
        <h2 className="font-semibold text-foreground-900"><i className="ri-gift-line mr-1"></i>Presentear</h2>
        <p className="text-sm text-foreground-500">A pessoa precisa já ter entrado no app uma vez.</p>
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatusPresente(null);
          }}
          type="email"
          placeholder="email@da.pessoa"
          className={`${campo} mt-2`}
        />

        <div className="mt-2 grid grid-cols-4 gap-2">
          {[7, 30, 90, 365].map((d) => (
            <div key={d} title={dicaEmail} className="w-full">
              <button
                type="button"
                disabled={!valido || presenteandoDia !== null}
                onClick={() => void handlePresentear(d)}
                className={`${botao} w-full`}
              >
                {presenteandoDia === d ? 'Enviando...' : `${d} dias`}
              </button>
            </div>
          ))}
        </div>

        {statusPresente && (
          <div
            className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${
              statusPresente.tipo === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            <i className={statusPresente.tipo === 'ok' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} />
            <span>{statusPresente.texto}</span>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground-900"><i className="ri-coupon-line mr-1"></i>Cupom de desconto</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="col-span-2 text-sm">Código<input value={cupom.codigo} onChange={(e) => setCupom({ ...cupom, codigo: e.target.value.toUpperCase() })} placeholder="VOLTA20" className={campo} /></label>
          <label className="text-sm">Desconto (%)<input value={cupom.pct} onChange={(e) => setCupom({ ...cupom, pct: e.target.value })} inputMode="numeric" className={campo} /></label>
          <label className="text-sm">Vale por (dias)<input value={cupom.dias} onChange={(e) => setCupom({ ...cupom, dias: e.target.value })} inputMode="numeric" className={campo} /></label>
          <label className="col-span-2 text-sm">Máximo de usos (0 = sem limite)<input value={cupom.maxUsos} onChange={(e) => setCupom({ ...cupom, maxUsos: e.target.value })} inputMode="numeric" className={campo} /></label>
        </div>
        <button disabled={cupom.codigo.length < 3} onClick={() => void fazer({ acao: 'cupom_criar', codigo: cupom.codigo, pct: Number(cupom.pct), dias: Number(cupom.dias), maxUsos: Number(cupom.maxUsos) }, `Cupom ${cupom.codigo} criado.`)} className={`${botao} mt-2 w-full`}>Criar cupom</button>
        {cupons.length > 0 && (
          <ul className="mt-3 divide-y divide-background-200 text-sm">
            {cupons.map((c) => <li key={c.codigo} className="flex justify-between py-2"><b>{c.codigo}</b><span>{c.pct}% · {c.usos}{c.maxUsos ? `/${c.maxUsos}` : ''} usos · até {dataCurta(c.validoAte)}</span></li>)}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground-900"><i className="ri-megaphone-line mr-1"></i>Promoção</h2>
        <p className="text-sm text-foreground-500">Aparece para todos na tela de assinar o Premium.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-sm">Desconto (%)<input value={promo.pct} onChange={(e) => setPromo({ ...promo, pct: e.target.value })} inputMode="numeric" className={campo} /></label>
          <label className="text-sm">Até<input type="date" value={promo.ate} onChange={(e) => setPromo({ ...promo, ate: e.target.value })} className={campo} /></label>
          <label className="col-span-2 text-sm">Texto<input value={promo.texto} onChange={(e) => setPromo({ ...promo, texto: e.target.value })} maxLength={120} placeholder="Semana Fit: Premium com 30% off" className={campo} /></label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button disabled={!promo.ate} onClick={() => void fazer({ acao: 'promo_salvar', pct: Number(promo.pct), ate: new Date(`${promo.ate}T23:59:59-03:00`).getTime(), texto: promo.texto }, 'Promoção no ar.')} className={botao}>Lançar promoção</button>
          <button onClick={() => void fazer({ acao: 'promo_salvar', pct: 0 }, 'Promoção encerrada.')} className="rounded-lg border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700">Encerrar promoção</button>
        </div>
      </Card>
    </>
  );
}
