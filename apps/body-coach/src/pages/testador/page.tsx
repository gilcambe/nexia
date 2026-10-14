import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { verAcesso, dataCurta } from '@/lib/acesso';
import { avisar } from '@/lib/dialogo';
import { TESTADOR, marcarTestadorOk, pedirPremioTestador } from '@/lib/testador';

const PASSOS = [
  { n: 1, titulo: 'Entre no grupo de testadores', texto: 'Use o mesmo Gmail da sua Play Store.', botao: 'Entrar no grupo', icone: 'ri-group-line', url: TESTADOR.grupo },
  { n: 2, titulo: 'Ative o teste', texto: 'Toque em "Torne-se um testador".', botao: 'Ativar o teste', icone: 'ri-checkbox-circle-line', url: TESTADOR.ativarTeste },
  { n: 3, titulo: 'Instale o app', texto: 'Baixe o Body Coach pela Play Store.', botao: 'Instalar o app', icone: 'ri-google-play-line', url: TESTADOR.instalar },
];

// Seja testador do app Android: 3 passos no Google Play e, no fim, 30 dias de Premium (uma vez por conta).
export default function Testador() {
  const { user } = useAuth();
  const [ganhou, setGanhou] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void verAcesso().then((a) => { if (a.testador) { setGanhou(true); marcarTestadorOk(); } }).catch(() => { /* sem internet */ });
  }, []);

  const pedir = async () => {
    setEnviando(true);
    try {
      const r = await pedirPremioTestador();
      marcarTestadorOk();
      setGanhou(true);
      if (r.jaGanhou) await avisar('Você já ganhou o prêmio de testador nesta conta. Obrigado por ajudar!');
      else await avisar(`Pronto! Você ganhou ${r.dias ?? TESTADOR.diasPremium} dias de Premium${r.pagoAte ? `, até ${dataCurta(r.pagoAte)}` : ''}.\n\nFique com o app instalado por ${TESTADOR.diasInstalado} dias.`);
    } catch (e) {
      await avisar((e as Error).message || 'Não deu certo agora. Tente de novo.');
    } finally { setEnviando(false); }
  };

  const convidar = async () => {
    const texto = `Me ajuda a testar o app Body Coach no Android? Você ganha ${TESTADOR.diasPremium} dias de Premium:`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Teste o Body Coach', text: texto, url: TESTADOR.convite }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${texto} ${TESTADOR.convite}`); await avisar('Link copiado! Cole no WhatsApp para seus amigos.'); }
    catch { await avisar(`Copie e envie este link: ${TESTADOR.convite}`); }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4" data-testid="pagina-testador">
      <header className="rounded-2xl bg-primary-500 p-5 text-background-50">
        <i className="ri-android-line text-3xl"></i>
        <h1 className="mt-1 font-heading text-2xl font-bold leading-tight">Seja testador do app Android e ganhe {TESTADOR.diasPremium} dias de Premium</h1>
        <p className="mt-2 text-sm opacity-90">Leva 2 minutos. Depois, é só ficar com o app instalado por {TESTADOR.diasInstalado} dias.</p>
      </header>

      <ol className="space-y-3">
        {PASSOS.map((p) => (
          <li key={p.n} className="rounded-2xl border border-background-200 bg-background-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">{p.n}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground-950">{p.titulo}</p>
                <p className="text-sm text-foreground-600">{p.texto}</p>
              </div>
            </div>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-base font-semibold text-background-50 transition hover:bg-primary-600">
              <i className={`${p.icone} text-xl`}></i>{p.botao}<i className="ri-external-link-line"></i>
            </a>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-primary-300 bg-primary-50 p-4">
        {user?.email && <p className="mb-2 text-sm text-foreground-700">Sua conta: <b>{user.email}</b></p>}
        <p className="mb-3 text-sm text-foreground-700"><i className="ri-time-line mr-1"></i>Fique com o app instalado por {TESTADOR.diasInstalado} dias. Isso ajuda o app a sair na Play Store para todo mundo.</p>
        <button type="button" onClick={() => void pedir()} disabled={enviando} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60" data-testid="testador-premio">
          <i className={ganhou ? 'ri-check-double-line text-xl' : 'ri-gift-line text-xl'}></i>
          {enviando ? 'Enviando...' : ganhou ? 'Prêmio já recebido' : 'Já instalei, quero meu prêmio'}
        </button>
      </div>

      <button type="button" onClick={() => void convidar()} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-primary-300 bg-background-50 px-4 text-base font-semibold text-primary-700" data-testid="testador-convidar">
        <i className="ri-share-line text-xl"></i>Convidar amigos para testar
      </button>
    </div>
  );
}
