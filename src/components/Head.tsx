import { useEffect } from "react";

/**
 * Dados do site do cliente que o <head> precisa.
 * Vem do site.json (ex.: clientes/ces2027/site.json).
 */
export interface SiteHeadConfig {
  nome?: string;
  frase?: string;
  descricao?: string;
  favicon?: string;
}

const ICON_SELECTOR = 'link[rel~="icon"]';

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

/**
 * Aplica no <head> do navegador o titulo, a descricao e o favicon do cliente.
 * O favicon do index.html (icone do NEXIA) e restaurado quando a pagina do cliente sai.
 */
export default function Head({ config }: { config: SiteHeadConfig | null }) {
  useEffect(() => {
    if (!config) return;

    const tituloAnterior = document.title;
    const icone = document.head.querySelector<HTMLLinkElement>(ICON_SELECTOR);
    const hrefAnterior = icone?.getAttribute("href") ?? null;
    const typeAnterior = icone?.getAttribute("type") ?? null;

    if (config.nome) {
      document.title = config.frase ? `${config.nome} | ${config.frase}` : config.nome;
    }

    const descricao = config.descricao || config.frase;
    if (descricao) upsertMeta("name", "description", descricao);

    if (config.favicon) {
      const link = icone ?? document.createElement("link");
      link.setAttribute("rel", "icon");
      link.setAttribute("href", config.favicon);
      if (config.favicon.toLowerCase().split("?")[0].endsWith(".svg")) {
        link.setAttribute("type", "image/svg+xml");
      } else {
        link.removeAttribute("type");
      }
      if (!icone) document.head.appendChild(link);
    }

    return () => {
      document.title = tituloAnterior;
      if (icone) {
        if (hrefAnterior === null) icone.removeAttribute("href");
        else icone.setAttribute("href", hrefAnterior);
        if (typeAnterior === null) icone.removeAttribute("type");
        else icone.setAttribute("type", typeAnterior);
      }
    };
  }, [config]);

  return null;
}
