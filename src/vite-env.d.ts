/// <reference types="vite/client" />

declare const __BASE_PATH__: string;

interface ImportMetaEnv {
  readonly VITE_NEXIA_API_URL: string;
  readonly VITE_NEXIA_APP_URL: string;
  readonly VITE_URL_CONTEXTO_IA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
