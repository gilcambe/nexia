export const NEXIA_API_BASE =
  import.meta.env.VITE_NEXIA_API_URL || "https://nexia-os.onrender.com";

export const NEXIA_APP_URL =
  import.meta.env.VITE_NEXIA_APP_URL || NEXIA_API_BASE;

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
