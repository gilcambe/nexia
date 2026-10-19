import { Link } from 'react-router-dom';
import InstallButton from '@/components/feature/InstallButton';
import { LINK_APP, LINK_PLAY, qualAparelho } from '@/lib/instalar';

// /instalar: leva cada aparelho ao jeito certo de ter o app (sem barra de endereço no Android).
export default function Instalar() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const aparelho = qualAparelho(navigator.userAgent, standalone, navigator.maxTouchPoints, navigator.platform);
  return (
    <main className="mx-auto min-h-screen max-w-md space-y-5 bg-background-50 px-4 py-8 text-foreground-950">
      <header className="text-center">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={72} height={72} className="mx-auto rounded-2xl" />
        <h1 className="mt-3 font-heading text-2xl font-bold">Instalar o Body Coach</h1>
        <p className="mt-1 text-sm text-foreground-600">Abre como app, em tela cheia, sem a barra de endereço.</p>
      </header>

      {aparelho === 'instalado' && (
        <section className="rounded-2xl border border-primary-300 bg-primary-100 p-4 text-center" data-testid="instalar-ok">
          <p className="font-semibold">O app já está instalado neste aparelho.</p>
          <Link to="/" className="mt-3 inline-block rounded-xl bg-primary-500 px-5 py-3 font-semibold text-background-50">Abrir o app</Link>
        </section>
      )}

      {aparelho === 'android' && (
        <section className="space-y-3 rounded-2xl border border-background-200 p-4" data-testid="instalar-android">
          <a href={LINK_PLAY} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-4 text-base font-semibold text-background-50">
            <i className="ri-google-play-fill text-xl"></i>Baixar na Play Store
          </a>
          <p className="text-sm text-foreground-700">Instale <b>pela loja</b>. O atalho “Adicionar à tela inicial” do Chrome abre com a barra de endereço; o app da Play abre em tela cheia.</p>
          <p className="text-xs text-foreground-500">Já tinha o atalho do Chrome? Pode apagar o atalho depois de instalar o app da loja.</p>
        </section>
      )}

      {aparelho === 'iphone' && (
        <section className="space-y-2 rounded-2xl border border-background-200 p-4" data-testid="instalar-iphone">
          <p className="font-semibold">No iPhone, pelo Safari:</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground-700">
            <li>Toque em <i className="ri-share-box-line"></i> Compartilhar.</li>
            <li>Toque em “Adicionar à Tela de Início”.</li>
            <li>Abra o Body Coach pelo ícone novo: ele abre em tela cheia.</li>
          </ol>
        </section>
      )}

      {aparelho === 'computador' && (
        <section className="space-y-3 rounded-2xl border border-background-200 p-4" data-testid="instalar-computador">
          <p className="text-sm text-foreground-700">No celular Android, abra <b>{LINK_APP.replace('https://', '')}instalar</b> ou baixe direto na loja:</p>
          <a href={LINK_PLAY} target="_blank" rel="noopener noreferrer" className="block text-center font-semibold text-primary-700 underline">Body Coach na Play Store</a>
          <div className="flex justify-center"><InstallButton /></div>
        </section>
      )}

      <p className="text-center"><Link to="/" className="text-sm text-foreground-500 underline">Continuar no navegador</Link></p>
    </main>
  );
}
