import { useEffect, useState } from "react";
import { Cartao, Botao } from "./ui";

type Evento = Event & { prompt: () => Promise<void> };
declare global { interface Window { __ctInstall?: Evento } }

// Botão "Instalar no celular": no Android usa o aviso do navegador (beforeinstallprompt); no iPhone mostra o passo a passo.
export default function InstalarApp() {
  const [evento, setEvento] = useState<Evento | undefined>(() => (typeof window !== "undefined" ? window.__ctInstall : undefined));
  const [ios] = useState(() => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent));
  const [instalado, setInstalado] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    const aviso = (e: Event) => { e.preventDefault(); setEvento(e as Evento); };
    const feito = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aviso);
    window.addEventListener("appinstalled", feito);
    return () => { window.removeEventListener("beforeinstallprompt", aviso); window.removeEventListener("appinstalled", feito); };
  }, []);

  if (instalado) return null;
  const instalar = async () => {
    if (evento) { await evento.prompt().catch(() => undefined); setEvento(undefined); window.__ctInstall = undefined; }
    else setAjuda(true);
  };
  return (
    <Cartao titulo="Central no celular">
      <Botao onClick={instalar} tipo="forte" testid="instalar-celular">📲 Instalar no celular</Botao>
      {(ajuda || ios) && (
        <p className="text-sm text-nexia-muted" data-testid="instalar-ajuda">
          {ios
            ? "No iPhone: abra esta página no Safari, toque em Compartilhar (quadrado com seta) e escolha “Adicionar à Tela de Início”."
            : "No Android: abra o menu do Chrome (três pontinhos) e toque em “Instalar app” ou “Adicionar à tela inicial”."}
        </p>
      )}
    </Cartao>
  );
}
