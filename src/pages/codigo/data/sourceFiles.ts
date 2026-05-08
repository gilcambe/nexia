export interface SourceFile {
  path: string;
  category: string;
  description: string;
  content: string;
}

export const categories = [
  { id: "all", label: "Todos", icon: "ri-folder-line" },
  { id: "config", label: "Config", icon: "ri-settings-3-line" },
  { id: "services", label: "Services", icon: "ri-server-line" },
  { id: "hooks", label: "Hooks", icon: "ri-link-m" },
  { id: "pages", label: "Pages", icon: "ri-pages-line" },
  { id: "components", label: "Components", icon: "ri-layout-line" },
  { id: "data", label: "Data", icon: "ri-database-2-line" },
];

export const sourceFiles: SourceFile[] = [
  {
    path: "src/config/env.ts",
    category: "config",
    description: "Configuração de URLs e helpers de path para a API",
    content: `export const NEXIA_API_BASE = import.meta.env.VITE_NEXIA_API_URL || 'https://nexia-os.onrender.com';
export function apiPath(route: string): string {
  return \`\${NEXIA_API_BASE}/api\${route.startsWith('/') ? route : '/' + route}\`;
}
export function healthUrl(): string { return \`\${NEXIA_API_BASE}/health\`; }
export function firebaseConfigUrl(): string { return \`\${NEXIA_API_BASE}/api/firebase-config\`; }`,
  },
  {
    path: "src/services/api.ts",
    category: "services",
    description: "Cliente HTTP completo com SSE streaming para o CORTEX",
    content: `import { apiPath, healthUrl } from '@/config/env';

async function _fetch<T>(url: string, opts = {}): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) return { error: await res.text(), status: res.status };
    return { data: await res.json(), status: res.status };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error', status: 0 };
  }
}

export async function* streamCortex(payload, signal) {
  const res = await fetch(apiPath('/cortex'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }), signal
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try { yield JSON.parse(data); } catch { yield { token: data }; }
    }
  }
}`,
  },
  {
    path: "src/services/firebase.ts",
    category: "services",
    description: "Inicialização dinâmica do Firebase via API",
    content: `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { api } from './api';

let app = null;

export async function initFirebase() {
  if (app) return { app, auth: getAuth(app) };
  const { data: cfg } = await api.firebaseConfig();
  if (!cfg) return null;
  app = initializeApp(cfg);
  return { app, auth: getAuth(app) };
}`,
  },
  {
    path: "src/contexts/AuthContext.tsx",
    category: "components",
    description: "Contexto global de autenticação Firebase com login, register e logout",
    content: `import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initFirebase } from '@/services/firebase';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initFirebase().then(result => {
      if (!result) { setLoading(false); return; }
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(result.auth, fbUser => {
          setUser(fbUser ? { uid: fbUser.uid, email: fbUser.email } : null);
          setLoading(false);
        });
      });
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await initFirebase();
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(result.auth, email, password);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);`,
  },
  {
    path: "src/hooks/useScrollReveal.ts",
    category: "hooks",
    description: "Hook de scroll reveal com IntersectionObserver nativo",
    content: `import { createElement, useEffect, useState } from 'react';

export function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }) {
  const [uniqueClass] = useState(() => 'sr-' + Math.random().toString(36).slice(2, 9));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.querySelector('.' + uniqueClass);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [uniqueClass]);

  const tClass = direction === 'up' ? 'translate-y-6' : direction === 'left' ? 'translate-x-6' : '-translate-x-6';
  const cn = className + ' ' + tClass + ' opacity-0 transition-all ' + (visible ? '!translate-x-0 !translate-y-0 !opacity-100' : '') + ' ' + uniqueClass;
  return createElement('div', { className: cn, style: { transitionDuration: '700ms', transitionDelay: delay + 'ms' } }, children);
}`,
  },
  {
    path: "server.js",
    category: "config",
    description: "Express server com SPA fallback e proxy para o backend NEXIA_OS",
    content: `const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'out')));

// API proxy → https://nexia-os.onrender.com
app.use('/api', async (req, res) => {
  const url = 'https://nexia-os.onrender.com/api' + req.path;
  const { default: fetch } = await import('node-fetch');
  const response = await fetch(url, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(await response.buffer());
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'out', 'index.html')));

app.listen(PORT, () => console.log('NEXIA OS running on port ' + PORT));`,
  },
  {
    path: "vite.config.ts",
    category: "config",
    description: "Configuração do Vite com React, aliases e build otimizado",
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  define: { __BASE_PATH__: JSON.stringify(base) },
  plugins: [react()],
  base,
  build: { outDir: 'out' },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  server: { port: 3000, host: '0.0.0.0' },
});`,
  },
  {
    path: "tailwind.config.ts",
    category: "config",
    description: "Paleta NEXIA OS com cores, animações e fontes customizadas",
    content: `export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexia: {
          bg: '#0a0a0f', surface: '#111118', surface2: '#1a1a24',
          border: '#2a2a35', cyan: '#00d4aa', 'cyan-dim': '#00a884',
          accent: '#10b981', text: '#e5e7eb', muted: '#9ca3af',
        }
      },
      animation: { marquee: 'marquee 30s linear infinite', float: 'float 6s ease-in-out infinite' },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0%)' }, '100%': { transform: 'translateX(-50%)' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
      },
    },
  },
};`,
  },
];
