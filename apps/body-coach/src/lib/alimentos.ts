// Busca de alimentos e código de barras no Open Food Facts (base aberta e grátis, sem chave).
export interface Alimento { codigo: string; nome: string; marca: string; kcal: number; prot: number; carb: number; gord: number; fibra: number } // por 100 g

interface Produto { code?: string; product_name?: string; product_name_pt?: string; brands?: string; nutriments?: Record<string, number | string> }
const CAMPOS = 'code,product_name,product_name_pt,brands,nutriments';
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function paraAlimento(p: Produto): Alimento | null {
  const nome = (p.product_name_pt || p.product_name || '').trim();
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) || num(n['energy_100g']) / 4.184;
  if (!nome || !(kcal > 0)) return null;
  return { codigo: p.code ?? '', nome, marca: (p.brands ?? '').split(',')[0].trim(), kcal: Math.round(kcal), prot: num(n['proteins_100g']), carb: num(n['carbohydrates_100g']), gord: num(n['fat_100g']), fibra: num(n['fiber_100g']) };
}

export function porPorcao(a: Alimento, gramas: number) {
  const f = gramas / 100;
  const r = (x: number) => Math.round(x * f * 10) / 10;
  return { calories: Math.round(a.kcal * f), protein: r(a.prot), carbs: r(a.carb), fat: r(a.gord), fiber: r(a.fibra) };
}

async function pedir(url: string): Promise<{ products?: Produto[]; product?: Produto; status?: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('falhou');
    return await r.json();
  } catch { throw new Error('Não consegui buscar agora. Confira a internet e tente de novo.'); }
  finally { clearTimeout(t); }
}

export async function buscarPorCodigo(codigo: string): Promise<Alimento | null> {
  const c = codigo.replace(/\D/g, '');
  if (c.length < 8) return null;
  const d = await pedir(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${CAMPOS}`);
  return d.status === 1 && d.product ? paraAlimento({ ...d.product, code: c }) : null;
}

export async function buscarPorNome(texto: string): Promise<Alimento[]> {
  const q = texto.trim();
  if (q.length < 2) return [];
  const d = await pedir(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&lc=pt&cc=br&fields=${CAMPOS}`);
  return (d.products ?? []).map(paraAlimento).filter((a): a is Alimento => !!a).slice(0, 8);
}

// Leitura do código pela câmera (Chrome/Android e outros que têm BarcodeDetector). Sem suporte: o aluno digita o número.
interface Detector { detect: (v: CanvasImageSource) => Promise<{ rawValue: string }[]> }
export function podeLerCodigo(): boolean { return typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector !== 'undefined' && !!navigator.mediaDevices?.getUserMedia; }
export async function lerCodigoDaCamera(video: HTMLVideoElement, parar: () => boolean): Promise<string | null> {
  const D = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const det = new D({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  while (!parar()) {
    try { const r = await det.detect(video); if (r[0]?.rawValue) return r[0].rawValue; } catch { /* quadro ruim: tenta o próximo */ }
    await new Promise((res) => setTimeout(res, 250));
  }
  return null;
}
