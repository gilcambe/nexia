export const NEXIA_API_BASE =
  // ADR-HOST-01: vazio = API no mesmo endereço do site (Worker do Cloudflare → container).
  import.meta.env.VITE_NEXIA_API_URL || "";

export const NEXIA_APP_URL =
  import.meta.env.VITE_NEXIA_APP_URL || NEXIA_API_BASE || (typeof window !== "undefined" ? window.location.origin : "");

export function apiPath(route: string): string {
  const r = route.startsWith("/") ? route : "/" + route;
  return `${NEXIA_API_BASE}/api${r}`;
}

export function healthUrl(): string {
  return `${NEXIA_API_BASE}/health`;
}

export function firebaseConfigUrl(): string {
  return `${NEXIA_API_BASE}/api/firebase-config`;
}
