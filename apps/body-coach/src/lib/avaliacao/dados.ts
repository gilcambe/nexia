// Avaliações guardadas no banco: cada uma é um documento de progress_entries (a mesma coleção
// do registro rápido de peso), com os campos antigos preenchidos para o resto do app continuar
// funcionando (peso, gordura, cintura, foto) e a avaliação completa em `avaliacao`.
// As 4 fotos (frente, costas, lado direito e esquerdo) vão no próprio documento, comprimidas,
// porque o Cloud Storage do Firebase exige plano pago e o documento aceita até 1 MB.
import { deleteUserDoc, setUserDoc } from '@/lib/userData';
import { isLocalDemoActive, readLocalList, writeLocalList, LOCAL_PROGRESS_KEY } from '@/lib/localDemo';
import type { ProgressEntry } from '@/hooks/useProgressData';
import { localProgressSeed } from '@/mocks/localDemo';
import { CAMPO_POR_KEY } from './campos.ts';
import { calcular, type Avaliacao, type Sexo } from './calculos.ts';

export type Pose = 'frente' | 'costas' | 'direita' | 'esquerda';
export const POSES: { id: Pose; label: string; dica: string }[] = [
  { id: 'frente', label: 'Frente', dica: 'De frente, braços soltos ao lado do corpo, pés na largura do quadril.' },
  { id: 'costas', label: 'Costas', dica: 'De costas para a câmera, mesma posição dos pés e braços soltos.' },
  { id: 'direita', label: 'Lado direito', dica: 'Lado direito virado para a câmera, braços estendidos à frente.' },
  { id: 'esquerda', label: 'Lado esquerdo', dica: 'Lado esquerdo virado para a câmera, braços estendidos à frente.' },
];
export type Fotos = Partial<Record<Pose, string | null>>;

// Cada foto até ~200 KB: as 4 cabem com folga no limite de 1 MB do documento.
export const MAX_FOTO_BYTES = 200_000;

export interface PerfilAvaliacao {
  sexo: Sexo | null;
  idade: number | null;
  altura: number | null;
  nome: string | null;
}

// Avaliação de um registro (novo ou antigo). Registros antigos viram uma avaliação simples.
export function avaliacaoDoRegistro(e: ProgressEntry): Avaliacao {
  if (e.avaliacao) return { ...e.avaliacao, valores: { ...(e.avaliacao.valores ?? {}) } };
  const valores: Record<string, number> = {};
  if (e.weight_kg != null) valores.peso = e.weight_kg;
  if (e.body_fat_pct != null) valores.gordura_pct = e.body_fat_pct;
  for (const [k, n] of Object.entries(e.measurements ?? {})) if (CAMPO_POR_KEY[k] && Number.isFinite(n)) valores[k] = n;
  return { data: e.taken_at.slice(0, 10), valores, fonte: 'Registro rápido', notas: e.notes };
}

export function fotosDoRegistro(e: ProgressEntry): Fotos {
  const f: Fotos = { ...(e.fotos ?? {}) };
  if (!f.frente && e.image_url) f.frente = e.image_url;
  return f;
}

// Idade na data da avaliação, a partir da idade de hoje.
export function idadeNaData(idadeHoje: number | null, data: string): number | null {
  if (!idadeHoje) return null;
  const anos = (Date.now() - new Date(`${data}T12:00:00`).getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(1, Math.round(idadeHoje - Math.max(0, Math.floor(anos))));
}

// Completa sexo, idade e altura com o perfil quando a avaliação não trouxe.
export function completar(av: Avaliacao, perfil: PerfilAvaliacao): Avaliacao {
  const valores = { ...av.valores };
  if (valores.idade == null) {
    const i = idadeNaData(perfil.idade, av.data);
    if (i) valores.idade = i;
  }
  if (valores.altura == null && perfil.altura) valores.altura = perfil.altura;
  return { ...av, sexo: av.sexo ?? perfil.sexo ?? null, valores };
}

function tomadoEm(av: Avaliacao): string {
  const [h, m] = (av.hora ?? '12:00').split(':').map(Number);
  const d = new Date(`${av.data}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
  // Sem hora informada e data de hoje: não grava no futuro (o "há quantos dias" ficaria negativo).
  if (!av.hora && d.getTime() > Date.now()) return new Date().toISOString();
  return d.toISOString();
}

function documento(uid: string, id: number, av: Avaliacao, fotos: Fotos) {
  const res = calcular(av);
  const circ: Record<string, number> = {};
  for (const [k, n] of Object.entries(av.valores)) if (CAMPO_POR_KEY[k]?.grupo === 'circ') circ[k] = n;
  const limpas: Fotos = {};
  for (const p of POSES) if (fotos[p.id]) limpas[p.id] = fotos[p.id];
  return {
    id,
    user_id: uid,
    taken_at: tomadoEm(av),
    weight_kg: av.valores.peso ?? null,
    body_fat_pct: res.gordura ?? null,
    measurements: circ,
    image_url: null,
    notes: av.notas?.trim() || null,
    avaliacao: {
      data: av.data,
      hora: av.hora ?? null,
      sexo: av.sexo ?? null,
      valores: av.valores,
      segmental: av.segmental ?? null,
      protocolo: av.protocolo ?? 'auto',
      fonte: av.fonte ?? 'Manual',
      notas: av.notas?.trim() || null,
    },
    fotos: limpas,
  };
}

// Salva (cria ou substitui). Se já houver avaliação na mesma data, junta as duas:
// os números novos valem e os que faltarem ficam os antigos (fotos também).
export async function salvarAvaliacao(
  uid: string,
  av: Avaliacao,
  opts: { fotos?: Fotos; existentes?: ProgressEntry[]; id?: number; juntarMesmaData?: boolean } = {},
): Promise<number> {
  let id = opts.id ?? Date.now();
  let base: Avaliacao | null = null;
  let fotos: Fotos = { ...(opts.fotos ?? {}) };
  const alvo = opts.id != null
    ? opts.existentes?.find((e) => e.id === opts.id)
    : opts.juntarMesmaData !== false
      ? opts.existentes?.find((e) => avaliacaoDoRegistro(e).data === av.data)
      : undefined;
  if (alvo) {
    id = alvo.id;
    base = avaliacaoDoRegistro(alvo);
    fotos = { ...fotosDoRegistro(alvo), ...Object.fromEntries(Object.entries(fotos).filter(([, v]) => v !== undefined)) };
  }
  const final: Avaliacao = base && opts.id == null
    ? {
      ...base,
      ...av,
      valores: { ...base.valores, ...av.valores },
      segmental: av.segmental ?? base.segmental ?? null,
      sexo: av.sexo ?? base.sexo ?? null,
      fonte: base.fonte && av.fonte && !base.fonte.includes(av.fonte) && base.fonte !== 'Registro rápido' ? `${base.fonte} + ${av.fonte}` : av.fonte ?? base.fonte,
      notas: av.notas ?? base.notas ?? null,
    }
    : av;
  const doc = documento(uid, id, final, fotos);

  if (isLocalDemoActive()) {
    const salvos = readLocalList<Record<string, unknown>>(LOCAL_PROGRESS_KEY) ?? (localProgressSeed.map((r) => ({ ...r })) as Record<string, unknown>[]);
    const lista = salvos.filter((r) => r.id !== id);
    lista.push(doc);
    writeLocalList(LOCAL_PROGRESS_KEY, lista);
    return id;
  }
  await setUserDoc(uid, 'progress_entries', String(id), doc);
  return id;
}

export async function apagarAvaliacao(uid: string, id: number): Promise<void> {
  if (isLocalDemoActive()) {
    writeLocalList(LOCAL_PROGRESS_KEY, (readLocalList<Record<string, unknown>>(LOCAL_PROGRESS_KEY) ?? []).filter((r) => r.id !== id));
    return;
  }
  await deleteUserDoc(uid, 'progress_entries', String(id));
}
