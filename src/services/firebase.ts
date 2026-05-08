import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { api } from "./api";

let app: FirebaseApp | null = null;

export async function initFirebase() {
  if (app) {
    const { getAuth } = await import("firebase/auth");
    return { app, auth: getAuth(app) };
  }
  const { data: cfg, error } = await api.firebaseConfig();
  if (error || !cfg) {
    console.error("[FIREBASE] Config load failed:", error);
    return null;
  }
  app = initializeApp(cfg as FirebaseOptions);
  const { getAuth } = await import("firebase/auth");
  return { app, auth: getAuth(app) };
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
