import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { initFirebase } from "@/services/firebase";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const result = await initFirebase();
        if (!result) { setLoading(false); return; }
        const { auth } = result;
        const { onAuthStateChanged } = await import("firebase/auth");
        unsubscribe = onAuthStateChanged(auth, (fbUser) => {
          setUser(fbUser ? { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName } : null);
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    }
    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await initFirebase();
      if (!result) throw new Error("Firebase não inicializado");
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(result.auth, email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no login";
      setError(msg);
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      const result = await initFirebase();
      if (!result) throw new Error("Firebase não inicializado");
      const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
      const cred = await createUserWithEmailAndPassword(result.auth, email, password);
      if (name && cred.user) await updateProfile(cred.user, { displayName: name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no cadastro";
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const result = await initFirebase();
      if (!result) return;
      const { signOut } = await import("firebase/auth");
      await signOut(result.auth);
    } catch { /* noop */ }
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const result = await initFirebase();
      if (!result?.auth?.currentUser) return null;
      return await result.auth.currentUser.getIdToken();
    } catch { return null; }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
