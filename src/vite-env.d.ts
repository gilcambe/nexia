/// <reference types="vite/client" />

declare const __BASE_PATH__: string;

interface ImportMetaEnv {
  readonly VITE_NEXIA_API_URL: string;
  readonly VITE_NEXIA_APP_URL: string;
  readonly VITE_URL_CONTEXTO_IA: string;
  readonly VITE_E2E_USUARIO_TESTE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
