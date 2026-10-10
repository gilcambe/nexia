// Acesso aos dados do atleta no Firestore (ADR-CLONE-02).
// Tudo fica em bodycoach_users/{uid}/<coleção>/{doc} — as regras só deixam o próprio
// usuário ler e gravar. Equivalente às tabelas do Supabase do app original:
// meals, athlete_profiles (→ profile/main), daily_readiness, progress_entries, medical_exams.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebaseClient';

export type BodyCoachCollection =
  | 'profile'
  | 'meals'
  | 'workouts'
  | 'daily_readiness'
  | 'progress_entries'
  | 'medical_exams';

function chaveLocal(uid: string, coll: BodyCoachCollection, id: string): string {
  return `bc_doc_${uid}_${coll}_${id}`;
}

async function db() {
  const fb = await getFirebase();
  if (!fb) throw new Error('Não consegui falar com o servidor agora. Tente novamente em instantes.');
  return fb.db;
}

// Lista os documentos de uma coleção do usuário, ordenados por um campo.
export async function listUserDocs<T>(
  uid: string,
  coll: BodyCoachCollection,
  orderField: string,
  direction: 'asc' | 'desc' = 'asc',
): Promise<(T & { _docId: string })[]> {
  const ref = collection(await db(), 'bodycoach_users', uid, coll);
  const snap = await getDocs(query(ref, orderBy(orderField, direction)));
  return snap.docs.map((d) => ({ ...(d.data() as T), _docId: d.id }));
}

// Cópia no aparelho do perfil (respostas do questionário): se o banco recusar ou estiver fora,
// o app continua usando as respostas salvas no celular. Só o perfil, para não lotar o armazenamento com fotos.
function lerLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function getUserDoc<T>(uid: string, coll: BodyCoachCollection, id: string): Promise<T | null> {
  const key = chaveLocal(uid, coll, id);
  try {
    const snap = await getDoc(doc(await db(), 'bodycoach_users', uid, coll, id));
    if (snap.exists()) return snap.data() as T;
  } catch (err) {
    if (coll !== 'profile') throw err;
    console.warn('Banco indisponível; usando a cópia do aparelho.', err);
  }
  return coll === 'profile' ? lerLocal<T>(key) : null;
}

// Grava (cria ou substitui) um documento. Campos undefined viram null.
export async function setUserDoc(
  uid: string,
  coll: BodyCoachCollection,
  id: string,
  data: Record<string, unknown>,
  merge = false,
): Promise<void> {
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v]));
  if (coll === 'profile') {
    const key = chaveLocal(uid, coll, id);
    try {
      const antes = merge ? lerLocal<Record<string, unknown>>(key) ?? {} : {};
      localStorage.setItem(key, JSON.stringify({ ...antes, ...clean }));
    } catch {
      // Armazenamento cheio ou bloqueado: segue só com o banco.
    }
  }
  try {
    await setDoc(doc(await db(), 'bodycoach_users', uid, coll, id), clean, { merge });
  } catch (err) {
    if (coll !== 'profile') throw err;
    console.warn('O banco recusou a gravação; o perfil ficou salvo no aparelho.', err);
  }
}

export async function deleteUserDoc(uid: string, coll: BodyCoachCollection, id: string): Promise<void> {
  await deleteDoc(doc(await db(), 'bodycoach_users', uid, coll, id));
}

// ── Arquivos (fotos de progresso e exames) ───────────────────────
// O Cloud Storage do Firebase exige plano pago; por isso o arquivo vai como data URL
// dentro do próprio documento do Firestore (limite de 1 MB por documento).
export const MAX_INLINE_BYTES = 850_000;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

// Reduz a imagem (lado maior até maxSide px) e gera JPEG em data URL, baixando a
// qualidade até caber no limite do documento.
export async function compressImageToDataUrl(file: File | Blob, maxSide = 1000, maxBytes = MAX_INLINE_BYTES): Promise<string> {
  const src = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagem inválida'));
    el.src = src;
  });
  let side = maxSide;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.55]) {
      const out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= maxBytes) return out;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('A imagem é grande demais para salvar. Tente uma foto menor.');
}

// Converte o arquivo do exame: imagens são comprimidas; PDF vai como está, se couber.
export async function fileToInlineDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/')) return compressImageToDataUrl(file, 1600);
  const out = await readAsDataUrl(file);
  if (out.length > MAX_INLINE_BYTES) {
    throw new Error('PDF grande demais (máx. ~600 KB). Envie uma foto do exame ou um PDF menor.');
  }
  return out;
}

// Navegadores bloqueiam abrir data URL numa aba nova; convertemos para blob: URL.
export function dataUrlToObjectUrl(dataUrl: string | null | undefined): string | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl ?? null;
  try {
    const [meta, b64] = dataUrl.split(',', 2);
    const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

// Apaga todos os dados do aluno (direito de exclusão da LGPD). Sem ordenação: pega até os docs sem data.
export const ALL_COLLECTIONS: BodyCoachCollection[] = ['meals', 'workouts', 'daily_readiness', 'progress_entries', 'medical_exams', 'profile'];
export async function deleteAllUserData(uid: string): Promise<void> {
  const database = await db();
  for (const coll of ALL_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(database, 'bodycoach_users', uid, coll));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      // 'workouts' pode ainda não estar nas regras publicadas: os treinos também ficam só no aparelho.
      if (coll !== 'workouts') throw e;
    }
  }
}
