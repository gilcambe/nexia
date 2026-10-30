// Avisos no celular (Web Push grátis, chaves criadas pelo nosso servidor). Funciona no Android (Chrome)
// e no iPhone com o app instalado na tela de início (iOS 16.4+).
import { chatApi } from './chat';
import { listUserDocs } from './userData';
import { aplicarAprendido, aprenderHorarios, type Aprendido } from './horariosAprendidos';

export interface PrefsAvisos {
  mensagens: boolean;
  treino: { ativo: boolean; hora: string };
  agua: { ativo: boolean; de: string; ate: string; cada: number };
  mensalidade: boolean;
  refeicao?: { ativo: boolean; horas: string[] };
  auto?: boolean; // ajustar os horários sozinho pelo uso
}

export const suportaAvisos = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// WebGPU + memória mínima para IA local no aparelho.

export const ehIphoneSemInstalar = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);

const deB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function registro() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL) ?? await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function assinaturaAtual(): Promise<PushSubscription | null> {
  if (!suportaAvisos()) return null;
  try { return await (await registro()).pushManager.getSubscription(); } catch { return null; }
}

// Pede a permissão, assina este aparelho e manda para o servidor.
export async function ativarAvisos(prefs?: PrefsAvisos): Promise<{ prefs: PrefsAvisos; aparelhos: number }> {
  if (!suportaAvisos()) throw new Error(ehIphoneSemInstalar() ? 'No iPhone, primeiro instale o app: Compartilhar → “Adicionar à Tela de Início”. Depois abra por lá e ative.' : 'Este navegador não aceita avisos. Use o Chrome.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Os avisos foram bloqueados. Libere nas configurações do navegador (Notificações) e tente de novo.');
  const reg = await registro();
  const { chave } = await chatApi<{ chave: string }>({ acao: 'push_chave' });
  let sub = await reg.pushManager.getSubscription();
  const atual = sub?.options?.applicationServerKey;
  if (sub && atual && btoa(String.fromCharCode(...new Uint8Array(atual))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== chave) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(chave) });
  return chatApi({ acao: 'push_assinar', sub: sub.toJSON(), prefs });
}

export const verAvisos = () => chatApi<{ prefs: PrefsAvisos; aparelhos: number }>({ acao: 'push_ver' });
export const salvarPrefs = (prefs: PrefsAvisos) => chatApi<{ prefs: PrefsAvisos }>({ acao: 'push_prefs', prefs });
export const testarAviso = () => chatApi<{ enviados: number }>({ acao: 'push_testar' });
// Horários aprendidos pelo uso: refeições e treinos dos últimos 30 dias.
export async function aprenderDoUso(uid: string): Promise<Aprendido> {
  const [refeicoes, treinos] = await Promise.all([
    listUserDocs<{ meal_time?: string; created_at?: string }>(uid, 'meals', 'created_at', 'desc').catch(() => []),
    listUserDocs<{ done_at?: string }>(uid, 'workouts', 'done_at', 'desc').catch(() => []),
  ]);
  return aprenderHorarios(
    refeicoes.slice(0, 200).map((r) => ({ time: r.meal_time, created_at: r.created_at })),
    treinos.slice(0, 60).map((t) => t.done_at ?? '').filter(Boolean),
  );
}
// Com "ajustar sozinho" ligado: uma vez por semana, ao abrir o app, os horários seguem o uso.
export async function ajustarHorariosSozinho(uid: string): Promise<boolean> {
  if (!suportaAvisos() || Notification.permission !== 'granted') return false;
  const chave = `bc_avisos_ajuste_${uid}`;
  try { if (Date.now() - Number(localStorage.getItem(chave) || 0) < 7 * 86400000) return false; localStorage.setItem(chave, String(Date.now())); } catch { return false; }
  const { prefs } = await verAvisos();
  if (!prefs.auto) return false;
  const novo = aplicarAprendido(prefs, await aprenderDoUso(uid));
  if (JSON.stringify(novo) === JSON.stringify(prefs)) return false;
  await salvarPrefs(novo);
  return true;
}
export async function desativarAvisos() {
  const sub = await assinaturaAtual();
  if (!sub) return;
  await chatApi({ acao: 'push_cancelar', endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

// Descanso: pede ao service worker para avisar quando acabar, caso a tela esteja bloqueada ou em outro app.
export function agendarFimDescanso(fimEm: number, proximo?: string) {
  if (!('serviceWorker' in navigator) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  navigator.serviceWorker.controller?.postMessage({ tipo: 'descanso', fimEm, proximo });
}
export function cancelarFimDescanso() {
  navigator.serviceWorker?.controller?.postMessage({ tipo: 'descanso_cancelar' });
}
