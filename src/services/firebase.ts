import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { api } from "./api";

let app: FirebaseApp | null = null;

export async function initFirebase() {
  if (app) {
    const { getAuth } = await import("firebase/auth");
    return { app, auth: getAuth(app) };
  }
  // Config pública do app da Web guardada no aparelho: abre sem esperar o Worker; a rede só atualiza para a próxima vez.
  let cfg: unknown = null;
  try { cfg = JSON.parse(localStorage.getItem("nx:fbcfg") || "null"); } catch { cfg = null; }
  const rede = api.firebaseConfig().then(({ data, error }) => {
    if (!error && data) { try { localStorage.setItem("nx:fbcfg", JSON.stringify(data)); } catch { /* sem armazenamento */ } }
    return { data, error };
  });
  if (!cfg) {
    const { data, error } = await rede;
    if (error || !data) {
      console.error("[FIREBASE] Config load failed:", error);
      return null;
    }
    cfg = data;
  }
  app = initializeApp(cfg as FirebaseOptions);
  const { getAuth } = await import("firebase/auth");
  return { app, auth: getAuth(app) };
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
